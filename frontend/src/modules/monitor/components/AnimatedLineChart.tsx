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
    const padding = { top: 16, right: 24, bottom: 30, left: 48 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // 计算 nicenum（0.5 / 1 / 2 / 5 / 10 / 20 / 50 / 100 ...）让 Y 轴刻度是人类可读的整数
    const niceNum = (range: number, round: boolean): number => {
      const exp = Math.floor(Math.log10(range));
      const fraction = range / Math.pow(10, exp);
      let niceFraction;
      if (round) {
        if (fraction < 1.5) niceFraction = 1;
        else if (fraction < 3) niceFraction = 2;
        else if (fraction < 7) niceFraction = 5;
        else niceFraction = 10;
      } else {
        if (fraction <= 1) niceFraction = 1;
        else if (fraction <= 2) niceFraction = 2;
        else if (fraction <= 5) niceFraction = 5;
        else niceFraction = 10;
      }
      return niceFraction * Math.pow(10, exp);
    };

    const rawMax = Math.max(...data.map(d => d.value));
    const rawMin = Math.min(0, Math.min(...data.map(d => d.value)));
    const rawRange = rawMax - rawMin;
    // 防止全 0 或常数数据时退化
    const tmpRange = rawRange < 1 ? 1 : rawRange;
    const niceStep = niceNum(tmpRange, false);
    // 自适应上限：至少保证上方有 20% 视觉余量
    const chartMaxCeil = Math.max(rawMax * 1.2, niceStep * 1.2);
    const niceStepUp = niceNum(chartMaxCeil, true);
    const maxValue = Math.ceil(chartMaxCeil / niceStepUp) * niceStepUp;
    const minValue = 0;
    const range = Math.max(maxValue - minValue, niceStepUp);

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
    ctx.textBaseline = 'middle';

    // 用 niceStep 计算合适的刻度数量（>= 2, <= 6）
    const tickCount = Math.max(2, Math.min(6, Math.round(range / niceStepUp)));
    for (let i = 0; i <= tickCount; i++) {
      const value = (maxValue / tickCount) * i;
      const y = getY(value);
      ctx.fillText(value.toFixed(0), padding.left - 6, y);

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
