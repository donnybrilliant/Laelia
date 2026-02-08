import { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { NOTE_NAMES } from "@/lib/audioEngine";

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
  KeyZ: 0,
  KeyS: 1,
  KeyX: 2,
  KeyD: 3,
  KeyC: 4,
  KeyV: 5,
  KeyG: 6,
  KeyB: 7,
  KeyH: 8,
  KeyN: 9,
  KeyJ: 10,
  KeyM: 11,
  Comma: 12,
};

export function Keyboard({ onNoteOn, onNoteOff, activeNotes }: KeyboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activePointersRef = useRef<Map<number, number>>(new Map()); // pointerId -> note
  const keyboardKeysRef = useRef<Set<number>>(new Set()); // Currently held keyboard keys (note numbers)
  // Store onNoteOff in a ref so cleanup can access latest version without re-running effect
  const onNoteOffRef = useRef(onNoteOff);

  // Update ref in effect to avoid lint error about refs during render
  useEffect(() => {
    onNoteOffRef.current = onNoteOff;
  }, [onNoteOff]);

  // Check if a note is being held by any input source
  const isNoteHeldByAnySource = useCallback((note: number): boolean => {
    // Check if any pointer is holding this note
    for (const heldNote of activePointersRef.current.values()) {
      if (heldNote === note) return true;
    }
    // Check if keyboard is holding this note
    return keyboardKeysRef.current.has(note);
  }, []);

  const GAP_PX = 2;

  const blackKeys = useMemo(
    () =>
      BLACK_KEY_DATA.map(({ note, afterWhiteIndex }) => ({
        note,
        afterWhiteIndex,
      })),
    [],
  );

  // All keys in scale order (C, C#, D, ...) for correct tab order - follows document flow
  // Uses CSS calc with fixed 2px gap for consistent appearance across screen sizes
  const keysInOrder = useMemo(() => {
    const result: {
      note: number;
      isWhite: boolean;
      whiteIndex?: number;
      afterWhiteIndex?: number;
      height: number;
    }[] = [];
    for (let note = 0; note <= 12; note++) {
      const isWhite = WHITE_KEYS.includes(note);
      if (isWhite) {
        const whiteIndex = WHITE_KEYS.indexOf(note);
        result.push({
          note,
          isWhite: true,
          whiteIndex,
          height: 100,
        });
      } else {
        const black = blackKeys.find((b) => b.note === note);
        if (black) {
          result.push({
            note,
            isWhite: false,
            afterWhiteIndex: black.afterWhiteIndex,
            height: 60,
          });
        }
      }
    }
    return result;
  }, [blackKeys]);

  // Get note from screen coordinates - uses same 2px gap as layout
  const getNoteFromPoint = useCallback(
    (clientX: number, clientY: number): number | null => {
      const container = containerRef.current;
      if (!container) return null;

      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;

      const whiteKeyWidth = (rect.width - 7 * GAP_PX) / 8;
      const slotWidth = whiteKeyWidth + GAP_PX;
      const relativeY = y / rect.height;

      // Check black keys first (they're on top and only in upper 60%)
      if (relativeY < 0.6) {
        for (const { note, afterWhiteIndex } of blackKeys) {
          const left = (afterWhiteIndex + 1) * slotWidth - slotWidth * 0.3;
          const width = slotWidth * 0.6;
          if (x >= left && x <= left + width) return note;
        }
      }

      // Check white keys (with 2px gaps)
      for (let i = 0; i < WHITE_KEYS.length; i++) {
        const keyLeft = i * slotWidth;
        const keyRight = keyLeft + whiteKeyWidth;
        if (x >= keyLeft && x < keyRight) return WHITE_KEYS[i];
        // In gap between keys: snap to nearest for smooth sliding
        if (x >= keyRight && x < keyRight + GAP_PX) {
          const gapCenter = keyRight + GAP_PX / 2;
          return x < gapCenter ? WHITE_KEYS[i] : WHITE_KEYS[i + 1];
        }
      }

      return null;
    },
    [blackKeys],
  );

  // Handle pointer down - start tracking this pointer
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();

      // Capture pointer on container to ensure all events route here
      containerRef.current?.setPointerCapture(e.pointerId);

      const note = getNoteFromPoint(e.clientX, e.clientY);
      if (note !== null) {
        activePointersRef.current.set(e.pointerId, note);
        onNoteOn(note);
      }
    },
    [getNoteFromPoint, onNoteOn],
  );

  // Handle pointer move - for sliding across keys
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Only process if this pointer is being tracked (was pressed down on keyboard)
      if (!activePointersRef.current.has(e.pointerId)) return;

      const currentNote = activePointersRef.current.get(e.pointerId);
      const newNote = getNoteFromPoint(e.clientX, e.clientY);

      // If moved to a different key
      if (newNote !== currentNote) {
        // Update tracking first (before checking if note is still held)
        if (newNote !== null) {
          activePointersRef.current.set(e.pointerId, newNote);
        } else {
          activePointersRef.current.delete(e.pointerId);
        }

        // IMPORTANT: Play new note BEFORE releasing old note
        // This ensures the audio engine sees this as a slide (new voice exists before old is released)
        // which keeps the arpeggiator running instead of stopping and restarting
        if (newNote !== null) {
          onNoteOn(newNote);
        }

        // Release old note only if no other source is holding it
        if (currentNote !== undefined && !isNoteHeldByAnySource(currentNote)) {
          onNoteOff(currentNote);
        }
      }
    },
    [getNoteFromPoint, onNoteOn, onNoteOff, isNoteHeldByAnySource],
  );

  // Handle pointer up/cancel/lost capture - stop tracking this pointer
  const handlePointerEnd = useCallback(
    (e: React.PointerEvent) => {
      const note = activePointersRef.current.get(e.pointerId);
      if (note !== undefined) {
        // Update tracking first (before checking if note is still held)
        activePointersRef.current.delete(e.pointerId);

        // Only release if no other source is holding this note
        if (!isNoteHeldByAnySource(note)) {
          onNoteOff(note);
        }
      }

      // Release pointer capture
      try {
        containerRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore - capture may already be released
      }
    },
    [onNoteOff, isNoteHeldByAnySource],
  );

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
    [onNoteOn],
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const note = KEY_CODE_MAP[e.code];
      if (note !== undefined && keyboardKeysRef.current.has(note)) {
        e.preventDefault();
        // Update tracking first (before checking if note is still held)
        keyboardKeysRef.current.delete(note);

        // Only release if no other source is holding this note
        if (!isNoteHeldByAnySource(note)) {
          onNoteOff(note);
        }
      }
    },
    [onNoteOff, isNoteHeldByAnySource],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Cleanup on unmount - release all held notes
  useEffect(() => {
    // Capture refs at effect time for cleanup
    const activePointers = activePointersRef.current;
    const keyboardKeys = keyboardKeysRef.current;

    return () => {
      // Release all pointer-held notes
      for (const note of activePointers.values()) {
        onNoteOffRef.current(note);
      }
      activePointers.clear();

      // Release all keyboard-held notes
      for (const note of keyboardKeys) {
        onNoteOffRef.current(note);
      }
      keyboardKeys.clear();
    };
  }, []);

  const handleKeyKeyDown = useCallback(
    (e: React.KeyboardEvent, note: number) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!keyboardKeysRef.current.has(note)) {
          keyboardKeysRef.current.add(note);
          onNoteOn(note);
        }
      }
    },
    [onNoteOn],
  );

  const handleKeyKeyUp = useCallback(
    (e: React.KeyboardEvent, note: number) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (keyboardKeysRef.current.has(note)) {
          keyboardKeysRef.current.delete(note);
          if (!isNoteHeldByAnySource(note)) {
            onNoteOff(note);
          }
        }
      }
    },
    [onNoteOff, isNoteHeldByAnySource],
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none cursor-pointer"
      style={{
        touchAction: "none",
        ["--key-gap" as string]: "2px",
        ["--key-width" as string]: "calc((100% - 7 * var(--key-gap)) / 8)",
        ["--key-slot" as string]: "calc(var(--key-width) + var(--key-gap))",
      }}
      role="group"
      aria-label="Piano keyboard"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Keys in scale order (C, C#, D, ...) - fixed 2px gaps via CSS calc */}
      {keysInOrder.map(({ note, isWhite, whiteIndex, afterWhiteIndex, height }) => (
        <button
          key={note}
          type="button"
          className={cn(
            "absolute left-0 top-0 pointer-events-none",
            isWhite ? "synth-key-white" : "synth-key-black z-10",
            activeNotes.has(note) && "pressed",
          )}
          style={
            isWhite
              ? {
                  left: `calc(${whiteIndex!} * var(--key-slot))`,
                  width: "var(--key-width)",
                  height: `${height}%`,
                }
              : {
                  left: `calc((${afterWhiteIndex!} + 1) * var(--key-slot) - var(--key-slot) * 0.3)`,
                  width: "calc(var(--key-slot) * 0.6)",
                  height: `${height}%`,
                }
          }
          aria-label={`Piano key ${NOTE_NAMES[note % 12]}`}
          tabIndex={0}
          onKeyDown={(e) => handleKeyKeyDown(e, note)}
          onKeyUp={(e) => handleKeyKeyUp(e, note)}
        />
      ))}
    </div>
  );
}
