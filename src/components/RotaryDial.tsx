import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RotaryDialProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  displayValue?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function RotaryDial({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  displayValue,
  size = "md",
  className,
}: RotaryDialProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  /** Track a single active pointer so keyboard and controls can be used at the same time */
  const activePointerId = useRef<number | null>(null);

  const sizeClasses = {
    xs: "w-8 h-8",
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-20 h-20",
  };
  const indicatorSizes = {
    xs: "w-0.5 h-1.5",
    sm: "w-1 h-2",
    md: "w-1.5 h-3",
    lg: "w-2 h-4",
  };
  const normalizedValue = (value - min) / (max - min);
  const rotation = -135 + normalizedValue * 270;

  const updateFromClientY = useCallback(
    (clientY: number) => {
      const deltaY = startY.current - clientY;
      const sensitivity = (max - min) / 150;
      let newValue = Math.max(
        min,
        Math.min(max, startValue.current + deltaY * sensitivity),
      );
      newValue = Math.round(newValue / step) * step;
      onChange(newValue);
    },
    [max, min, onChange, step],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();

      activePointerId.current = e.pointerId;
      startY.current = e.clientY;
      startValue.current = value;
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [value],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== e.pointerId) return;
      e.preventDefault();
      updateFromClientY(e.clientY);
    },
    [updateFromClientY],
  );

  const finishDrag = useCallback((pointerId: number) => {
    if (activePointerId.current !== pointerId) return;
    activePointerId.current = null;
    setIsDragging(false);
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      finishDrag(e.pointerId);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Capture may already be released.
      }
    },
    [finishDrag],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      finishDrag(e.pointerId);
    },
    [finishDrag],
  );

  const handleLostPointerCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      finishDrag(e.pointerId);
    },
    [finishDrag],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const stepAmount = (max - min) * 0.05;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        onChange(Math.min(max, Math.round((value + stepAmount) / step) * step));
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        onChange(Math.max(min, Math.round((value - stepAmount) / step) * step));
      }
    },
    [max, min, onChange, step, value],
  );

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        onKeyDown={handleKeyDown}
        className={cn(
          "synth-dial flex items-center justify-center",
          sizeClasses[size],
          isDragging && "ring-2 ring-primary/50",
        )}
        style={{ touchAction: "none" }}
      >
        <div
          className="relative w-full h-full flex items-center justify-center"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div
            className={cn(
              "synth-dial-indicator absolute top-1",
              indicatorSizes[size],
            )}
          />
        </div>
      </div>
      <div className="text-center">
        <div
          className={cn(
            "uppercase tracking-wider text-muted-foreground font-medium",
            size === "xs" ? "text-[8px]" : "text-[10px]",
          )}
        >
          {label}
        </div>
        {displayValue && (
          <div
            className={cn(
              "font-mono text-foreground mt-0.5",
              size === "xs" ? "text-[9px]" : "text-xs",
            )}
          >
            {displayValue}
          </div>
        )}
      </div>
    </div>
  );
}
