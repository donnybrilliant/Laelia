import { useEffect, useState } from 'react';
import type { MidiConnection } from '@/hooks/use-midi';
import { cn } from '@/lib/utils';

export function MidiButton({ connection, hidden }: { connection: MidiConnection; hidden: boolean }) {
  const [showFeedback, setShowFeedback] = useState(false);
  const { status, message, connect } = connection;

  useEffect(() => {
    if (!showFeedback || status === 'connecting') return;
    const timeout = setTimeout(() => setShowFeedback(false), 6000);
    return () => clearTimeout(timeout);
  }, [showFeedback, status, message]);

  return (
    <div className={cn('relative shrink-0 group', hidden && 'hidden')}>
      <button
        type="button"
        aria-label={message}
        aria-busy={status === 'connecting'}
        disabled={status === 'connecting'}
        onClick={() => { setShowFeedback(true); void connect(); }}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:bg-muted/50',
          status === 'connected' ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          status === 'error' && 'text-amber-400',
          status === 'unsupported' && 'opacity-50',
          status === 'connecting' && 'animate-pulse',
        )}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M10 3.25V6h4V3.25" strokeLinejoin="round" />
          <g fill="currentColor" stroke="none">
            <circle cx="6.5" cy="11" r="1.2" />
            <circle cx="8" cy="15.5" r="1.2" />
            <circle cx="12" cy="17.5" r="1.2" />
            <circle cx="16" cy="15.5" r="1.2" />
            <circle cx="17.5" cy="11" r="1.2" />
          </g>
        </svg>
      </button>
      <span role="status" className="sr-only">{message}</span>
      <div className={cn(
        'pointer-events-none absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-card p-2 text-left font-mono text-[11px] leading-relaxed text-foreground shadow-lg',
        showFeedback ? 'block' : 'hidden group-hover:block group-focus-within:block',
      )} aria-hidden="true">
        {message}
      </div>
    </div>
  );
}
