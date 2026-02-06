import { cn } from '@/lib/utils';

type ColorVariant = 'primary' | 'cyan' | 'amber' | 'fuchsia' | 'emerald';

interface ModeButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  colorVariant?: ColorVariant;
  className?: string;
}

const activeColorClasses: Record<ColorVariant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--synth-glow)/0.4)]',
  cyan: 'bg-cyan-500 text-cyan-950 shadow-[0_0_16px_rgba(6,182,212,0.5)]',
  amber: 'bg-amber-500 text-amber-950 shadow-[0_0_16px_rgba(245,158,11,0.5)]',
  fuchsia: 'bg-fuchsia-500 text-fuchsia-950 shadow-[0_0_16px_rgba(217,70,239,0.5)]',
  emerald: 'bg-emerald-500 text-emerald-950 shadow-[0_0_16px_rgba(16,185,129,0.5)]',
};

export function ModeButton({ label, isActive, onClick, colorVariant = 'primary', className }: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'synth-button px-2 py-1.5 text-xs uppercase tracking-wider select-none',
        'flex items-center justify-center',
        isActive && activeColorClasses[colorVariant],
        className
      )}
    >
      <span className="font-mono font-medium">{label}</span>
    </button>
  );
}
