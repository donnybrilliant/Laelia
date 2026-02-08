import { useCallback, useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface RotaryDialProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  displayValue?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
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
  size = 'md',
  className,
}: RotaryDialProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  /** Track which touch we're dragging with so multi-touch (e.g. keyboard + dial) works */
  const activeTouchId = useRef<number | null>(null);

  const sizeClasses = { xs: 'w-8 h-8', sm: 'w-12 h-12', md: 'w-16 h-16', lg: 'w-20 h-20' };
  const indicatorSizes = { xs: 'w-0.5 h-1.5', sm: 'w-1 h-2', md: 'w-1.5 h-3', lg: 'w-2 h-4' };
  const normalizedValue = (value - min) / (max - min);
  const rotation = -135 + normalizedValue * 270;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
  }, [value]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    activeTouchId.current = touch.identifier;
    startY.current = touch.clientY;
    startValue.current = value;
    setIsDragging(true);
  }, [value]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startY.current - e.clientY;
      const sensitivity = (max - min) / 150;
      let newValue = Math.max(min, Math.min(max, startValue.current + deltaY * sensitivity));
      newValue = Math.round(newValue / step) * step;
      onChange(newValue);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || activeTouchId.current === null) return;
      const touch = Array.from(e.touches).find((t) => t.identifier === activeTouchId.current);
      if (!touch) return;
      const deltaY = startY.current - touch.clientY;
      const sensitivity = (max - min) / 150;
      let newValue = Math.max(min, Math.min(max, startValue.current + deltaY * sensitivity));
      newValue = Math.round(newValue / step) * step;
      onChange(newValue);
    };
    const handleMouseUp = () => {
      activeTouchId.current = null;
      setIsDragging(false);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const ended = Array.from(e.changedTouches).some((t) => t.identifier === activeTouchId.current);
      if (ended) {
        activeTouchId.current = null;
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, min, max, step, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const stepAmount = (max - min) * 0.05;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(Math.min(max, Math.round((value + stepAmount) / step) * step));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(Math.max(min, Math.round((value - stepAmount) / step) * step));
    }
  }, [value, min, max, step, onChange]);

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div
        ref={dialRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onKeyDown={handleKeyDown}
        className={cn('synth-dial flex items-center justify-center', sizeClasses[size], isDragging && 'ring-2 ring-primary/50')}
        style={{ touchAction: 'none' }}
      >
        <div className="relative w-full h-full flex items-center justify-center" style={{ transform: `rotate(${rotation}deg)` }}>
          <div className={cn('synth-dial-indicator absolute top-1', indicatorSizes[size])} />
        </div>
      </div>
      <div className="text-center">
        <div className={cn(
          'uppercase tracking-wider text-muted-foreground font-medium',
          size === 'xs' ? 'text-[8px]' : 'text-[10px]'
        )}>
          {label}
        </div>
        {displayValue && (
          <div className={cn(
            'font-mono text-foreground mt-0.5',
            size === 'xs' ? 'text-[9px]' : 'text-xs'
          )}>
            {displayValue}
          </div>
        )}
      </div>
    </div>
  );
}
