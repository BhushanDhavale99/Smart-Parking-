import { useEffect, useRef, useState } from "react";

export interface LightspeedProps {
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  speed?: number;
  intensity?: number;
  opacity?: number;
  streakCount?: number;
  stretchFactor?: number;
  maxFPS?: number;
  pauseWhenOffscreen?: boolean;
  interactionEnabled?: boolean;
  className?: string;
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

interface Star {
  x: number;
  y: number;
  z: number;
  speedMult: number;
  color: [number, number, number];
}

const VS_SOURCE = `
attribute vec2 aPosition;
attribute vec4 aColor;
varying vec4 vColor;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vColor = aColor;
}
`;

const FS_SOURCE = `
precision mediump float;
varying vec4 vColor;
uniform float uOpacity;

void main() {
  gl_FragColor = vec4(vColor.rgb, vColor.a * uOpacity);
}
`;

export function Lightspeed({
  primaryColor = "#00E5FF",
  secondaryColor = "#0288D1",
  tertiaryColor = "#FF9F1C",
  speed = 0.4,
  intensity = 0.9,
  opacity = 0.8,
  streakCount = 96,
  stretchFactor = 1.2,
  maxFPS = 45,
  pauseWhenOffscreen = true,
  className = "",
}: LightspeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webGlFailed, setWebGlFailed] = useState(false);

  // Client-only mount check to prevent SSR / hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    mql.addEventListener("change", handleMotionChange);
    return () => mql.removeEventListener("change", handleMotionChange);
  }, []);

  useEffect(() => {
    if (!isMounted || reducedMotion || webGlFailed) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl =
      canvas.getContext("webgl", { alpha: true, antialias: true }) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) {
      console.warn("Lightspeed: WebGL context could not be created, using static fallback.");
      setWebGlFailed(true);
      return;
    }

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) {
      console.warn("Lightspeed: Shader creation failed.");
      setWebGlFailed(true);
      return;
    }

    gl.shaderSource(vs, VS_SOURCE);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.warn("Lightspeed: Vertex shader compilation failed:", gl.getShaderInfoLog(vs));
      setWebGlFailed(true);
      return;
    }

    gl.shaderSource(fs, FS_SOURCE);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn("Lightspeed: Fragment shader compilation failed:", gl.getShaderInfoLog(fs));
      setWebGlFailed(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setWebGlFailed(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Lightspeed: Program linking failed:", gl.getProgramInfoLog(program));
      setWebGlFailed(true);
      return;
    }

    gl.useProgram(program);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    const aColor = gl.getAttribLocation(program, "aColor");
    const uOpacity = gl.getUniformLocation(program, "uOpacity");

    gl.enableVertexAttribArray(aPosition);
    gl.enableVertexAttribArray(aColor);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const stride = 6 * 4; // 6 floats per vertex, 4 bytes per float
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, stride, 2 * 4);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending for hyperspace glow

    const colors: [number, number, number][] = [
      hexToRgb(primaryColor),
      hexToRgb(secondaryColor),
      hexToRgb(tertiaryColor),
    ];

    const pickColor = (): [number, number, number] => {
      const r = Math.random();
      if (r < 0.55) return colors[0]!;
      if (r < 0.85) return colors[1]!;
      return colors[2]!;
    };

    const count = Math.max(16, streakCount);
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 100 + Math.random() * 1100;
      stars.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: 50 + Math.random() * 1950,
        speedMult: 0.8 + Math.random() * 0.4,
        color: pickColor(),
      });
    }

    // 6 vertices per streak (2 triangles), 6 floats per vertex
    const vertexData = new Float32Array(count * 36);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData.byteLength, gl.DYNAMIC_DRAW);

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    const resize = () => {
      if (!canvas || !container) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);

    let animationFrameId: number | null = null;
    let lastTime = performance.now();
    let isDocVisible =
      typeof document !== "undefined" ? document.visibilityState === "visible" : true;
    let isOffscreen = false;

    const frameInterval = 1000 / Math.max(15, maxFPS);

    const render = (now: number) => {
      if (!isDocVisible || isOffscreen) {
        return;
      }

      animationFrameId = requestAnimationFrame(render);

      const elapsed = now - lastTime;
      if (elapsed < frameInterval) return;
      lastTime = now - (elapsed % frameInterval);

      const dt = Math.min(elapsed / 1000, 0.1);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(uOpacity, opacity);

      const fov = Math.min(width, height) * 0.9;
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const speedDistance = speed * 1500 * dt;

      let vIdx = 0;

      for (let i = 0; i < count; i++) {
        const star = stars[i]!;
        star.z -= speedDistance * star.speedMult;

        if (star.z <= 30) {
          star.z = 1800 + Math.random() * 300;
          const angle = Math.random() * Math.PI * 2;
          const radius = 100 + Math.random() * 1100;
          star.x = Math.cos(angle) * radius;
          star.y = Math.sin(angle) * radius;
          star.color = pickColor();
        }

        const streakLen = speedDistance * star.speedMult * 3.5 * stretchFactor;
        const zHead = star.z;
        const zTail = star.z + streakLen;

        const hx = (star.x / zHead) * fov + centerX;
        const hy = (star.y / zHead) * fov + centerY;
        const tx = (star.x / zTail) * fov + centerX;
        const ty = (star.y / zTail) * fov + centerY;

        const dx = hx - tx;
        const dy = hy - ty;
        const len = Math.hypot(dx, dy);
        if (len < 0.5) continue;

        const nx = -dy / len;
        const ny = dx / len;

        const headW = Math.max(0.8, (1.2 + (700 / zHead) * 1.6) * intensity);
        const tailW = Math.max(0.3, 0.5 * intensity);

        // Clip-space conversion
        const toClipX = (px: number) => (px / width) * 2 - 1;
        const toClipY = (py: number) => 1 - (py / height) * 2;

        const p0x = toClipX(tx - nx * tailW);
        const p0y = toClipY(ty - ny * tailW);
        const p1x = toClipX(tx + nx * tailW);
        const p1y = toClipY(ty + ny * tailW);
        const p2x = toClipX(hx + nx * headW);
        const p2y = toClipY(hy + ny * headW);
        const p3x = toClipX(hx - nx * headW);
        const p3y = toClipY(hy - ny * headW);

        const cr = Math.min(1.0, (star.color[0] / 255) * (0.85 + intensity * 0.35));
        const cg = Math.min(1.0, (star.color[1] / 255) * (0.85 + intensity * 0.35));
        const cb = Math.min(1.0, (star.color[2] / 255) * (0.85 + intensity * 0.35));

        const tailAlpha = 0.08;
        const headAlpha = 1.0;

        // Triangle 1: P0, P1, P2
        vertexData[vIdx++] = p0x;
        vertexData[vIdx++] = p0y;
        vertexData[vIdx++] = cr;
        vertexData[vIdx++] = cg;
        vertexData[vIdx++] = cb;
        vertexData[vIdx++] = tailAlpha;

        vertexData[vIdx++] = p1x;
        vertexData[vIdx++] = p1y;
        vertexData[vIdx++] = cr;
        vertexData[vIdx++] = cg;
        vertexData[vIdx++] = cb;
        vertexData[vIdx++] = tailAlpha;

        vertexData[vIdx++] = p2x;
        vertexData[vIdx++] = p2y;
        vertexData[vIdx++] = cr;
        vertexData[vIdx++] = cg;
        vertexData[vIdx++] = cb;
        vertexData[vIdx++] = headAlpha;

        // Triangle 2: P0, P2, P3
        vertexData[vIdx++] = p0x;
        vertexData[vIdx++] = p0y;
        vertexData[vIdx++] = cr;
        vertexData[vIdx++] = cg;
        vertexData[vIdx++] = cb;
        vertexData[vIdx++] = tailAlpha;

        vertexData[vIdx++] = p2x;
        vertexData[vIdx++] = p2y;
        vertexData[vIdx++] = cr;
        vertexData[vIdx++] = cg;
        vertexData[vIdx++] = cb;
        vertexData[vIdx++] = headAlpha;

        vertexData[vIdx++] = p3x;
        vertexData[vIdx++] = p3y;
        vertexData[vIdx++] = cr;
        vertexData[vIdx++] = cg;
        vertexData[vIdx++] = cb;
        vertexData[vIdx++] = headAlpha;
      }

      const vertCount = vIdx / 6;
      if (vertCount > 0) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexData.subarray(0, vIdx));
        gl.drawArrays(gl.TRIANGLES, 0, vertCount);
      }
    };

    const resumeAnimation = () => {
      if (animationFrameId === null && isDocVisible && !isOffscreen) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };

    const pauseAnimation = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    // Tab visibility handling
    const handleVisibility = () => {
      isDocVisible = document.visibilityState === "visible";
      if (isDocVisible && !isOffscreen) {
        resumeAnimation();
      } else {
        pauseAnimation();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // pauseWhenOffscreen via IntersectionObserver
    let observer: IntersectionObserver | null = null;
    if (pauseWhenOffscreen && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          isOffscreen = entry ? !entry.isIntersecting : false;
          if (!isOffscreen && isDocVisible) {
            resumeAnimation();
          } else {
            pauseAnimation();
          }
        },
        { threshold: 0.05 },
      );
      observer.observe(container);
    }

    resumeAnimation();

    return () => {
      pauseAnimation();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (observer) observer.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [
    isMounted,
    reducedMotion,
    webGlFailed,
    primaryColor,
    secondaryColor,
    tertiaryColor,
    speed,
    intensity,
    opacity,
    streakCount,
    stretchFactor,
    maxFPS,
    pauseWhenOffscreen,
  ]);

  if (!isMounted || reducedMotion || webGlFailed) {
    return <div className={`w-full h-full bg-[#060913] ${className}`} aria-hidden="true" />;
  }

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />
    </div>
  );
}
