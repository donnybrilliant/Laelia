import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DialPrecisionEditor,
  type PrecisionOption,
  type FxSettings,
} from "./DialPrecisionEditor";

interface RotaryDialBaseProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  displayValue?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  /** When "percent", the number modal shows 0–100 and converts to 0–1 (only with precisionEditor="number") */
  precisionUnit?: "percent";
  /** For precisionEditor="fxSliders": per-effect amounts and update callback */
  fxSettings?: FxSettings;
  onFxSettingsChange?: (partial: Partial<FxSettings>) => void;
}

interface RotaryDialWithNumberEditor extends RotaryDialBaseProps {
  precisionEditor: "number";
  precisionOptions?: never;
}

interface RotaryDialWithListEditor extends RotaryDialBaseProps {
  precisionEditor: "list";
  precisionOptions: PrecisionOption[];
}

interface RotaryDialWithFxSlidersEditor extends RotaryDialBaseProps {
  precisionEditor: "fxSliders";
  precisionOptions?: never;
  fxSettings: FxSettings; // required when fxSliders
  onFxSettingsChange: (partial: Partial<FxSettings>) => void;
}

interface RotaryDialWithoutEditor extends RotaryDialBaseProps {
  precisionEditor?: undefined;
  precisionOptions?: never;
}

export type RotaryDialProps =
  | RotaryDialWithNumberEditor
  | RotaryDialWithListEditor
  | RotaryDialWithFxSlidersEditor
  | RotaryDialWithoutEditor;

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
  precisionEditor,
  precisionOptions,
  precisionUnit,
  fxSettings,
  onFxSettingsChange,
}: RotaryDialProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  /** True if pointer moved (so we treat as drag, not click); opening editor only when value unchanged */
  const hasMovedRef = useRef(false);
  const dialRef = useRef<HTMLDivElement>(null);
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
      hasMovedRef.current = false;
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [value],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== e.pointerId) return;
      hasMovedRef.current = true;
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
      const wasClick = precisionEditor && !hasMovedRef.current;
      finishDrag(e.pointerId);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Capture may already be released.
      }
      if (wasClick) {
        setEditorOpen(true);
      }
    },
    [finishDrag, precisionEditor],
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
      if (precisionEditor && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        setEditorOpen(true);
        return;
      }
      const stepAmount = (max - min) * 0.05;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        onChange(Math.min(max, Math.round((value + stepAmount) / step) * step));
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        onChange(Math.max(min, Math.round((value - stepAmount) / step) * step));
      }
    },
    [max, min, onChange, step, value, precisionEditor],
  );

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        ref={dialRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        aria-haspopup={precisionEditor ? "dialog" : undefined}
        aria-keyshortcuts={precisionEditor ? "Enter Space" : undefined}
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
      {editorOpen && precisionEditor === "number" && (
        <DialPrecisionEditor
          variant="number"
          label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          unit={precisionUnit}
          onApply={(v) => {
            onChange(v);
            setEditorOpen(false);
          }}
          onClose={() => setEditorOpen(false)}
          triggerRef={dialRef}
        />
      )}
      {editorOpen && precisionEditor === "fxSliders" && fxSettings && onFxSettingsChange && (
        <DialPrecisionEditor
          variant="fxSliders"
          label={label}
          fxMacro={value}
          onFxMacroChange={onChange}
          fxSettings={fxSettings}
          onFxSettingsChange={onFxSettingsChange}
          onClose={() => setEditorOpen(false)}
          triggerRef={dialRef}
        />
      )}
      {editorOpen && precisionEditor === "list" && precisionOptions && (
        <DialPrecisionEditor
          variant="list"
          label={label}
          value={value}
          options={precisionOptions}
          onApply={(v) => {
            onChange(v);
            setEditorOpen(false);
          }}
          onClose={() => setEditorOpen(false)}
          triggerRef={dialRef}
        />
      )}
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
