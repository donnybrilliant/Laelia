import { cn } from '@/lib/utils';

interface DisplayProps {
  chord: string;
  keyName: string;
  bpm: number;
  sound: string;
  mode: string;
  className?: string;
}

export function Display({ chord, keyName, bpm, sound, mode, className }: DisplayProps) {
  return (
    <div className={cn('synth-display p-4 w-full', className)}>
      <div className="flex flex-col items-center gap-2">
        {/* Fixed min-width to prevent layout shift - longest chord is like "D#sus4maj796" */}
        <div className="synth-display-text text-3xl sm:text-4xl font-display font-bold tracking-wide min-h-[40px] min-w-[180px] text-center">
          {chord || '—'}
        </div>
        <div className="flex items-center justify-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">KEY</span>
            <span className="synth-display-text">{keyName}</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">BPM</span>
            <span className="synth-display-text">{bpm}</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">SND</span>
            <span className="synth-display-text uppercase">{sound}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-muted-foreground">MODE</span>
          <span className="synth-display-text uppercase">{mode}</span>
        </div>
      </div>
    </div>
  );
}
