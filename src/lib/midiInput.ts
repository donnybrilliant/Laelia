export interface MidiCallbacks {
  noteOn: (note: number, velocity: number, source: string) => boolean;
  noteOff: (note: number, source: string) => void;
  controlChange: (controller: number, value: number) => void;
}

interface MidiChannel {
  inputId: string;
  channel: number;
  sustain: boolean;
  held: Set<number>;
  sounding: Set<number>;
}

/** MIDI owns its notes by port and channel, including notes held by the pedal. */
export class MidiInput {
  private channels = new Map<string, MidiChannel>();
  private callbacks: MidiCallbacks;

  constructor(callbacks: MidiCallbacks) {
    this.callbacks = callbacks;
  }

  private source(state: MidiChannel, note: number): string {
    return JSON.stringify(['midi', state.inputId, state.channel, note]);
  }

  private release(state: MidiChannel, note: number): void {
    if (!state.sounding.delete(note)) return;
    this.callbacks.noteOff(note - 48, this.source(state, note));
  }

  receive(inputId: string, data: Uint8Array): void {
    if (data.length !== 3) return;
    const [status, note, value] = data;
    const command = status & 0xf0;
    if (![0x80, 0x90, 0xb0].includes(command) || note > 127 || value > 127) return;
    const channel = status & 0x0f;
    const key = JSON.stringify([inputId, channel]);
    let state = this.channels.get(key);
    if (!state) {
      state = { inputId, channel, sustain: false, held: new Set(), sounding: new Set() };
      this.channels.set(key, state);
    }

    if (command === 0x90 && value > 0) {
      if (this.callbacks.noteOn(note - 48, value / 127, this.source(state, note))) {
        state.held.add(note);
        state.sounding.add(note);
      }
    } else if (command === 0x80 || command === 0x90) {
      state.held.delete(note);
      if (!state.sustain) this.release(state, note);
    } else if (note === 64) {
      state.sustain = value >= 64;
      if (!state.sustain) {
        for (const sounding of state.sounding) {
          if (!state.held.has(sounding)) this.release(state, sounding);
        }
      }
    } else if (note === 120 || note === 123) {
      // Treat the controller's panic messages as an immediate release for this channel.
      state.held.clear();
      state.sustain = false;
      for (const sounding of state.sounding) this.release(state, sounding);
    } else if (note === 121) {
      state.sustain = false;
      for (const sounding of state.sounding) {
        if (!state.held.has(sounding)) this.release(state, sounding);
      }
    } else if (note === 1 || note === 7) {
      this.callbacks.controlChange(note, value / 127);
    }
  }

  releaseInput(inputId?: string): void {
    for (const [key, state] of this.channels) {
      if (inputId !== undefined && state.inputId !== inputId) continue;
      for (const note of state.sounding) this.release(state, note);
      this.channels.delete(key);
    }
  }
}
