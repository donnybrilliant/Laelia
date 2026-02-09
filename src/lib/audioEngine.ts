import type * as ToneType from 'tone';

/** Lazy-loaded at first user gesture to avoid AudioContext creation before user interaction. */
let toneModule: typeof ToneType | null = null;

/** Load Tone.js (and thus create AudioContext) only after a user gesture. Call from ensureAudio() before unlock/init. */
export async function loadTone(): Promise<void> {
  if (toneModule) return;
  toneModule = await import('tone');
}

const CHORD_INTERVALS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  sus: [0, 5, 7],
};

const EXTENSION_INTERVALS = {
  '6': 9,
  'm7': 10,
  'M7': 11,
  '9': 14,
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SOUND_PRESETS = [
  { name: 'Piano', oscillator: 'triangle', attack: 0.02, decay: 0.3, sustain: 0.4, release: 1.2 },
  { name: 'Pad', oscillator: 'sine', attack: 0.5, decay: 0.5, sustain: 0.8, release: 2 },
  { name: 'Strings', oscillator: 'sawtooth', attack: 0.3, decay: 0.4, sustain: 0.7, release: 1.5 },
  { name: 'Organ', oscillator: 'sine', attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.3 },
  { name: 'Pluck', oscillator: 'triangle', attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 },
  { name: 'Bell', oscillator: 'sine', attack: 0.01, decay: 0.5, sustain: 0.2, release: 2 },
  { name: 'Synth', oscillator: 'square', attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.8 },
  { name: 'Brass', oscillator: 'sawtooth', attack: 0.1, decay: 0.3, sustain: 0.6, release: 0.4 },
];

const PERFORMANCE_MODES = ['poly', 'strum', 'arp', 'harp'] as const;
export type PerformanceMode = typeof PERFORMANCE_MODES[number];

export interface SynthState {
  volume: number;
  sound: number;
  performanceMode: PerformanceMode;
  fx: number;
  key: number;
  bpm: number;
  chordVoicing: number;
  bassVoicing: number;
  chordType: 'maj' | 'min' | 'dim' | 'sus';
  extensions: Set<'6' | 'm7' | 'M7' | '9'>;
  currentNote: number;
}

class AudioEngine {
  private synth: ToneType.PolySynth | null = null;
  private bassSynth: ToneType.Synth | null = null;
  private reverb: ToneType.Reverb | null = null;
  private delay: ToneType.FeedbackDelay | null = null;
  private chorus: ToneType.Chorus | null = null;
  private phaser: ToneType.Phaser | null = null;
  private tremolo: ToneType.Tremolo | null = null;
  private distortion: ToneType.Distortion | null = null;
  private analyser: ToneType.Analyser | null = null;
  private initialized = false;
  private arpTimeout: ReturnType<typeof setTimeout> | null = null;
  private arpIndex = 0;
  private currentArpNote: string | null = null;
  private currentBassNote: string | null = null;
  private currentChordNotes: string[] = [];
  private activeNotesModes: Map<string, PerformanceMode> = new Map();
  /** Track notes per key index for proper cleanup when switching chords */
  private activeVoices: Map<number, { notes: string[]; bassNote: string }> = new Map();
  /** For arp mode: the full sequence of notes to arpeggiate (sorted, deduplicated from all held keys) */
  private arpSequence: string[] = [];
  /** For arp mode: notes we're transitioning TO (for smooth scale transitions) */
  private arpTransitionQueue: string[] = [];
  /** Scheduled strum/harp attack timeouts that can be cancelled */
  private scheduledAttacks: ReturnType<typeof setTimeout>[] = [];

  state: SynthState = {
    volume: 0.7,
    sound: 0,
    performanceMode: 'poly',
    fx: 0.3,
    key: 0,
    bpm: 120,
    chordVoicing: 0,
    bassVoicing: 0,
    chordType: 'maj',
    extensions: new Set(),
    currentNote: -1,
  };

  async init(): Promise<boolean> {
    if (this.initialized || !toneModule) return true;
    const T = toneModule;
    try {
      const ctx = T.getContext();
      // Don't rely only on await Tone.start() - it can hang on Chrome iOS. Race with a short wait, then poll.
      const startResolved = await Promise.race([
        T.start().then(() => ctx.state === 'running'),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(ctx.state === 'running'), 400)),
      ]);
      if (!startResolved && ctx.state !== 'running') {
        const ok = await this.waitForContextRunning(5000);
        if (!ok) return false;
      }

      this.analyser = new T.Analyser('waveform', 128);
      this.reverb = new T.Reverb({ decay: 2.5, wet: 0.3 }).toDestination();
      this.reverb.connect(this.analyser);
      this.delay = new T.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: 0.2 }).connect(this.reverb);
      this.chorus = new T.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.3 }).connect(this.delay);
      this.phaser = new T.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 350, wet: 0.2 }).connect(this.chorus);
      this.tremolo = new T.Tremolo({ frequency: 4, depth: 0.6, wet: 0 }).connect(this.phaser).start();
      this.distortion = new T.Distortion({ distortion: 0.1, wet: 0 }).connect(this.tremolo);

      this.synth = new T.PolySynth(T.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 1.2 },
      }).connect(this.distortion);

      this.bassSynth = new T.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.8 },
      }).connect(this.distortion);

      this.updateVolume(this.state.volume);
      this.initialized = true;
      return true;
    } catch (e) {
      console.warn('[AudioEngine] init failed:', e);
      return false;
    }
  }

  /** Call synchronously in a user gesture (e.g. pointer down). Required on mobile Safari/Chrome. Call after loadTone(). */
  unlockAudio(): void {
    if (!toneModule) return;
    const T = toneModule;
    T.start();
    const ctx = T.getContext();
    if (ctx.state === 'suspended') ctx.resume();
    // Chrome iOS and some mobile browsers use 'interrupted' state; Tone only handles 'suspended'. Raw resume helps.
    const raw = (ctx as unknown as { rawContext?: AudioContext }).rawContext;
    if (raw?.resume) raw.resume();
  }

  /** Wait for context to be running without hanging (Chrome iOS can leave Tone.start() unresolved). */
  private async waitForContextRunning(maxMs: number): Promise<boolean> {
    if (!toneModule) return false;
    const ctx = toneModule.getContext();
    const raw = (ctx as unknown as { rawContext?: AudioContext }).rawContext;
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (ctx.state === 'running') return true;
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
        try {
          ctx.resume();
          if (raw?.resume) raw.resume();
        } catch {
          // ignore
        }
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    return ctx.state === 'running';
  }

  async ensureReady(): Promise<boolean> {
    if (!toneModule) return false;
    if (this.initialized && toneModule.getContext().state === 'running') return true;
    return this.init();
  }

  isReady(): boolean {
    return !!toneModule && this.initialized && toneModule.getContext().state === 'running';
  }

  updateVolume(value: number): void {
    this.state.volume = value;
    if (!toneModule) return;
    const dbValue = toneModule.gainToDb(value);
    if (this.synth) this.synth.volume.value = dbValue;
    if (this.bassSynth) this.bassSynth.volume.value = dbValue - 6;
  }

  updateSound(index: number): void {
    this.state.sound = index;
    const preset = SOUND_PRESETS[index % SOUND_PRESETS.length];
    if (this.synth) {
      this.synth.set({
        oscillator: { type: preset.oscillator as OscillatorType },
        envelope: { attack: preset.attack, decay: preset.decay, sustain: preset.sustain, release: preset.release },
      });
    }
  }

  updateFx(value: number): void {
    this.state.fx = value;
    if (this.reverb) this.reverb.wet.value = value * 0.5;
    if (this.delay) this.delay.wet.value = value * 0.3;
    if (this.chorus) this.chorus.wet.value = value * 0.4;
    if (this.phaser) this.phaser.wet.value = value * 0.3;
  }

  updateBpm(bpm: number): void {
    this.state.bpm = bpm;
    if (!toneModule) return;
    toneModule.getTransport().bpm.value = bpm;
    if (this.delay) this.delay.delayTime.value = 60 / bpm / 2;
    if (this.tremolo) this.tremolo.frequency.value = bpm / 30;
  }

  setChordType(type: 'maj' | 'min' | 'dim' | 'sus'): void {
    this.state.chordType = type;
  }

  toggleExtension(ext: '6' | 'm7' | 'M7' | '9'): void {
    if (this.state.extensions.has(ext)) this.state.extensions.delete(ext);
    else this.state.extensions.add(ext);
  }

  setPerformanceMode(mode: PerformanceMode): void {
    this.state.performanceMode = mode;
    this.stopArp();
  }

  private stopArp(): void {
    if (this.arpTimeout !== null) {
      clearTimeout(this.arpTimeout);
      this.arpTimeout = null;
    }
    // Release the currently-playing arp note to prevent stuck notes
    if (this.currentArpNote && this.synth && toneModule) {
      this.synth.triggerRelease(this.currentArpNote, toneModule.now());
      this.currentArpNote = null;
    }
    this.arpIndex = 0;
    this.arpSequence = [];
    this.arpTransitionQueue = [];
  }

  /** Convert note string to MIDI number for sorting */
  private noteToMidi(note: string): number {
    const match = note.match(/^([A-G]#?)(\d+)$/);
    if (!match) return 0;
    const [, noteName, octaveStr] = match;
    const noteIndex = NOTE_NAMES.indexOf(noteName);
    return (parseInt(octaveStr) + 1) * 12 + noteIndex;
  }

  /** Single tick of the arpeggiator (release current, advance to next, trigger attack) */
  private arpTick(): void {
    if (!this.synth || !toneModule) return;
    const now = toneModule.now() + 0.01;
    if (this.currentArpNote) {
      this.synth.triggerRelease(this.currentArpNote, now);
    }
    if (this.arpTransitionQueue.length > 0) {
      this.currentArpNote = this.arpTransitionQueue.shift()!;
      this.synth.triggerAttack(this.currentArpNote, now);
      return;
    }
    if (this.arpSequence.length > 0) {
      this.arpIndex = (this.arpIndex + 1) % this.arpSequence.length;
      this.currentArpNote = this.arpSequence[this.arpIndex];
      this.synth.triggerAttack(this.currentArpNote, now);
    }
  }

  /** Schedule the next arp tick using current BPM (loop continues with current tempo) */
  private scheduleNextArpTick(): void {
    this.arpTimeout = setTimeout(() => {
      this.arpTick();
      this.scheduleNextArpTick();
    }, 60000 / this.state.bpm / 2);
  }

  /** Get all unique notes from all active voices, sorted by pitch */
  private getAllArpNotes(): string[] {
    const allNotes = new Set<string>();
    for (const voice of this.activeVoices.values()) {
      voice.notes.forEach(note => allNotes.add(note));
    }
    return Array.from(allNotes).sort((a, b) => this.noteToMidi(a) - this.noteToMidi(b));
  }

  /** Build transition notes from current arp position to new target sequence */
  private buildArpTransition(currentNote: string, newSequence: string[]): string[] {
    if (newSequence.length === 0) return [];

    const currentMidi = this.noteToMidi(currentNote);

    // Find the nearest note in the new sequence to transition to
    let nearestIdx = 0;
    let nearestDist = Infinity;
    newSequence.forEach((note, i) => {
      const dist = Math.abs(this.noteToMidi(note) - currentMidi);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    });

    // Build a smooth transition: current position → nearest in new sequence
    const targetMidi = this.noteToMidi(newSequence[nearestIdx]);
    const transition: string[] = [];

    // If we need to go up or down to reach the target, add intermediate notes
    if (targetMidi > currentMidi) {
      // Going up - add notes between current and target
      for (const note of newSequence) {
        const midi = this.noteToMidi(note);
        if (midi > currentMidi && midi <= targetMidi) {
          transition.push(note);
        }
      }
    } else if (targetMidi < currentMidi) {
      // Going down - add notes between target and current (in descending order)
      const descending: string[] = [];
      for (const note of newSequence) {
        const midi = this.noteToMidi(note);
        if (midi >= targetMidi && midi < currentMidi) {
          descending.push(note);
        }
      }
      transition.push(...descending.reverse());
    }

    return transition;
  }

  /** Update arp sequence when keys change - called from playNote and releaseVoice */
  private updateArpSequence(): void {
    if (this.state.performanceMode !== 'arp') return;

    const newSequence = this.getAllArpNotes();

    // If this is the first key or arp isn't running, just set the sequence
    if (this.arpTimeout === null || this.arpSequence.length === 0) {
      this.arpSequence = newSequence;
      this.arpIndex = 0;
      return;
    }

    // Build transition from current note to new sequence
    if (this.currentArpNote && newSequence.length > 0) {
      const transition = this.buildArpTransition(this.currentArpNote, newSequence);
      this.arpTransitionQueue = transition;
    }

    this.arpSequence = newSequence;
  }

  private midiToNote(midi: number): string {
    const octave = Math.floor(midi / 12) - 1;
    return `${NOTE_NAMES[midi % 12]}${octave}`;
  }

  private buildChord(rootMidi: number): number[] {
    const intervals = [...CHORD_INTERVALS[this.state.chordType]];
    this.state.extensions.forEach(ext => intervals.push(EXTENSION_INTERVALS[ext]));
    const notes = intervals.map(i => rootMidi + i);
    const voicing = Math.floor(this.state.chordVoicing * 4);
    for (let i = 0; i < voicing; i++) {
      if (notes.length > 0) notes[i % notes.length] += 12;
    }
    return notes.sort((a, b) => a - b);
  }

  private getChordName(rootMidi: number): string {
    const rootNote = NOTE_NAMES[rootMidi % 12];
    let typeName = '';
    switch (this.state.chordType) {
      case 'maj': typeName = ''; break;
      case 'min': typeName = 'm'; break;
      case 'dim': typeName = 'dim'; break;
      case 'sus': typeName = 'sus4'; break;
    }
    let extName = '';
    if (this.state.extensions.has('M7')) extName = 'maj7';
    else if (this.state.extensions.has('m7')) extName = '7';
    if (this.state.extensions.has('9')) extName += '9';
    if (this.state.extensions.has('6')) extName += '6';
    return `${rootNote}${typeName}${extName}`;
  }

  playNote(noteIndex: number): string {
    if (!this.isReady() || !this.synth || !this.bassSynth) return '';

    // For non-arp modes, only one voice should play at a time (like a traditional synth)
    if (this.state.performanceMode !== 'arp') {
      // Cancel any scheduled strum/harp attacks that haven't happened yet
      this.scheduledAttacks.forEach(timeout => clearTimeout(timeout));
      this.scheduledAttacks = [];
      
      // Release all currently playing notes immediately
      const now = toneModule!.now();
      this.synth.releaseAll(now);
      this.activeNotesModes.clear();
      this.activeVoices.clear();
    } else {
      // For arp mode, only release this specific key if re-triggering
      this.releaseVoice(noteIndex);
    }

    // Use immediate scheduling to avoid Tone's "start time must be strictly greater" errors when slides
    // generate rapid re-triggers.
    const t0 = toneModule!.now();
    this.state.currentNote = noteIndex;
    const rootMidi = 48 + noteIndex + this.state.key;
    const chordMidi = this.buildChord(rootMidi);
    const noteStrings = chordMidi.map((m) => this.midiToNote(m));
    noteStrings.forEach(note => this.activeNotesModes.set(note, this.state.performanceMode));

    const bassOctave = 2 + Math.floor(this.state.bassVoicing * 2);
    const bassNote = `${NOTE_NAMES[rootMidi % 12]}${bassOctave}`;
    // Release previous bass note before attacking new one (monophonic synth)
    if (this.currentBassNote) {
      this.bassSynth.triggerRelease(t0);
    }
    this.currentBassNote = bassNote;
    this.bassSynth.triggerAttack(bassNote, t0);

    let trackedNotes = [...noteStrings];

    switch (this.state.performanceMode) {
      case 'poly':
        this.synth.triggerAttack(noteStrings, t0);
        break;

      case 'strum': {
        // Strum: play notes with staggered timing using setTimeout (cancelable)
        // First note plays immediately
        this.synth.triggerAttack(noteStrings[0], t0);
        // Subsequent notes are scheduled via setTimeout
        noteStrings.slice(1).forEach((note, i) => {
          const timeout = setTimeout(() => {
            this.synth?.triggerAttack(note, toneModule!.now());
          }, (i + 1) * 50); // 50ms stagger
          this.scheduledAttacks.push(timeout);
        });
        break;
      }

      case 'arp': {
        // Track this voice first so updateArpSequence sees it
        this.activeVoices.set(noteIndex, { notes: trackedNotes, bassNote });

        const isFirstKey = this.activeVoices.size === 1;

        if (isFirstKey) {
          // First key - start the arpeggiator
          this.arpSequence = this.getAllArpNotes();
          this.arpIndex = 0;

          if (this.arpSequence.length > 0) {
            this.currentArpNote = this.arpSequence[0];
            this.synth.triggerAttack(this.currentArpNote, t0);
          }

          this.scheduleNextArpTick();
        } else {
          // Additional key - update the sequence with smooth transition
          this.updateArpSequence();
        }

        // Update display notes and return early (we already set activeVoices)
        this.currentChordNotes = Array.from(this.activeVoices.values()).flatMap(v => v.notes);
        return this.getChordName(rootMidi);
      }

      case 'harp': {
        // Harp: play notes with staggered timing including octave up, using setTimeout (cancelable)
        const octaveUpNotes = chordMidi.map((m) => this.midiToNote(m + 12));
        trackedNotes = [...noteStrings, ...octaveUpNotes];
        octaveUpNotes.forEach(note => this.activeNotesModes.set(note, 'harp'));
        // First note plays immediately
        this.synth.triggerAttack(trackedNotes[0], t0);
        // Subsequent notes are scheduled via setTimeout
        trackedNotes.slice(1).forEach((note, i) => {
          const timeout = setTimeout(() => {
            this.synth?.triggerAttack(note, toneModule!.now());
          }, (i + 1) * 30); // 30ms stagger
          this.scheduledAttacks.push(timeout);
        });
        break;
      }
    }

    // Track this voice's notes for proper cleanup
    this.activeVoices.set(noteIndex, { notes: trackedNotes, bassNote });

    // Update currentChordNotes to include all active voice notes (for display)
    this.currentChordNotes = Array.from(this.activeVoices.values()).flatMap(v => v.notes);

    return this.getChordName(rootMidi);
  }

  /** Release notes for a specific voice/key (internal use) */
  private releaseVoice(noteIndex: number): void {
    const voice = this.activeVoices.get(noteIndex);
    if (!voice || !toneModule) return;

    const now = toneModule.now();

    // Release all notes from this voice
    voice.notes.forEach(note => {
      this.synth?.triggerRelease(note, now);
      this.activeNotesModes.delete(note);
    });

    this.activeVoices.delete(noteIndex);

    // Update arp sequence if in arp mode and there are still keys held
      if (this.state.performanceMode === 'arp' && this.activeVoices.size > 0) {
        this.updateArpSequence();
      }

      // Update display
      this.currentChordNotes = Array.from(this.activeVoices.values()).flatMap(v => v.notes);
  }

  /** Release a specific key's voice - called when a key is released but others remain held */
  releaseKey(noteIndex: number): void {
    if (!this.synth || !this.bassSynth) return;
    
    const voice = this.activeVoices.get(noteIndex);
    if (!voice) return;

    // Release the voice
    this.releaseVoice(noteIndex);
    
    // If no more voices, stop everything
    if (this.activeVoices.size === 0) {
      // No more keys held: stop everything and clear any pending staggered attacks
      this.stopArp();
      this.scheduledAttacks.forEach(timeout => clearTimeout(timeout));
      this.scheduledAttacks = [];
      const now = toneModule!.now();
      this.synth.releaseAll(now);
      this.bassSynth.triggerRelease(now);
      this.currentBassNote = null;
      this.currentChordNotes = [];
      this.activeNotesModes.clear();
      this.state.currentNote = -1;
    }
  }

  releaseNote(): void {
    if (!this.synth || !this.bassSynth || !toneModule) return;
    this.stopArp();
    // Cancel any scheduled strum/harp attacks
    this.scheduledAttacks.forEach(timeout => clearTimeout(timeout));
    this.scheduledAttacks = [];
    const now = toneModule.now();
    this.synth.releaseAll(now);
    this.bassSynth.triggerRelease(now);
    this.currentBassNote = null;
    this.currentChordNotes = [];
    this.activeNotesModes.clear();
    this.activeVoices.clear();
    this.state.currentNote = -1;
  }

  releaseSpecificNote(noteToRelease: string): void {
    if (!this.synth || !toneModule) return;
    this.synth.triggerRelease(noteToRelease, toneModule.now());
    this.activeNotesModes.delete(noteToRelease);

    // Remove from voice tracking
    for (const [keyIndex, voice] of this.activeVoices.entries()) {
      voice.notes = voice.notes.filter(n => n !== noteToRelease);
      if (voice.notes.length === 0) {
        this.activeVoices.delete(keyIndex);
      }
    }

    // Update arp sequence if needed
    if (this.state.performanceMode === 'arp' && this.activeVoices.size > 0) {
      this.updateArpSequence();
    }

    this.currentChordNotes = Array.from(this.activeVoices.values()).flatMap(v => v.notes);
  }

  getPresetName(): string {
    return SOUND_PRESETS[this.state.sound % SOUND_PRESETS.length].name;
  }

  getKeyName(): string {
    return NOTE_NAMES[this.state.key];
  }

  getWaveformData(): Float32Array {
    if (!this.analyser) return new Float32Array(128);
    return this.analyser.getValue() as Float32Array;
  }

  getActiveNotes(): Array<{ note: string; mode: PerformanceMode }> {
    if (!this.synth || !toneModule) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const voices = (this.synth as any)._voices as ToneType.Synth[] | undefined;
    if (!voices) {
      return this.currentChordNotes.map(note => ({
        note,
        mode: this.activeNotesModes.get(note) || this.state.performanceMode,
      }));
    }
    const activeNotes: Array<{ note: string; mode: PerformanceMode }> = [];
    const seenNotes = new Set<string>();
    const T = toneModule;
    voices.forEach((voice: ToneType.Synth) => {
      const env = voice.envelope;
      if (env && env.value > 0.01) {
        const note = T.Frequency(voice.frequency.value).toNote();
        if (!seenNotes.has(note)) {
          seenNotes.add(note);
          activeNotes.push({ note, mode: this.activeNotesModes.get(note) || this.state.performanceMode });
        }
      }
    });
    for (const storedNote of this.activeNotesModes.keys()) {
      if (!seenNotes.has(storedNote)) this.activeNotesModes.delete(storedNote);
    }
    return activeNotes;
  }

  dispose(): void {
    this.stopArp();
    // Cancel any scheduled strum/harp attacks
    this.scheduledAttacks.forEach(timeout => clearTimeout(timeout));
    this.scheduledAttacks = [];
    this.synth?.dispose();
    this.bassSynth?.dispose();
    this.reverb?.dispose();
    this.delay?.dispose();
    this.chorus?.dispose();
    this.phaser?.dispose();
    this.tremolo?.dispose();
    this.distortion?.dispose();
    this.analyser?.dispose();
    this.activeVoices.clear();
    this.currentChordNotes = [];
    this.activeNotesModes.clear();
    this.state.currentNote = -1;
    this.initialized = false;
  }
}

export const audioEngine = new AudioEngine();
export { SOUND_PRESETS, PERFORMANCE_MODES, NOTE_NAMES };
