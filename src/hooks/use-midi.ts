import { useCallback, useEffect, useRef, useState } from 'react';
import { MidiInput, type MidiCallbacks } from '@/lib/midiInput';

export type MidiStatus = 'idle' | 'connecting' | 'connected' | 'waiting' | 'unsupported' | 'error';
export interface MidiConnection {
  status: MidiStatus;
  message: string;
  connect: () => Promise<void>;
}

interface MidiOptions extends MidiCallbacks {
  ensureAudio: () => Promise<boolean>;
}

export function useMidi(options: MidiOptions): MidiConnection {
  const supported = typeof navigator.requestMIDIAccess === 'function';
  const [status, setStatus] = useState<MidiStatus>(supported ? 'idle' : 'unsupported');
  const [message, setMessage] = useState(supported
    ? 'Connect MIDI keyboard'
    : !window.isSecureContext
      ? 'MIDI needs a secure connection. Open Laelia over HTTPS or localhost.'
      : 'MIDI needs a supported browser, such as Chrome on desktop or Android.');
  const optionsRef = useRef(options);
  const sessionRef = useRef<{
    access: MIDIAccess | null;
    inputs: Map<string, MIDIInput>;
    failedInputs: Set<string>;
    midi: MidiInput;
    connecting: boolean;
    sync: () => void;
  } | null>(null);

  useEffect(() => { optionsRef.current = options; }, [options]);

  useEffect(() => {
    const midi = new MidiInput({
      noteOn: (...args) => optionsRef.current.noteOn(...args),
      noteOff: (...args) => optionsRef.current.noteOff(...args),
      controlChange: (...args) => optionsRef.current.controlChange(...args),
    });
    const session = {
      access: null as MIDIAccess | null,
      inputs: new Map<string, MIDIInput>(),
      failedInputs: new Set<string>(),
      midi,
      connecting: false,
      sync: () => {
        if (sessionRef.current !== session || !session.access) return;
        for (const [id, input] of session.inputs) {
          if (input.state === 'disconnected' || session.access.inputs.get(id) !== input) {
            input.onmidimessage = null;
            midi.releaseInput(id);
            session.inputs.delete(id);
            session.failedInputs.delete(id);
            void input.close().catch(() => {});
          }
        }
        for (const input of session.access.inputs.values()) {
          if (input.state !== 'connected' || session.inputs.has(input.id)) continue;
          session.inputs.set(input.id, input);
          input.onmidimessage = (event) => {
            if (event.data && !document.hidden && document.hasFocus()) {
              midi.receive(input.id, event.data);
            }
          };
          void input.open().catch(() => {
            if (sessionRef.current !== session || session.inputs.get(input.id) !== input || input.state !== 'connected') return;
            session.failedInputs.add(input.id);
            session.sync();
          });
        }
        if (session.failedInputs.size > 0) {
          setStatus('error');
          setMessage('Could not open the MIDI keyboard. Reconnect it and try again.');
          return;
        }
        const names = Array.from(session.inputs.values(), input => input.name || 'MIDI keyboard');
        setStatus(names.length ? 'connected' : 'waiting');
        setMessage(names.length
          ? `MIDI connected: ${names.join(', ')}`
          : 'MIDI enabled. Plug in a keyboard to start playing.');
      },
    };
    sessionRef.current = session;
    const release = () => midi.releaseInput();
    const onVisibility = () => { if (document.hidden) release(); };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      sessionRef.current = null;
      if (session.access) session.access.onstatechange = null;
      for (const input of session.inputs.values()) {
        input.onmidimessage = null;
        void input.close().catch(() => {});
      }
      release();
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!supported) return;
    const session = sessionRef.current;
    if (!session || session.connecting) return;
    session.connecting = true;
    setStatus('connecting');
    setMessage('Connecting MIDI keyboard…');
    try {
      // Start both from the click: incoming MIDI cannot unlock browser audio by itself.
      const [access, audioReady] = await Promise.all([
        session.access || navigator.requestMIDIAccess({ sysex: false }),
        optionsRef.current.ensureAudio(),
      ]);
      if (sessionRef.current !== session) return;
      if (!audioReady) throw new Error('audio');
      session.access = access;
      access.onstatechange = session.sync;
      // An open() failure is retryable with another click, even if the port stayed connected.
      for (const [id, input] of session.inputs) {
        if (input.connection === 'closed') {
          input.onmidimessage = null;
          session.midi.releaseInput(id);
          session.inputs.delete(id);
          session.failedInputs.delete(id);
        }
      }
      session.sync();
    } catch (error) {
      if (sessionRef.current !== session) return;
      setStatus('error');
      setMessage(error instanceof Error && error.message === 'audio'
        ? 'Audio could not start. Tap MIDI to try again.'
        : error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
          ? 'MIDI access was blocked. Allow MIDI in your browser’s site settings, then try again.'
          : 'Could not connect MIDI. Check the keyboard connection and try again.');
    } finally {
      session.connecting = false;
    }
  }, [supported]);

  return { status, message, connect };
}
