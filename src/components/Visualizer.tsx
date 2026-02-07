import { useRef, useEffect, useCallback } from "react";
import { audioEngine, PerformanceMode } from "@/lib/audioEngine";

interface VisualizerProps {
  isActive: boolean;
  hasActiveNotes: boolean;
  performanceMode: PerformanceMode;
}

// Performance mode colors matching the ModeButton colors
const MODE_COLORS: Record<PerformanceMode, { main: string; faded: string }> = {
  poly: { main: 'rgb(6, 182, 212)', faded: 'rgba(6, 182, 212, 0.2)' },      // cyan-500
  strum: { main: 'rgb(245, 158, 11)', faded: 'rgba(245, 158, 11, 0.2)' },   // amber-500
  arp: { main: 'rgb(217, 70, 239)', faded: 'rgba(217, 70, 239, 0.2)' },     // fuchsia-500
  harp: { main: 'rgb(16, 185, 129)', faded: 'rgba(16, 185, 129, 0.2)' },    // emerald-500
};

export function Visualizer({ isActive, hasActiveNotes, performanceMode }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isResizedRef = useRef(false);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();

    // Only update if we have valid dimensions
    if (rect.width > 0 && rect.height > 0) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        ctx.scale(dpr, dpr);
      }
      isResizedRef.current = true;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      // Ensure canvas has been properly sized
      if (!isResizedRef.current) {
        resizeCanvas();
      }

      const parent = canvas.parentElement;
      if (!parent) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Only draw waveform if there are active notes
      if (hasActiveNotes) {
        const data = audioEngine.getWaveformData();
        const colors = MODE_COLORS[performanceMode];

        // Draw waveform with performance mode color
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors.main;
        ctx.shadowColor = colors.main;
        ctx.shadowBlur = 8;

        const sliceWidth = width / data.length;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
          const y = ((data[i] + 1) / 2) * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();

        // Draw center line with faded color
        ctx.beginPath();
        ctx.strokeStyle = colors.faded;
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    if (isActive) {
      // Small delay to ensure parent has dimensions
      requestAnimationFrame(() => {
        resizeCanvas();
        draw();
      });
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, hasActiveNotes, performanceMode, resizeCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;

    // Initial resize after a brief delay to ensure layout is complete
    const timeoutId = setTimeout(resizeCanvas, 50);

    // Use ResizeObserver on parent for more reliable resize detection
    resizeObserverRef.current = new ResizeObserver(() => {
      isResizedRef.current = false;
      resizeCanvas();
    });

    if (parent) {
      resizeObserverRef.current.observe(parent);
    }
    resizeObserverRef.current.observe(canvas);

    // Also listen to window resize as fallback
    window.addEventListener("resize", resizeCanvas);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", resizeCanvas);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [resizeCanvas]);

  return <canvas ref={canvasRef} className="block w-full h-full" />;
}
