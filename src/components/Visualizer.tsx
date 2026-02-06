import { useRef, useEffect } from 'react';
import { audioEngine } from '@/lib/audioEngine';

interface VisualizerProps {
  isActive: boolean;
}

export function Visualizer({ isActive }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const data = audioEngine.getWaveformData();
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      const style = getComputedStyle(canvas);
      const primaryHsl = style.getPropertyValue('--primary').trim();
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `hsl(${primaryHsl})`;
      ctx.shadowColor = `hsl(${primaryHsl})`;
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
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${primaryHsl} / 0.2)`;
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };

    if (isActive) draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />;
}
