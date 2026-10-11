import { useEffect, useRef, useState } from "react";

export interface AnimatedLogoProps {
  src: string;
  alt?: string;
  size?: number | string;
  animated?: boolean;
  colorOverrides?: {
    outline?: string;
    halo?: string;
    strand?: string;
  };
  className?: string;
  imgClassName?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return [0, 229, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// In-memory cache for Sobel-derived outline images (src + colors -> dataURL)
const outlineCache = new Map<string, string>();

/**
 * Computes a sharp neon outline from a raster image using Sobel gradient filtering.
 * Draws to an offscreen 256x256 canvas, caches the result, and returns a PNG data URL.
 */
function extractSobelOutline(
  img: HTMLImageElement,
  outlineColor: string,
  onComplete: (dataUrl: string) => void,
) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  ctx.drawImage(img, 0, 0, size, size);

  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(0, 0, size, size);
  } catch (err) {
    console.warn("AnimatedLogo: unable to read image pixels for Sobel filter", err);
    return;
  }

  const srcData = imgData.data;
  const [outR, outG, outB] = hexToRgb(outlineColor);

  // Sample corner pixels to detect background color
  const sampleCorner = (x: number, y: number) => {
    const idx = (y * size + x) * 4;
    return [
      srcData[idx] ?? 0,
      srcData[idx + 1] ?? 0,
      srcData[idx + 2] ?? 0,
      srcData[idx + 3] ?? 255,
    ];
  };

  const corners = [
    sampleCorner(2, 2),
    sampleCorner(size - 3, 2),
    sampleCorner(2, size - 3),
    sampleCorner(size - 3, size - 3),
  ];
  const bgR = corners.reduce((sum, c) => sum + (c[0] ?? 0), 0) / 4;
  const bgG = corners.reduce((sum, c) => sum + (c[1] ?? 0), 0) / 4;
  const bgB = corners.reduce((sum, c) => sum + (c[2] ?? 0), 0) / 4;

  const intensities = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const alpha = (srcData[idx + 3] ?? 255) / 255;
      if (alpha < 0.95) {
        intensities[y * size + x] = alpha;
      } else {
        const r = srcData[idx] ?? 0;
        const g = srcData[idx + 1] ?? 0;
        const b = srcData[idx + 2] ?? 0;
        const diff = Math.max(Math.abs(r - bgR), Math.abs(g - bgG), Math.abs(b - bgB));
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        intensities[y * size + x] = Math.min(1.0, Math.max(diff / 48, lum / 255));
      }
    }
  }

  // Sobel convolution
  const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  const outCanvas = document.createElement("canvas");
  outCanvas.width = size;
  outCanvas.height = size;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return;

  const outImgData = outCtx.createImageData(size, size);
  const outData = outImgData.data;

  const threshold = 0.35;

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      let gx = 0;
      let gy = 0;
      let k = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const val = intensities[(y + dy) * size + (x + dx)] ?? 0;
          gx += val * Gx[k]!;
          gy += val * Gy[k]!;
          k++;
        }
      }

      const mag = Math.hypot(gx, gy);
      if (mag > threshold) {
        const outIdx = (y * size + x) * 4;
        const edgeAlpha = Math.min(1.0, (mag - threshold) * 2.2);
        outData[outIdx] = outR;
        outData[outIdx + 1] = outG;
        outData[outIdx + 2] = outB;
        outData[outIdx + 3] = Math.round(edgeAlpha * 255);
      }
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  const dataUrl = outCanvas.toDataURL("image/png");
  onComplete(dataUrl);
}

export function AnimatedLogo({
  src,
  alt = "ParkGrid Logo",
  size,
  animated = true,
  colorOverrides,
  className = "",
  imgClassName = "object-contain",
}: AnimatedLogoProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [outlineUrl, setOutlineUrl] = useState<string | null>(null);

  // Animation states: 7-second loop + rotating traveling strands
  const [strandAngle, setStrandAngle] = useState(0);
  const [macroOpacity, setMacroOpacity] = useState(1);
  const [redrawAngle, setRedrawAngle] = useState(360);

  const outlineColor = colorOverrides?.outline || "#00E5FF";
  const haloColor = colorOverrides?.halo || "#0288D1";
  const strandColor = colorOverrides?.strand || "#FF9F1C";

  const cacheKey = `${src}_${outlineColor}`;

  // Client-only mounting check
  useEffect(() => {
    setIsMounted(true);
    if (typeof window === "undefined") return;

    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    mql.addEventListener("change", handleMotionChange);

    return () => {
      window.removeEventListener("resize", handleResize);
      mql.removeEventListener("change", handleMotionChange);
    };
  }, []);

  // Compute Sobel outline once and cache it
  useEffect(() => {
    if (!isMounted) return;

    if (outlineCache.has(cacheKey)) {
      setOutlineUrl(outlineCache.get(cacheKey)!);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      extractSobelOutline(img, outlineColor, (dataUrl) => {
        outlineCache.set(cacheKey, dataUrl);
        setOutlineUrl(dataUrl);
      });
    };
    img.src = src;
  }, [isMounted, src, outlineColor, cacheKey]);

  // 7-second macro animation loop and traveling light strands
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (!isMounted || !animated || reducedMotion || !outlineUrl) return;

    startTimeRef.current = performance.now();
    lastTimeRef.current = performance.now();
    let isVisible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;

    const frame = (now: number) => {
      if (!isVisible) return;

      animRef.current = requestAnimationFrame(frame);

      // Cap at ~30 FPS (33ms per frame) for optimal performance
      const elapsedSinceLast = now - lastTimeRef.current;
      if (elapsedSinceLast < 33) return;
      lastTimeRef.current = now;

      const totalElapsed = (now - startTimeRef.current) / 1000;

      // 1. Continuous travelling light strands (rotates 360 deg every 3.5s)
      const currentStrandAngle = (totalElapsed * 102.8) % 360;
      setStrandAngle(currentStrandAngle);

      // 2. 7-second macro loop:
      // - 0.0s to 4.5s (4.5s): steady glow
      // - 4.5s to 5.3s (0.8s): dim almost to dark
      // - 5.3s to 7.0s (1.7s): thin outline redraws and brightens back
      const loopTime = totalElapsed % 7.0;

      if (loopTime < 4.5) {
        // Steady glow
        setMacroOpacity(1.0);
        setRedrawAngle(360);
      } else if (loopTime < 5.3) {
        // Dim almost to dark (0.8s duration)
        const dimProgress = (loopTime - 4.5) / 0.8;
        // Smoothly fall from 1.0 to 0.1
        const op = 0.1 + 0.9 * Math.max(0, 1 - dimProgress);
        setMacroOpacity(op);
        setRedrawAngle(360);
      } else {
        // Redraw and brighten back (1.7s duration)
        const redrawProgress = (loopTime - 5.3) / 1.7;
        // Cubic ease-out
        const eased = redrawProgress * redrawProgress * (3 - 2 * redrawProgress);
        const op = 0.1 + 0.9 * eased;
        setMacroOpacity(op);
        setRedrawAngle(eased * 360);
      }
    };

    const handleVisibility = () => {
      isVisible = document.visibilityState === "visible";
      if (isVisible) {
        lastTimeRef.current = performance.now();
        animRef.current = requestAnimationFrame(frame);
      } else if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isMounted, animated, reducedMotion, outlineUrl]);

  const sizeStyle = typeof size === "number" ? { width: size, height: size } : {};

  // Halo filter: tuned lighter for mobile
  const haloFilter = isMobile
    ? `drop-shadow(0 0 2px ${outlineColor}) drop-shadow(0 0 5px ${haloColor})`
    : `drop-shadow(0 0 3px ${outlineColor}) drop-shadow(0 0 8px ${haloColor}) drop-shadow(0 0 14px ${haloColor}88)`;

  return (
    <div className={`relative inline-block select-none ${className}`} style={sizeStyle}>
      {/* Base Layer: Original logo (always present as fallback & base) */}
      <img src={src} alt={alt} className={`w-full h-full block relative z-10 ${imgClassName}`} />

      {/* Effect Layer 1: Neon Outline & Soft Halo (aria-hidden) */}
      {isMounted && outlineUrl && (
        <div
          className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-75"
          aria-hidden="true"
          style={{
            opacity: reducedMotion ? 0.9 : macroOpacity,
            filter: haloFilter,
            // During redraw phase (5.3s - 7.0s), wipe the outline into view
            maskImage:
              redrawAngle < 360 && !reducedMotion
                ? `conic-gradient(from 0deg at 50% 50%, #fff 0deg, #fff ${redrawAngle}deg, transparent ${redrawAngle}deg, transparent 360deg)`
                : "none",
            WebkitMaskImage:
              redrawAngle < 360 && !reducedMotion
                ? `conic-gradient(from 0deg at 50% 50%, #fff 0deg, #fff ${redrawAngle}deg, transparent ${redrawAngle}deg, transparent 360deg)`
                : "none",
          }}
        >
          <img src={outlineUrl} alt="" className={`w-full h-full block ${imgClassName}`} />
        </div>
      )}

      {/* Effect Layer 2: Travelling Light Strands with Conic-Gradient Mask (aria-hidden) */}
      {isMounted && outlineUrl && !reducedMotion && animated && (
        <div
          className="absolute inset-0 pointer-events-none z-30 mix-blend-screen"
          aria-hidden="true"
          style={{
            opacity: macroOpacity,
            filter: `drop-shadow(0 0 4px #ffffff) drop-shadow(0 0 8px ${outlineColor})`,
            maskImage: `conic-gradient(from ${strandAngle}deg at 50% 50%, transparent 0deg, #00E5FF 25deg, transparent 55deg, transparent 165deg, ${strandColor} 190deg, transparent 225deg, transparent 360deg)`,
            WebkitMaskImage: `conic-gradient(from ${strandAngle}deg at 50% 50%, transparent 0deg, #00E5FF 25deg, transparent 55deg, transparent 165deg, ${strandColor} 190deg, transparent 225deg, transparent 360deg)`,
          }}
        >
          <img
            src={outlineUrl}
            alt=""
            className={`w-full h-full block brightness-150 ${imgClassName}`}
          />
        </div>
      )}
    </div>
  );
}
