import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import "./animated-logo.css";

export type AnimatedLogoPreset = "small" | "large" | "static";

export interface AnimatedLogoProps {
  src: string;
  alt?: string;
  size?: number | string;
  preset?: AnimatedLogoPreset;
  variant?: AnimatedLogoPreset;
  animated?: boolean;
  colorOverrides?: {
    outline?: string;
    halo?: string;
    strand?: string;
  };
  className?: string;
  imgClassName?: string;
  style?: CSSProperties;
}

export function AnimatedLogo({
  src,
  alt = "ParkGrid Logo",
  size,
  preset,
  variant,
  animated = true,
  colorOverrides,
  className = "",
  imgClassName = "object-contain",
  style,
}: AnimatedLogoProps) {
  const [mounted, setMounted] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (typeof window === "undefined") return;

    // Respect prefers-reduced-motion
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) {
      setReducedMotion(true);
      setHasEntered(true);
    }

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
      if (e.matches) setHasEntered(true);
    };
    mql.addEventListener("change", handleMotionChange);

    // Fallback timer ensures animation state settles even if onAnimationEnd doesn't fire
    const timer = setTimeout(() => {
      setHasEntered(true);
    }, 900);

    return () => {
      mql.removeEventListener("change", handleMotionChange);
      clearTimeout(timer);
    };
  }, []);

  const rawPreset: AnimatedLogoPreset = preset ?? variant ?? "small";
  const isStatic = !animated || rawPreset === "static" || reducedMotion;
  const isAnimating = mounted && !isStatic && !hasEntered;

  const sizeStyle: CSSProperties = {
    ...style,
    ...(size ? { width: size, height: size } : {}),
    ...(colorOverrides?.halo ? ({ "--pg-glow": colorOverrides.halo } as CSSProperties) : {}),
  };

  return (
    <div
      className={cn("parkgrid-logo-root", !isStatic && "parkgrid-logo-interactive", className)}
      style={sizeStyle}
      data-animating={isAnimating ? "true" : "false"}
      data-preset={rawPreset}
    >
      {/* Gentle cyan ambient glow that blooms and fades naturally during entrance */}
      {isAnimating && <span className="parkgrid-logo-ambient-glow" aria-hidden="true" />}

      {/* Inner logo wrapper with smooth fade-in and subtle scale-up */}
      <span className="parkgrid-logo-inner" onAnimationEnd={() => setHasEntered(true)}>
        <img
          src={src}
          alt={alt}
          className={cn("parkgrid-logo-img", imgClassName)}
          loading="eager"
          decoding="async"
        />
      </span>
    </div>
  );
}

export default AnimatedLogo;
