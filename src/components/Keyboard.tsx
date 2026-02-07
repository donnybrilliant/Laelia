import { useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';

interface KeyboardProps {
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  activeNotes: Set<number>;
  /** Called on first pointer/key interaction - use to initialize audio */
  onFirstInteraction?: () => void;
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

export function Keyboard({ onNoteOn, onNoteOff, activeNotes, onFirstInteraction }: KeyboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track which notes are held by which input sources
  // Key: note number, Value: Set of source IDs (pointer IDs or 'keyboard')
  const noteHoldersRef = useRef<Map<number, Set<string | number>>>(new Map());
  const firstInteractionFiredRef = useRef(false);

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

  // Add a holder to a note, trigger noteOn if first holder
  const addNoteHolder = useCallback((note: number, holderId: string | number) => {
    const holders = noteHoldersRef.current;
    if (!holders.has(note)) {
      holders.set(note, new Set());
    }
    const noteHolders = holders.get(note)!;
    const wasEmpty = noteHolders.size === 0;
    noteHolders.add(holderId);
    
    if (wasEmpty) {
      onNoteOn(note);
    }
  }, [onNoteOn]);

  // Remove a holder from a note, trigger noteOff if last holder
  const removeNoteHolder = useCallback((note: number, holderId: string | number) => {
    const holders = noteHoldersRef.current;
    const noteHolders = holders.get(note);
    if (!noteHolders) return;
    
    noteHolders.delete(holderId);
    
    if (noteHolders.size === 0) {
      holders.delete(note);
      onNoteOff(note);
    }
  }, [onNoteOff]);

  // Get the note currently held by a pointer (if any)
  const getPointerNote = useCallback((pointerId: number): number | null => {
    for (const [note, holders] of noteHoldersRef.current.entries()) {
      if (holders.has(pointerId)) {
        return note;
      }
    }
    return null;
  }, []);

  // Fire first interaction callback
  const fireFirstInteraction = useCallback(() => {
    if (!firstInteractionFiredRef.current && onFirstInteraction) {
      firstInteractionFiredRef.current = true;
      onFirstInteraction();
    }
  }, [onFirstInteraction]);

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    fireFirstInteraction();
    
    // Capture pointer on container
    containerRef.current?.setPointerCapture(e.pointerId);
    
    const note = getNoteFromPoint(e.clientX, e.clientY);
    if (note !== null) {
      addNoteHolder(note, e.pointerId);
    }
  }, [getNoteFromPoint, addNoteHolder, fireFirstInteraction]);

  // Handle pointer move - for sliding across keys
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const currentNote = getPointerNote(e.pointerId);
    if (currentNote === null) return; // Not tracking this pointer
    
    const newNote = getNoteFromPoint(e.clientX, e.clientY);
    
    if (newNote !== currentNote) {
      // Remove from old note
      removeNoteHolder(currentNote, e.pointerId);
      
      // Add to new note (if on a key)
      if (newNote !== null) {
        addNoteHolder(newNote, e.pointerId);
      }
    }
  }, [getNoteFromPoint, getPointerNote, addNoteHolder, removeNoteHolder]);

  // Handle pointer up/cancel/leave/lostcapture - stop tracking this pointer
  const handlePointerEnd = useCallback((e: React.PointerEvent) => {
    const currentNote = getPointerNote(e.pointerId);
    if (currentNote !== null) {
      removeNoteHolder(currentNote, e.pointerId);
    }
    
    // Release pointer capture
    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore - capture may already be released
    }
  }, [getPointerNote, removeNoteHolder]);

  // Keyboard input handling
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return;
      const note = KEY_CODE_MAP[e.code];
      if (note === undefined) return;
      
      // Check if keyboard is already holding this note
      const holders = noteHoldersRef.current.get(note);
      if (holders?.has('keyboard')) return;
      
      e.preventDefault();
      fireFirstInteraction();
      addNoteHolder(note, 'keyboard');
    },
    [addNoteHolder, fireFirstInteraction]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const note = KEY_CODE_MAP[e.code];
      if (note === undefined) return;
      
      const holders = noteHoldersRef.current.get(note);
      if (!holders?.has('keyboard')) return;
      
      e.preventDefault();
      removeNoteHolder(note, 'keyboard');
    },
    [removeNoteHolder]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Cleanup on unmount only - release all notes
  // Using a ref to store onNoteOff so we don't re-run when callback changes
  const onNoteOffRef = useRef(onNoteOff);
  onNoteOffRef.current = onNoteOff;
  
  useEffect(() => {
    return () => {
      // Release all held notes on unmount
      const noteHolders = noteHoldersRef.current;
      for (const [note, holders] of noteHolders.entries()) {
        if (holders.size > 0) {
          onNoteOffRef.current(note);
        }
      }
      noteHolders.clear();
    };
  }, []); // Empty deps - only run on unmount

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
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
