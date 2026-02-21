import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface PrecisionOption {
  value: number;
  label: string;
}

interface DialPrecisionEditorNumberProps {
  variant: "number";
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** When "percent", the editor shows 0–100 and converts to 0–1 for onApply */
  unit?: "percent";
  onApply: (value: number) => void;
  onClose: () => void;
  triggerRef: RefObject<HTMLDivElement | null>;
}

interface DialPrecisionEditorListProps {
  variant: "list";
  label: string;
  value: number;
  options: PrecisionOption[];
  onApply: (value: number) => void;
  onClose: () => void;
  triggerRef: RefObject<HTMLDivElement | null>;
}

/** Per-effect amounts 0–1; matches SynthSettings FX fields */
export interface FxSettings {
  fxDistortion: number;
  fxReverb: number;
  fxDelay: number;
  fxChorus: number;
  fxPhaser: number;
  fxTremolo: number;
}

interface DialPrecisionEditorFxSlidersProps {
  variant: "fxSliders";
  label: string;
  fxMacro: number;
  onFxMacroChange: (value: number) => void;
  fxSettings: FxSettings;
  onFxSettingsChange: (partial: Partial<FxSettings>) => void;
  onClose: () => void;
  triggerRef: RefObject<HTMLDivElement | null>;
}

export type DialPrecisionEditorProps =
  | DialPrecisionEditorNumberProps
  | DialPrecisionEditorListProps
  | DialPrecisionEditorFxSlidersProps;

const DIAL_EDITOR_ID = "dial-precision-editor";

function useFocusTrap(containerRef: RefObject<HTMLDivElement | null>, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const el = containerRef.current;
    const focusables = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    const node = el as HTMLDivElement;
    node.addEventListener("keydown", handleKeyDown as unknown as (e: Event) => void);
    return () => node.removeEventListener("keydown", handleKeyDown as unknown as (e: Event) => void);
  }, [isOpen, containerRef]);
}

function useEscapeToClose(onClose: () => void, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);
}

export function DialPrecisionEditor(props: DialPrecisionEditorProps) {
  const { onClose, triggerRef } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef, true);
  useEscapeToClose(onClose, true);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleClose = useCallback(() => {
    onClose();
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [onClose, triggerRef]);

  if (props.variant === "number") {
    return createPortal(
      <NumberEditor
        {...props}
        containerRef={containerRef}
        onClose={handleClose}
        onBackdropClick={handleBackdropClick}
      />,
      document.body,
      DIAL_EDITOR_ID,
    );
  }

  if (props.variant === "fxSliders") {
    return createPortal(
      <FxSlidersEditor
        {...props}
        containerRef={containerRef}
        onClose={handleClose}
        onBackdropClick={handleBackdropClick}
      />,
      document.body,
      DIAL_EDITOR_ID,
    );
  }

  return createPortal(
    <ListEditor
      {...props}
      containerRef={containerRef}
      onClose={handleClose}
      onBackdropClick={handleBackdropClick}
    />,
    document.body,
    DIAL_EDITOR_ID,
  );
}

function NumberEditor({
  label,
  value,
  min,
  max,
  step,
  unit,
  onApply,
  containerRef,
  onClose,
  onBackdropClick,
}: DialPrecisionEditorNumberProps & {
  containerRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onBackdropClick: (e: React.MouseEvent) => void;
}) {
  const isPercent = unit === "percent";
  const displayMin = isPercent ? 0 : min;
  const displayMax = isPercent ? 100 : max;
  const displayStep = isPercent ? 1 : step;
  const displayValue = isPercent ? Math.round(value * 100) : value;

  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(String(displayValue));

  useEffect(() => {
    setLocalValue(String(displayValue));
  }, [displayValue]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const num = Number(localValue);
      if (Number.isFinite(num)) {
        const clamped = Math.max(displayMin, Math.min(displayMax, num));
        const stepped = Math.round(clamped / displayStep) * displayStep;
        onApply(isPercent ? stepped / 100 : stepped);
      }
      onClose();
    },
    [localValue, displayMin, displayMax, displayStep, isPercent, onApply, onClose],
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dial-editor-title"
      onClick={onBackdropClick}
    >
      <div
        ref={containerRef}
        className="synth-panel rounded-lg p-4 shadow-xl min-w-[200px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="dial-editor-title"
          className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2"
        >
          {label}{isPercent ? " (%)" : ""}
        </h2>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="number"
            inputMode={displayStep >= 1 ? "numeric" : "decimal"}
            min={displayMin}
            max={displayMax}
            step={displayStep}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            aria-label={`${label} value${isPercent ? " in percent" : ""}`}
            className="w-full px-3 py-2 rounded bg-input text-foreground font-mono text-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 synth-button py-2 text-xs uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 synth-button py-2 text-xs uppercase bg-primary text-primary-foreground"
            >
              Set
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SliderRow({
  id,
  label,
  value,
  onChange,
  inputRef,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(() => String(Math.round(value * 100)));
  const valueInputRef = useRef<HTMLInputElement>(null);

  const displayValue = Math.round(value * 100);

  useEffect(() => {
    if (isEditing) {
      const input = valueInputRef.current;
      input?.focus();
      requestAnimationFrame(() => input?.select());
    }
  }, [isEditing]);

  const applyEdit = useCallback(() => {
    const num = Number(editValue);
    const clamped = Number.isFinite(num)
      ? Math.max(0, Math.min(100, num))
      : displayValue;
    const v = Math.round(clamped);
    onChange(v / 100);
    setEditValue(String(v));
    setIsEditing(false);
  }, [editValue, onChange, displayValue]);

  const handleValueKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyEdit();
      }
      if (e.key === "Escape") {
        setEditValue(String(displayValue));
        setIsEditing(false);
        valueInputRef.current?.blur();
      }
    },
    [applyEdit, displayValue],
  );

  return (
    <div className="flex items-center gap-2 py-2 min-h-[44px]">
      <label htmlFor={id} className="min-w-[5.5rem] shrink-0 text-sm font-mono tracking-wider text-foreground capitalize">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="dial-modal-range flex-1 min-w-0 cursor-pointer"
        style={{ "--range-value": `${value * 100}%` } as React.CSSProperties}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={displayValue}
        aria-valuetext={`${displayValue}%`}
      />
      <div className="w-16 min-w-[4rem] shrink-0 text-right">
        {isEditing ? (
          <input
            ref={valueInputRef}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={applyEdit}
            onKeyDown={handleValueKeyDown}
            aria-label={`${label} value`}
            className="w-full min-w-[3rem] text-right text-sm font-mono text-foreground bg-input border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset box-border"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditValue(String(displayValue));
              setIsEditing(true);
            }}
            className="w-full min-w-[3rem] text-right text-sm font-mono text-foreground hover:bg-secondary rounded px-2 py-1 border border-transparent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset box-border"
            aria-label={`${label} value, click to edit`}
          >
            {displayValue}
          </button>
        )}
      </div>
    </div>
  );
}

const FX_SLIDER_KEYS: (keyof FxSettings)[] = [
  "fxDistortion",
  "fxReverb",
  "fxDelay",
  "fxChorus",
  "fxPhaser",
  "fxTremolo",
];

const FX_SLIDER_LABELS: Record<keyof FxSettings, string> = {
  fxDistortion: "distortion",
  fxReverb: "reverb",
  fxDelay: "delay",
  fxChorus: "chorus",
  fxPhaser: "phaser",
  fxTremolo: "tremolo",
};

function FxSlidersEditor({
  label,
  fxMacro,
  onFxMacroChange,
  fxSettings,
  onFxSettingsChange,
  containerRef,
  onClose,
  onBackdropClick,
}: DialPrecisionEditorFxSlidersProps & {
  containerRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onBackdropClick: (e: React.MouseEvent) => void;
}) {
  const firstSliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstSliderRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dial-editor-title"
      aria-describedby="fx-sliders-description"
      onClick={onBackdropClick}
    >
      <div
        ref={containerRef}
        className="synth-panel rounded-lg p-4 shadow-xl w-full min-w-[280px] max-w-[min(90vw,500px)] max-h-[70vh] flex flex-col sm:min-w-[320px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="dial-editor-title"
          className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2"
        >
          {label}
        </h2>
        <p id="fx-sliders-description" className="sr-only">
          Adjust overall effect level and per-effect amounts. Use Tab to move between sliders.
        </p>
        <div className="overflow-y-auto flex-1 space-y-0.5 -mx-1 p-1 min-h-0">
          <SliderRow
            id="fx-level"
            label="level"
            value={fxMacro}
            onChange={onFxMacroChange}
            inputRef={firstSliderRef}
          />
          {FX_SLIDER_KEYS.map((key) => (
            <SliderRow
              key={key}
              id={`fx-${key}`}
              label={FX_SLIDER_LABELS[key]}
              value={fxSettings[key]}
              onChange={(value) => onFxSettingsChange({ [key]: value })}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full synth-button py-2 text-xs uppercase"
          aria-label="Close FX settings"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ListEditor({
  label,
  value,
  options,
  onApply,
  containerRef,
  onClose,
  onBackdropClick,
}: DialPrecisionEditorListProps & {
  containerRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onBackdropClick: (e: React.MouseEvent) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value)),
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedIndex((i) => (i + 1) % options.length);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedIndex((i) => (i - 1 + options.length) % options.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const opt = options[focusedIndex];
        if (opt) {
          onApply(opt.value);
          onClose();
        }
      }
    },
    [options, focusedIndex, onApply, onClose],
  );

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const opts = el.querySelectorAll<HTMLElement>("[role=option]");
    opts[focusedIndex]?.focus();
  }, [focusedIndex]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dial-editor-title"
      onClick={onBackdropClick}
    >
      <div
        ref={containerRef}
        className={cn(
          "synth-panel rounded-lg p-4 shadow-xl w-full min-w-[280px] max-w-[min(90vw,500px)] max-h-[70vh] flex flex-col sm:min-w-[320px]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="dial-editor-title"
          className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2"
        >
          {label}
        </h2>
        <div
          ref={listRef}
          role="listbox"
          aria-label={`${label} options`}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="overflow-y-auto flex-1 space-y-0.5 -mx-1 p-1"
        >
          {options.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              tabIndex={i === focusedIndex ? 0 : -1}
              className={cn(
                "w-full text-left px-3 py-2 rounded font-mono text-sm transition-colors",
                opt.value === value
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary",
              )}
              onClick={() => {
                onApply(opt.value);
                onClose();
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full synth-button py-2 text-xs uppercase"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
