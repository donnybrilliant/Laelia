import { useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

const CLEAR_FLAG_DELAY_MS = 400;

type ButtonSize = "xs" | "sm" | "md";

interface ChordButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  variant?: "type" | "extension";
  size?: ButtonSize;
  className?: string;
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: "px-1.5 py-1 min-w-[28px] text-[10px]",
  sm: "px-2 py-1.5 min-w-[40px] text-xs",
  md: "px-3 py-2 min-w-[48px] text-sm",
};

export function ChordButton({
  label,
  isActive,
  onClick,
  variant = "type",
  size = "md",
  className,
}: ChordButtonProps) {
  const handledByPointerDown = useRef(false);
  const clearFlagTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlag = useCallback(() => {
    handledByPointerDown.current = false;
    if (clearFlagTimeoutRef.current !== null) {
      clearTimeout(clearFlagTimeoutRef.current);
      clearFlagTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (clearFlagTimeoutRef.current !== null) {
        clearTimeout(clearFlagTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (handledByPointerDown.current) {
        clearFlag();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onClick();
    },
    [onClick, clearFlag],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType !== "mouse") {
        e.preventDefault();
        if (clearFlagTimeoutRef.current !== null) {
          clearTimeout(clearFlagTimeoutRef.current);
          clearFlagTimeoutRef.current = null;
        }
        handledByPointerDown.current = true;
        onClick();
      }
    },
    [onClick],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType !== "mouse") {
        clearFlagTimeoutRef.current = setTimeout(() => {
          clearFlagTimeoutRef.current = null;
          handledByPointerDown.current = false;
        }, CLEAR_FLAG_DELAY_MS);
      }
    },
    [],
  );

  const handlePointerCancel = useCallback(() => {
    if (clearFlagTimeoutRef.current !== null) {
      clearTimeout(clearFlagTimeoutRef.current);
      clearFlagTimeoutRef.current = null;
    }
    handledByPointerDown.current = false;
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={cn(
        "synth-button select-none",
        "flex items-center justify-center",
        sizeClasses[size],
        isActive &&
          "bg-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--synth-glow)/0.4)]",
        variant === "extension" && size !== "xs" && "text-xs",
        className,
      )}
    >
      <span className="font-mono font-semibold">{label}</span>
    </button>
  );
}
