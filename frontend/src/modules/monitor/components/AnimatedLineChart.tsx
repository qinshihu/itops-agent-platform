import { useEffect, useRef } from 'react';

interface DataPoint {
  timestamp: number;
  value: number;
}

interface AnimatedLineChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  showArea?: boolean;
  lineWidth?: number;
}

export default function AnimatedLineChart({
  data,
  color = '#3b82f6',
  height = 200,
  showArea = true,
  lineWidth = 2,
}: AnimatedLineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    const maxValue = Math.max(...data.map(d => d.value)) * 1.1;
    const minValue = Math.min(0, Math.min(...data.map(d => d.value)));
    const range = Math.max(maxValue - minValue, 1);

    const getX = (index: number) => {
      if (data.length === 1) return padding.left + chartWidth / 2;
      return padding.left + (index / (data.length - 1)) * chartWidth;
    };
    const getY = (value: number) => padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].value));
    
    for (let i = 1; i < data.length; i++) {
      const prevX = getX(i - 1);
      const prevY = getY(data[i - 1].value);
      const currX = getX(i);
      const currY = getY(data[i].value);
      
      const cpX = (prevX + currX) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, currY, currX, currY);
    }

    if (showArea) {
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
      gradient.addColorStop(0, color + '40');
      gradient.addColorStop(0.5, color + '20');
      gradient.addColorStop(1, color + '00');
      
      ctx.lineTo(getX(data.length - 1), padding.top + chartHeight);
      ctx.lineTo(getX(0), padding.top + chartHeight);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].value));
    
    for (let i = 1; i < data.length; i++) {
      const prevX = getX(i - 1);
      const prevY = getY(data[i - 1].value);
      const currX = getX(i);
      const currY = getY(data[i].value);
      
      const cpX = (prevX + currX) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, currY, currX, currY);
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (data.length > 0) {
      const lastX = getX(data.length - 1);
      const lastY = getY(data[data.length - 1].value);
      
      if (Number.isFinite(lastX) && Number.isFinite(lastY)) {
        const gradient = ctx.createRadialGradient(lastX, lastY, 0, lastX, lastY, 8);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '00');
        
        ctx.beginPath();
        ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }

    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 4; i++) {
      const value = minValue + (range / 4) * i;
      const y = getY(value);
      ctx.fillText(value.toFixed(0), padding.left - 8, y + 4);
      
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [data, color, height, showArea, lineWidth]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height }}
    />
  );
}
