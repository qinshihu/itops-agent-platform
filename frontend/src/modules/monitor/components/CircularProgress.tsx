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
    const safeColor = color && typeof color === 'string' ? color : '#3b82f6';

    const dpr = window.devicePixelRatio || 1;
    canvas.width = safeSize * dpr;
    canvas.height = safeSize * dpr;
    ctx.scale(dpr, dpr);

    const center = safeSize / 2;
    const radius = (safeSize - safeStrokeWidth) / 2;
    const percentage = Math.min(Math.max(safeValue / safeMax, 0), 1);
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + percentage * Math.PI * 2;

    if (!Number.isFinite(center) || !Number.isFinite(radius)) return;

    ctx.clearRect(0, 0, safeSize, safeSize);

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = safeStrokeWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, 0, safeSize, safeSize);
    gradient.addColorStop(0, safeColor);
    gradient.addColorStop(1, safeColor + '80');

    ctx.beginPath();
    ctx.arc(center, center, radius, startAngle, endAngle);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = safeStrokeWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (percentage < 1 && Number.isFinite(endAngle) && Number.isFinite(radius)) {
      const cosValue = Math.cos(endAngle);
      const sinValue = Math.sin(endAngle);
      
      if (Number.isFinite(cosValue) && Number.isFinite(sinValue)) {
        const glowX = center + cosValue * radius;
        const glowY = center + sinValue * radius;
        
        if (Number.isFinite(glowX) && Number.isFinite(glowY) && Number.isFinite(safeStrokeWidth)) {
          const glowRadius = safeStrokeWidth * 2;
          if (Number.isFinite(glowRadius) && glowRadius > 0) {
            const glowGradient = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
            glowGradient.addColorStop(0, safeColor + '60');
            glowGradient.addColorStop(1, safeColor + '00');
            
            ctx.beginPath();
            ctx.arc(glowX, glowY, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = glowGradient;
            ctx.fill();
          }
        }
      }
    }

    if (showValue) {
      const fontSize = Math.max(safeSize * 0.22, 8);
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(percentage * 100)}%`, center, center - (label ? 8 : 0));
      
      if (label) {
        const labelFontSize = Math.max(safeSize * 0.12, 6);
        ctx.font = `${labelFontSize}px Inter, system-ui, sans-serif`;
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
