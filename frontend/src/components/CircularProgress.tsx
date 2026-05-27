import { useEffect, useRef } from 'react';

interface CircularProgressProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  showValue?: boolean;
}

export default function CircularProgress({
  value,
  maxValue = 100,
  size = 120,
  strokeWidth = 8,
  color = '#3b82f6',
  label,
  showValue = true,
}: CircularProgressProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const safeValue = Number.isFinite(value) ? value : 0;
    const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 100;
    const safeSize = Number.isFinite(size) && size > 0 ? size : 120;
    const safeStrokeWidth = Number.isFinite(strokeWidth) && strokeWidth > 0 ? strokeWidth : 8;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = safeSize * dpr;
    canvas.height = safeSize * dpr;
    ctx.scale(dpr, dpr);

    const center = safeSize / 2;
    const radius = (safeSize - safeStrokeWidth) / 2;
    const percentage = Math.min(Math.max(safeValue / safeMax, 0), 1);
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + percentage * Math.PI * 2;

    ctx.clearRect(0, 0, safeSize, safeSize);

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = safeStrokeWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, 0, safeSize, safeSize);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + '80');

    ctx.beginPath();
    ctx.arc(center, center, radius, startAngle, endAngle);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = safeStrokeWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (percentage < 1) {
      const glowX = center + Math.cos(endAngle) * radius;
      const glowY = center + Math.sin(endAngle) * radius;
      
      if (Number.isFinite(glowX) && Number.isFinite(glowY)) {
        const glowGradient = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, safeStrokeWidth * 2);
        glowGradient.addColorStop(0, color + '60');
        glowGradient.addColorStop(1, color + '00');
        
        ctx.beginPath();
        ctx.arc(glowX, glowY, safeStrokeWidth * 2, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();
      }
    }

    if (showValue) {
      ctx.font = `bold ${safeSize * 0.22}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(percentage * 100)}%`, center, center - (label ? 8 : 0));
      
      if (label) {
        ctx.font = `${safeSize * 0.12}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(label, center, center + safeSize * 0.15);
      }
    }
  }, [value, maxValue, size, strokeWidth, color, label, showValue]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="inline-block"
    />
  );
}
