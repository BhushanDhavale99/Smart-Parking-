/**
 * CustomCursor – theme-aware interactive cursor.
 *
 * States
 * ──────
 * default  → small glowing dot + thin gradient ring
 * button   → ring expands, slight magnetic pull
 * book-now → stronger magnetic pull + brighter glow
 * slot     → radar / scanner ring animation
 * link     → chevron hint on the ring
 *
 * Theme colours
 * ─────────────
 * dark    → cyan / teal
 * light   → navy / teal
 * ocean   → blue / cyan
 * cyber   → neon cyan / purple
 * sunset  → orange / pink
 * premium → gold / white
 *
 * Disabled automatically when:
 *  • pointer device is coarse (touch / stylus)
 *  • prefers-reduced-motion is active
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ─── theme colour map ────────────────────────────────────────────────────────
type CursorTheme = { dot: string; ring: string; glow: string };

const THEME_COLOURS: Record<string, CursorTheme> = {
  dark: { dot: "#22d3ee", ring: "#0891b2", glow: "rgba(34,211,238,0.45)" },
  light: { dot: "#0f4c81", ring: "#0d9488", glow: "rgba(15,76,129,0.35)" },
  ocean: { dot: "#38bdf8", ring: "#0ea5e9", glow: "rgba(56,189,248,0.45)" },
  cyber: { dot: "#00fff7", ring: "#a855f7", glow: "rgba(0,255,247,0.50)" },
  sunset: { dot: "#fb923c", ring: "#ec4899", glow: "rgba(251,146,60,0.45)" },
  premium: { dot: "#fbbf24", ring: "#f9fafb", glow: "rgba(251,191,36,0.45)" },
};

function getThemeColours(): CursorTheme {
  const t = document.documentElement.getAttribute("data-theme") ?? "dark";
  return THEME_COLOURS[t] ?? (THEME_COLOURS["dark"] as CursorTheme);
}

// ─── cursor state ────────────────────────────────────────────────────────────
type CursorState = "default" | "button" | "book-now" | "slot" | "link";

function classifyTarget(el: Element | null): CursorState {
  if (!el) return "default";
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    // Parking slots
    if (node.classList.contains("pg3d-slot") || node.closest?.(".pg3d-slot")) return "slot";

    // Book now CTA
    if (
      node.classList.contains("magnetic-cta") ||
      node.getAttribute("data-cursor") === "book-now" ||
      (node.tagName === "A" && node.textContent?.toLowerCase().includes("book now")) ||
      (node.tagName === "BUTTON" && node.textContent?.toLowerCase().includes("book now"))
    )
      return "book-now";

    // Generic buttons & links
    const tag = node.tagName;
    const role = node.getAttribute("role");
    if (tag === "BUTTON" || role === "button") return "button";
    if (tag === "A" || role === "link") return "link";

    node = node.parentElement;
  }
  return "default";
}

// ─── magnetic pull helper ────────────────────────────────────────────────────
function getMagneticOffset(
  el: Element,
  mx: number,
  my: number,
  strength: number,
): { dx: number; dy: number } {
  const r = el.getBoundingClientRect();
  return {
    dx: (mx - (r.left + r.width / 2)) * strength,
    dy: (my - (r.top + r.height / 2)) * strength,
  };
}

const isBrowser = typeof window !== "undefined";

// ─── main export ─────────────────────────────────────────────────────────────
export function CustomCursor() {
  const [isFine, setIsFine] = useState(false);
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    if (isBrowser) {
      setIsFine(window.matchMedia("(pointer: fine)").matches);
      setIsReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
  }, []);

  if (!isFine || isReduced) return null;
  return <CursorImpl />;
}

// ─── implementation ───────────────────────────────────────────────────────────
function CursorImpl() {
  const rawPos = useRef({ x: -300, y: -300 });
  const smoothPos = useRef({ x: -300, y: -300 });
  const magOff = useRef({ dx: 0, dy: 0 });
  const magEl = useRef<Element | null>(null);
  const rafId = useRef(0);

  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<CursorState>("default");
  const [colours, setColours] = useState<CursorTheme>(getThemeColours);

  // Refresh colours when theme changes
  useEffect(() => {
    const mo = new MutationObserver(() => setColours(getThemeColours()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  // Track pointer
  const onMove = useCallback((e: MouseEvent) => {
    rawPos.current = { x: e.clientX, y: e.clientY };
    setState(classifyTarget(e.target as Element | null));
    magEl.current =
      (e.target as Element | null)?.closest("button, a, [role='button'], [role='link']") ?? null;
  }, []);

  const onLeave = useCallback(() => {
    rawPos.current = smoothPos.current = { x: -300, y: -300 };
    magEl.current = null;
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave, { passive: true });
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [onMove, onLeave]);

  // Animation loop
  useEffect(() => {
    const loop = () => {
      const { x: rx, y: ry } = rawPos.current;
      const { x: sx, y: sy } = smoothPos.current;

      const lx = sx + (rx - sx) * 0.14;
      const ly = sy + (ry - sy) * 0.14;
      smoothPos.current = { x: lx, y: ly };

      let mdx = 0,
        mdy = 0;
      if (magEl.current && (state === "button" || state === "book-now")) {
        const str = state === "book-now" ? 0.22 : 0.12;
        const off = getMagneticOffset(magEl.current, rx, ry, str);
        magOff.current.dx += (off.dx - magOff.current.dx) * 0.18;
        magOff.current.dy += (off.dy - magOff.current.dy) * 0.18;
      } else {
        magOff.current.dx *= 0.82;
        magOff.current.dy *= 0.82;
      }
      mdx = magOff.current.dx;
      mdy = magOff.current.dy;

      if (dotRef.current)
        dotRef.current.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      if (ringRef.current)
        ringRef.current.style.transform = `translate(${lx + mdx}px,${ly + mdy}px) translate(-50%,-50%)`;

      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, [state]);

  // Hide native cursor
  useEffect(() => {
    document.documentElement.style.cursor = "none";
    return () => {
      document.documentElement.style.cursor = "";
    };
  }, []);

  // Derived sizing
  const ringSize = state === "book-now" ? 52 : state === "button" ? 44 : state === "slot" ? 48 : 32;
  const dotSize = state === "slot" ? 6 : 8;
  const glowBlur = state === "book-now" ? 18 : state === "slot" ? 12 : 8;
  const ringOpacity = 0.85;
  const isSlot = state === "slot";
  const isLink = state === "link";

  return (
    <>
      {/* Dot */}
      <div
        ref={dotRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 99999,
          pointerEvents: "none",
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          background: colours.dot,
          boxShadow: `0 0 ${glowBlur}px ${colours.glow}, 0 0 ${glowBlur * 2}px ${colours.glow}`,
          transition:
            "width 200ms ease, height 200ms ease, background 300ms ease, box-shadow 300ms ease",
          willChange: "transform",
        }}
      />

      {/* Ring */}
      <div
        ref={ringRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 99998,
          pointerEvents: "none",
          width: ringSize,
          height: ringSize,
          borderRadius: "50%",
          border: `1.5px solid ${colours.ring}`,
          boxShadow: `0 0 ${glowBlur / 2}px ${colours.glow}`,
          opacity: ringOpacity,
          transition: [
            "width 220ms cubic-bezier(0.16, 1, 0.3, 1)",
            "height 220ms cubic-bezier(0.16, 1, 0.3, 1)",
            "border-color 300ms ease",
            "box-shadow 300ms ease",
          ].join(", "),
          willChange: "transform",
          overflow: "hidden",
        }}
      >
        {/* Radar sweep */}
        {isSlot && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: `conic-gradient(from 0deg, transparent 70%, ${colours.dot}99 100%)`,
              animation: "pg-radar-spin 1.1s linear infinite",
            }}
          />
        )}

        {/* Link chevron */}
        {isLink && (
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            style={{
              position: "absolute",
              inset: 0,
              margin: "auto",
              width: 10,
              height: 10,
              opacity: 0.85,
              fill: "none",
              stroke: colours.dot,
              strokeWidth: 2.2,
              strokeLinecap: "round",
              strokeLinejoin: "round",
            }}
          >
            <polyline points="5 3 11 8 5 13" />
          </svg>
        )}
      </div>

      {/* Keyframe injected once */}
      <style>{`@keyframes pg-radar-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
