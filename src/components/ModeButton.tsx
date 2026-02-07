import { cn } from '@/lib/utils';

type ColorVariant = 'primary' | 'cyan' | 'amber' | 'fuchsia' | 'emerald';
type ButtonSize = 'xs' | 'sm' | 'md';

export interface ModeButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  colorVariant?: ColorVariant;
  size?: ButtonSize;
  className?: string;
}

const activeColorClasses: Record<ColorVariant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--synth-glow)/0.4)]',
  cyan: 'bg-cyan-500 text-cyan-950 shadow-[0_0_16px_rgba(6,182,212,0.5)]',
  amber: 'bg-amber-500 text-amber-950 shadow-[0_0_16px_rgba(245,158,11,0.5)]',
  fuchsia: 'bg-fuchsia-500 text-fuchsia-950 shadow-[0_0_16px_rgba(217,70,239,0.5)]',
  emerald: 'bg-emerald-500 text-emerald-950 shadow-[0_0_16px_rgba(16,185,129,0.5)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-1.5 py-1 min-w-[28px] text-[10px]',
  sm: 'px-2 py-1.5 min-w-[40px] text-xs',
  md: 'px-3 py-2 min-w-[48px] text-sm',
};

export function ModeButton({ label, isActive, onClick, colorVariant = 'primary', size = 'md', className }: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'synth-button uppercase tracking-wider select-none',
        'flex items-center justify-center',
        sizeClasses[size],
        isActive && activeColorClasses[colorVariant],
        className
      )}
    >
      <span className="font-mono font-semibold">{label}</span>
    </button>
  );
}
