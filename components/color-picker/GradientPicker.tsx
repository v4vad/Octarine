import React, { useRef, useState, useEffect } from 'react';
import { oklchToHex, hexToRgb } from '../../lib/color-utils';

interface GradientPickerProps {
  hue: number;
  saturation: number;  // 0-100 for HSB, 0-0.4 for OKLCH chroma
  brightness: number;  // 0-100 for HSB, 0-1 for OKLCH lightness
  mode: 'hsb' | 'oklch';
  onChange: (sat: number, bright: number) => void;
}

export function GradientPicker({ hue, saturation, brightness, mode, onChange }: GradientPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Draw the gradient
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    if (mode === 'hsb') {
      const hueColor = `hsl(${hue}, 100%, 50%)`;
      const satGradient = ctx.createLinearGradient(0, 0, width, 0);
      satGradient.addColorStop(0, 'white');
      satGradient.addColorStop(1, hueColor);
      ctx.fillStyle = satGradient;
      ctx.fillRect(0, 0, width, height);

      const brightGradient = ctx.createLinearGradient(0, 0, 0, height);
      brightGradient.addColorStop(0, 'rgba(0,0,0,0)');
      brightGradient.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = brightGradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      const imageData = ctx.createImageData(width, height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const l = 1 - (y / height);
          const c = (x / width) * 0.4;
          const hex = oklchToHex({ l, c, h: hue });
          const rgb = hexToRgb(hex);
          const i = (y * width + x) * 4;
          imageData.data[i] = rgb.r;
          imageData.data[i + 1] = rgb.g;
          imageData.data[i + 2] = rgb.b;
          imageData.data[i + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    let posX: number, posY: number;
    if (mode === 'hsb') {
      posX = (saturation / 100) * width;
      posY = (1 - brightness / 100) * height;
    } else {
      posX = (saturation / 0.4) * width;
      posY = (1 - brightness) * height;
    }

    ctx.beginPath();
    ctx.arc(posX, posY, 6, 0, 2 * Math.PI);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(posX, posY, 7, 0, 2 * Math.PI);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hue, saturation, brightness, mode]);

  const handleMouse = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (mode === 'hsb') {
      onChange(x * 100, (1 - y) * 100);
    } else {
      onChange(x * 0.4, 1 - y);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      className="gradient-canvas"
      onMouseDown={(e) => { setIsDragging(true); handleMouse(e); }}
      onMouseMove={(e) => { if (isDragging) handleMouse(e); }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    />
  );
}
