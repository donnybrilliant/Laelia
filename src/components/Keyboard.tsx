import { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { audioEngine, NOTE_NAMES } from "@/lib/audioEngine";

interface KeyboardProps {
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  activeNotes: Set<number>;
  /** Called synchronously on pointer down so audio init runs in the same user gesture (required on mobile) */
  onPointerDownForAudio?: () => void;
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

export function Keyboard({
  onNoteOn,
  onNoteOff,
  activeNotes,
  onPointerDownForAudio,
}: KeyboardProps) {
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

  // Release every tracked input source (pointers + physical keys). Used as a last-resort safety net when
  // the pointer leaves the viewport or the tab loses focus so we never leave voices hanging.
  const releaseAllInputs = useCallback(() => {
    const notes = new Set<number>();
    activePointersRef.current.forEach((note) => notes.add(note));
    keyboardKeysRef.current.forEach((note) => notes.add(note));

    activePointersRef.current.clear();
    keyboardKeysRef.current.clear();

    notes.forEach((note) => {
      onNoteOffRef.current(note);
    });
  }, []);

  // Release a specific pointer's note if we're tracking it
  const releasePointer = useCallback(
    (pointerId: number) => {
      const note = activePointersRef.current.get(pointerId);
      if (note === undefined) return;

      activePointersRef.current.delete(pointerId);

      if (!isNoteHeldByAnySource(note)) {
        onNoteOffRef.current(note);
      }
    },
    [isNoteHeldByAnySource],
  );

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

  // Handle pointer down - start tracking this pointer (only when audio is ready)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();

      // MUST run synchronously in the same user gesture - required for mobile audio context unlock
      audioEngine.unlockAudio();
      onPointerDownForAudio?.();

      // Only track and play when engine is ready - avoids keys staying "selected" from pre-ready slides (desktop)
      // and avoids odd first-tap behavior on mobile (first tap only unlocks, next tap plays)
      if (!audioEngine.isReady()) return;

      // Capture pointer on container to ensure all events route here
      containerRef.current?.setPointerCapture(e.pointerId);

      const note = getNoteFromPoint(e.clientX, e.clientY);
      if (note !== null) {
        activePointersRef.current.set(e.pointerId, note);
        onNoteOn(note);
      }
    },
    [getNoteFromPoint, onNoteOn, onPointerDownForAudio],
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
        // Update tracking to new note first
        if (newNote !== null) {
          activePointersRef.current.set(e.pointerId, newNote);
        } else {
          activePointersRef.current.delete(e.pointerId);
        }

        // Play new note FIRST (important for arp mode to continue during slides)
        if (newNote !== null) {
          onNoteOn(newNote);
        }

        // Then release old note (if no other source is holding it)
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
      releasePointer(e.pointerId);

      // Release pointer capture
      try {
        containerRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore - capture may already be released
      }
    },
    [releasePointer],
  );

  // Keyboard input handling (only when audio is ready, same as pointer)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!audioEngine.isReady()) return;
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

  // Block Safari’s touch callout/magnifier on the keyboard (native listener needed; passive: false)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => el.removeEventListener("touchstart", onTouchStart);
  }, []);

  // Cleanup on unmount - release all held notes
  useEffect(() => {
    return () => {
      releaseAllInputs();
    };
  }, [releaseAllInputs]);

  // Global safety nets: if the pointer ends outside the keyboard or the tab loses focus, release everything.
  useEffect(() => {
    const handleGlobalPointerUp = (e: PointerEvent) =>
      releasePointer(e.pointerId);
    const handleGlobalPointerCancel = (e: PointerEvent) =>
      releasePointer(e.pointerId);
    const handleBlur = () => releaseAllInputs();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") releaseAllInputs();
    };

    // Per-pointer release only: pointerup/pointercancel release that pointer's note.
    // Do NOT listen to global touchend/touchcancel—that would release all notes when
    // the user touches a button with another finger while holding a key.
    window.addEventListener("pointerup", handleGlobalPointerUp, true);
    window.addEventListener("pointercancel", handleGlobalPointerCancel, true);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp, true);
      window.removeEventListener(
        "pointercancel",
        handleGlobalPointerCancel,
        true,
      );
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [releaseAllInputs, releasePointer]);

  // Keep mouse behavior intuitive on desktop: if the mouse leaves the keybed while dragging,
  // release the held pointer note. Touch pointers are handled strictly by pointerup/cancel.
  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      releasePointer(e.pointerId);
    },
    [releasePointer],
  );

  const handleKeyKeyDown = useCallback(
    (e: React.KeyboardEvent, note: number) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!audioEngine.isReady()) return;
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
      onPointerLeave={handlePointerLeave}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Keys in scale order (C, C#, D, ...) - fixed 2px gaps via CSS calc */}
      {keysInOrder.map(
        ({ note, isWhite, whiteIndex, afterWhiteIndex, height }) => (
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
        ),
      )}
    </div>
  );
}
