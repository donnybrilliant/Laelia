import * as Tone from 'tone';

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
  private synth: Tone.PolySynth | null = null;
  private bassSynth: Tone.PolySynth | null = null;
  private reverb: Tone.Reverb | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private chorus: Tone.Chorus | null = null;
  private phaser: Tone.Phaser | null = null;
  private tremolo: Tone.Tremolo | null = null;
  private distortion: Tone.Distortion | null = null;
  private analyser: Tone.Analyser | null = null;
  private initialized = false;
  private arpInterval: ReturnType<typeof setInterval> | null = null;
  /** Note currently sounding in arp mode; used so we release the right note when the list shrinks. */
  private currentArpNote: string | null = null;
  private currentChordNotes: string[] = [];
  private activeNotesModes: Map<string, PerformanceMode> = new Map();
  /** Per-key voice tracking for true polyphony: key index → chord notes + bass note */
  private activeVoices: Map<number, { notes: string[]; bassNote: string }> = new Map();

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
    if (this.initialized) return true;
    try {
      await Tone.start();
      const ctx = Tone.getContext();
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state !== 'running') return false;

      this.analyser = new Tone.Analyser('waveform', 128);
      this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).toDestination();
      this.reverb.connect(this.analyser);
      this.delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: 0.2 }).connect(this.reverb);
      this.chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.3 }).connect(this.delay);
      this.phaser = new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 350, wet: 0.2 }).connect(this.chorus);
      this.tremolo = new Tone.Tremolo({ frequency: 4, depth: 0.6, wet: 0 }).connect(this.phaser).start();
      this.distortion = new Tone.Distortion({ distortion: 0.1, wet: 0 }).connect(this.tremolo);

      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 1.2 },
      }).connect(this.distortion);

      this.bassSynth = new Tone.PolySynth(Tone.Synth, {
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

  unlockAudio(): void {
    const ctx = Tone.getContext();
    if (ctx.state === 'suspended') ctx.resume();
  }

  async ensureReady(): Promise<boolean> {
    if (this.initialized && Tone.getContext().state === 'running') return true;
    return this.init();
  }

  isReady(): boolean {
    return this.initialized && Tone.getContext().state === 'running';
  }

  updateVolume(value: number): void {
    this.state.volume = value;
    const dbValue = Tone.gainToDb(value);
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
    Tone.getTransport().bpm.value = bpm;
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
    if (this.arpInterval) {
      clearInterval(this.arpInterval);
      this.arpInterval = null;
    }
    this.currentArpNote = null;
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

  /** Flatten all chord notes from active keys (for display/arp). */
  private getAllActiveChordNotes(): string[] {
    return Array.from(this.activeVoices.values()).flatMap((v) => v.notes);
  }

  playNote(noteIndex: number): string {
    if (!this.isReady() || !this.synth || !this.bassSynth) return '';
    const existing = this.activeVoices.get(noteIndex);
    if (existing) {
      const now = Tone.now();
      existing.notes.forEach((note) => this.synth!.triggerRelease(note, now));
      this.bassSynth.triggerRelease(existing.bassNote, now);
      existing.notes.forEach((note) => this.activeNotesModes.delete(note));
    }
    const t0 = Tone.now() + 0.01;
    this.state.currentNote = noteIndex;
    const rootMidi = 48 + noteIndex + this.state.key;
    const chordMidi = this.buildChord(rootMidi);
    const noteStrings = chordMidi.map((m) => this.midiToNote(m));
    noteStrings.forEach((note) => this.activeNotesModes.set(note, this.state.performanceMode));

    const bassOctave = 2 + Math.floor(this.state.bassVoicing * 2);
    const bassNote = `${NOTE_NAMES[rootMidi % 12]}${bassOctave}`;

    this.activeVoices.set(noteIndex, { notes: noteStrings, bassNote });
    this.currentChordNotes = this.getAllActiveChordNotes();

    this.bassSynth.triggerAttack(bassNote, t0);

    switch (this.state.performanceMode) {
      case 'poly':
        this.synth.triggerAttack(noteStrings, t0);
        break;
      case 'strum': {
        this.stopArp();
        const strumPreset = SOUND_PRESETS[this.state.sound % SOUND_PRESETS.length];
        noteStrings.forEach((note, i) => {
          this.synth?.triggerAttackRelease(note, strumPreset.release + 1.0, t0 + i * 0.05);
        });
        break;
      }
      case 'arp': {
        this.stopArp();
        const allArpNotes = this.getAllActiveChordNotes();
        if (allArpNotes.length > 0) {
          this.currentArpNote = allArpNotes[0];
          this.synth.triggerAttack(allArpNotes[0], t0);
        }
        this.arpInterval = setInterval(() => {
          const allNotes = this.getAllActiveChordNotes();
          if (this.synth && allNotes.length > 0) {
            const now = Tone.now() + 0.01;
            if (this.currentArpNote) this.synth.triggerRelease(this.currentArpNote, now);
            const currentIndex = this.currentArpNote ? allNotes.indexOf(this.currentArpNote) : -1;
            const nextIndex =
              currentIndex >= 0
                ? (currentIndex + 1) % allNotes.length
                : 0;
            this.currentArpNote = allNotes[nextIndex];
            this.synth.triggerAttack(this.currentArpNote, now);
          } else {
            this.currentArpNote = null;
          }
        }, 60000 / this.state.bpm / 2);
        break;
      }
      case 'harp': {
        this.stopArp();
        const allNotes = [...noteStrings];
        chordMidi.forEach((m) => {
          allNotes.push(this.midiToNote(m + 12));
          this.activeNotesModes.set(this.midiToNote(m + 12), 'harp');
        });
        const preset = SOUND_PRESETS[this.state.sound % SOUND_PRESETS.length];
        allNotes.forEach((note, i) => this.synth?.triggerAttackRelease(note, preset.release + 0.5, t0 + i * 0.03));
        break;
      }
    }
    return this.getChordName(rootMidi);
  }

  releaseNote(noteIndex: number): void {
    if (!this.synth || !this.bassSynth) return;
    const entry = this.activeVoices.get(noteIndex);
    if (!entry) return;
    const now = Tone.now();
    entry.notes.forEach((note) => this.synth!.triggerRelease(note, now));
    this.bassSynth.triggerRelease(entry.bassNote, now);
    entry.notes.forEach((note) => this.activeNotesModes.delete(note));
    this.activeVoices.delete(noteIndex);
    this.currentChordNotes = this.getAllActiveChordNotes();
    if (this.activeVoices.size === 0) this.state.currentNote = -1;
    if (this.state.performanceMode === 'arp' && this.activeVoices.size === 0) this.stopArp();
  }

  releaseSpecificNote(noteToRelease: string): void {
    if (!this.synth || !this.bassSynth) return;
    this.synth.triggerRelease(noteToRelease, Tone.now());
    this.activeNotesModes.delete(noteToRelease);
    for (const [keyIndex, entry] of this.activeVoices.entries()) {
      if (entry.notes.includes(noteToRelease)) {
        entry.notes = entry.notes.filter((n) => n !== noteToRelease);
        if (entry.notes.length === 0) {
          this.bassSynth.triggerRelease(entry.bassNote, Tone.now());
          this.activeVoices.delete(keyIndex);
        }
      }
    }
    this.currentChordNotes = this.getAllActiveChordNotes();
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
    if (!this.synth) return [];
    type VoiceLike = { envelope: { value: number }; frequency: { value: number } };
    const synthWithVoices = this.synth as unknown as { _voices?: VoiceLike[] };
    const voices = synthWithVoices._voices;
    if (!voices) {
      return this.currentChordNotes.map(note => ({
        note,
        mode: this.activeNotesModes.get(note) || this.state.performanceMode,
      }));
    }
    const activeNotes: Array<{ note: string; mode: PerformanceMode }> = [];
    const seenNotes = new Set<string>();
    voices.forEach((voice: VoiceLike) => {
      const env = voice.envelope;
      if (env && env.value > 0.01) {
        const note = Tone.Frequency(voice.frequency.value).toNote();
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
