import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface DitheringShaderProps {
  shape?: "wave" | "clouds";
  type?: "8x8" | "4x4";
  colorBack?: string;
  colorFront?: string;
  pxSize?: number;
  speed?: number;
  className?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  let cleaned = hex.replace("#", "").trim();
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

const bayer8x8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

const bayer4x4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

export const DitheringShader: React.FC<DitheringShaderProps> = ({
  shape = "wave",
  type = "8x8",
  colorBack = "#001122",
  colorFront = "#ff0088",
  pxSize = 3,
  speed = 0.6,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;
    let startTime = performance.now();

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.max(32, Math.floor(rect.width * dpr));
      const targetH = Math.max(32, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        isVisible = entry.isIntersecting;
      }
    });
    observer.observe(canvas);

    const onVisibilityChange = () => {
      isVisible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const bayer = type === "4x4" ? bayer4x4 : bayer8x8;
    const bayerDim = type === "4x4" ? 4 : 8;
    const bayerMax = type === "4x4" ? 16 : 64;

    const rgbBack = hexToRgb(colorBack);
    const rgbFront = hexToRgb(colorFront);

    const render = (now: number) => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const t = ((now - startTime) / 1000) * speed;
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const step = Math.max(1, Math.floor(pxSize));
      const cols = Math.ceil(width / step);
      const rows = Math.ceil(height / step);

      // Create or reuse imageData buffer
      const imgData = ctx.createImageData(cols, rows);
      const data = imgData.data;

      for (let y = 0; y < rows; y++) {
        const ny = y / rows;
        for (let x = 0; x < cols; x++) {
          const nx = x / cols;
          let val = 0;

          if (shape === "wave") {
            const w1 = Math.sin(nx * 6.0 + t * 1.5 + ny * 2.0);
            const w2 = Math.cos(ny * 8.0 - t * 1.0 + nx * 4.0);
            const w3 = Math.sin((nx + ny) * 5.0 + t * 0.8);
            val = (w1 + w2 + w3 + 3.0) / 6.0;
          } else {
            // clouds
            const c1 = Math.sin(nx * 4.0 + t * 0.5) * Math.cos(ny * 4.0 + t * 0.3);
            const c2 = Math.sin(nx * 8.0 - t * 0.4) * Math.sin(ny * 8.0 + t * 0.6);
            val = (c1 * 0.6 + c2 * 0.4 + 1.0) / 2.0;
          }

          // Bayer threshold
          const bx = x % bayerDim;
          const by = y % bayerDim;
          const threshold = bayer[by * bayerDim + bx] / bayerMax;

          const isFront = val > threshold;
          const r = isFront ? rgbFront[0] : rgbBack[0];
          const g = isFront ? rgbFront[1] : rgbBack[1];
          const b = isFront ? rgbFront[2] : rgbBack[2];

          const idx = (y * cols + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }

      // Draw low-res pixel grid scaled to canvas size with nearest neighbor
      createImageBitmap(imgData).then((bmp) => {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bmp, 0, 0, width, height);
        bmp.close();
      }).catch(() => {
        // Fallback for environments where createImageBitmap is not supported
        ctx.putImageData(imgData, 0, 0);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [shape, type, colorBack, colorFront, pxSize, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 h-full w-full pointer-events-none", className)}
    />
  );
};
