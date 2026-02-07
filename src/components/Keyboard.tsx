import { useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';

interface KeyboardProps {
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  activeNotes: Set<number>;
}

const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11, 12];
const BLACK_KEY_DATA = [
  { note: 1, afterWhiteIndex: 0 },
  { note: 3, afterWhiteIndex: 1 },
  { note: 6, afterWhiteIndex: 3 },
  { note: 8, afterWhiteIndex: 4 },
  { note: 10, afterWhiteIndex: 5 },
];

// Physical key codes (layout-independent)
const KEY_CODE_MAP: Record<string, number> = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12,
};

// All keys for hit detection
const ALL_KEYS = [...WHITE_KEYS, ...BLACK_KEY_DATA.map(k => k.note)];

export function Keyboard({ onNoteOn, onNoteOff, activeNotes }: KeyboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activePointersRef = useRef<Map<number, number>>(new Map()); // pointerId -> note
  const keyboardKeysRef = useRef<Set<number>>(new Set()); // Currently held keyboard keys

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

  // Get note from screen coordinates
  const getNoteFromPoint = useCallback((clientX: number, clientY: number): number | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Out of bounds
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;

    const relativeX = (x / rect.width) * 100;
    const relativeY = y / rect.height;

    // Check black keys first (they're on top and only in upper 60%)
    if (relativeY < 0.6) {
      for (const { note, left, width } of blackKeys) {
        if (relativeX >= left && relativeX <= left + width) {
          return note;
        }
      }
    }

    // Check white keys
    const whiteKeyIndex = Math.floor(relativeX / whiteKeyWidthPercent);
    if (whiteKeyIndex >= 0 && whiteKeyIndex < WHITE_KEYS.length) {
      return WHITE_KEYS[whiteKeyIndex];
    }

    return null;
  }, [blackKeys, whiteKeyWidthPercent]);

  // Handle pointer down - start tracking this pointer
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    
    // Capture this pointer to receive all its events
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    
    const note = getNoteFromPoint(e.clientX, e.clientY);
    if (note !== null) {
      activePointersRef.current.set(e.pointerId, note);
      onNoteOn(note);
    }
  }, [getNoteFromPoint, onNoteOn]);

  // Handle pointer move - for sliding across keys
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Only process if this pointer is being tracked (was pressed down on keyboard)
    if (!activePointersRef.current.has(e.pointerId)) return;

    const currentNote = activePointersRef.current.get(e.pointerId);
    const newNote = getNoteFromPoint(e.clientX, e.clientY);

    // If moved to a different key
    if (newNote !== currentNote) {
      // Release old note if there was one
      if (currentNote !== undefined) {
        onNoteOff(currentNote);
      }
      
      // Play new note if there is one
      if (newNote !== null) {
        activePointersRef.current.set(e.pointerId, newNote);
        onNoteOn(newNote);
      } else {
        // Moved out of keyboard area
        activePointersRef.current.delete(e.pointerId);
      }
    }
  }, [getNoteFromPoint, onNoteOn, onNoteOff]);

  // Handle pointer up/cancel - stop tracking this pointer
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const note = activePointersRef.current.get(e.pointerId);
    if (note !== undefined) {
      onNoteOff(note);
      activePointersRef.current.delete(e.pointerId);
    }
    
    // Release pointer capture
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, [onNoteOff]);

  // Keyboard input handling
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return;
      const note = KEY_CODE_MAP[e.code];
      if (note !== undefined && !keyboardKeysRef.current.has(note)) {
        e.preventDefault();
        keyboardKeysRef.current.add(note);
        onNoteOn(note);
      }
    },
    [onNoteOn]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const note = KEY_CODE_MAP[e.code];
      if (note !== undefined && keyboardKeysRef.current.has(note)) {
        e.preventDefault();
        keyboardKeysRef.current.delete(note);
        onNoteOff(note);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activePointersRef.current.clear();
      keyboardKeysRef.current.clear();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* White keys */}
      <div className="absolute inset-0 flex gap-[2px]">
        {WHITE_KEYS.map((note) => (
          <div
            key={`white-${note}`}
            className={cn('synth-key-white flex-1 h-full', activeNotes.has(note) && 'pressed')}
            aria-label={`White key ${note}`}
          />
        ))}
      </div>

      {/* Black keys */}
      {blackKeys.map(({ note, left, width }) => (
        <div
          key={`black-${note}`}
          className={cn('synth-key-black absolute top-0 h-[60%] z-10', activeNotes.has(note) && 'pressed')}
          style={{ left: `${left}%`, width: `${width}%` }}
          aria-label={`Black key ${note}`}
        />
      ))}
    </div>
  );
}
