import { cn } from '@/lib/utils';

interface ChordButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  variant?: 'type' | 'extension';
  className?: string;
}

export function ChordButton({
  label,
  isActive,
  onClick,
  variant = 'type',
  className,
}: ChordButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'synth-button px-3 py-2 min-w-[48px] select-none',
        'flex items-center justify-center',
        isActive && 'bg-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--synth-glow)/0.4)]',
        variant === 'extension' && 'text-xs',
        className
      )}
    >
      <span className="font-mono font-semibold">{label}</span>
    </button>
  );
}
