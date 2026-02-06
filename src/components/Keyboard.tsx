import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface KeyboardProps {
  onNoteOn: (note: number) => void;
  onNoteOff: () => void;
  activeNote: number;
}

const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11, 12];
const BLACK_KEY_DATA = [
  { note: 1, afterWhiteIndex: 0 },
  { note: 3, afterWhiteIndex: 1 },
  { note: 6, afterWhiteIndex: 3 },
  { note: 8, afterWhiteIndex: 4 },
  { note: 10, afterWhiteIndex: 5 },
];

// Physical key codes (layout-independent): Z = C, S = C#, X = D, D = D#, C = E, V = F, G = F#, B = G, H = G#, N = A, J = A#, M = B, Comma = high C
const KEY_CODE_MAP: Record<string, number> = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12,
};

export function Keyboard({ onNoteOn, onNoteOff, activeNote }: KeyboardProps) {
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());

  const isPressed = useCallback(
    (note: number) => pressedKeys.has(note) || activeNote === note,
    [pressedKeys, activeNote]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return;
      const note = KEY_CODE_MAP[e.code];
      if (note !== undefined) {
        e.preventDefault();
        setPressedKeys((prev) => new Set(prev).add(note));
        onNoteOn(note);
      }
    },
    [onNoteOn]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const note = KEY_CODE_MAP[e.code];
      if (note !== undefined) {
        e.preventDefault();
        setPressedKeys((prev) => {
          const next = new Set(prev);
          next.delete(note);
          return next;
        });
        onNoteOff();
      }
    },
    [onNoteOff]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const whiteKeyWidthPercent = 100 / WHITE_KEYS.length;
  const blackKeys = useMemo(
    () =>
      BLACK_KEY_DATA.map(({ note, afterWhiteIndex }) => ({
        note,
        left: (afterWhiteIndex + 1) * whiteKeyWidthPercent - whiteKeyWidthPercent * 0.3,
        width: whiteKeyWidthPercent * 0.6,
      })),
    [whiteKeyWidthPercent]
  );

  const noteOn = (note: number) => {
    setPressedKeys(new Set([note]));
    onNoteOn(note);
  };

  const noteOff = () => {
    setPressedKeys(new Set());
    onNoteOff();
  };

  return (
    <div
      className="relative w-full h-full"
      style={{ touchAction: 'none' }}
      onPointerUp={noteOff}
      onPointerCancel={noteOff}
      onPointerLeave={noteOff}
    >
      <div className="absolute inset-0 flex gap-[2px]">
        {WHITE_KEYS.map((note) => (
          <button
            key={`white-${note}`}
            type="button"
            onPointerDown={() => noteOn(note)}
            className={cn('synth-key-white flex-1 h-full', isPressed(note) && 'pressed')}
            aria-label={`White key ${note}`}
          />
        ))}
      </div>
      {blackKeys.map(({ note, left, width }) => (
        <button
          key={`black-${note}`}
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            noteOn(note);
          }}
          className={cn('synth-key-black absolute top-0 h-[60%] z-10', isPressed(note) && 'pressed')}
          style={{ left: `${left}%`, width: `${width}%` }}
          aria-label={`Black key ${note}`}
        />
      ))}
    </div>
  );
}
