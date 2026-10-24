import React from "react";
import { cn } from "@/lib/utils";

export interface AuroraProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  colorStops?: [string, string, string];
  amplitude?: number;
  speed?: number;
  blendMode?: React.CSSProperties["mixBlendMode"];
}

export function Aurora({
  className = "",
  colorStops = ["#06b6d4", "#10b981", "#0284c7"],
  amplitude = 1,
  speed = 1.0,
  blendMode = "screen",
  children,
  ...props
}: AuroraProps) {
  const [c1, c2, c3] = colorStops;
  const duration = 18 / speed;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden select-none",
        className
      )}
      {...props}
    >
      <div
        className="absolute -top-1/2 -left-1/4 h-[200%] w-[150%] opacity-20 filter blur-[90px]"
        style={{
          mixBlendMode: blendMode,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 20% 30%, ${c1} 0%, transparent 45%), radial-gradient(circle at 80% 40%, ${c2} 0%, transparent 40%), radial-gradient(circle at 50% 80%, ${c3} 0%, transparent 50%)`,
            animation: `aurora-drift ${duration}s ease-in-out infinite alternate`,
            willChange: "transform",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 70% 60%, ${c1} 0%, transparent 42%), radial-gradient(circle at 30% 70%, ${c2} 0%, transparent 38%)`,
            animation: `aurora-drift-reverse ${duration * 1.3}s ease-in-out infinite alternate`,
            willChange: "transform",
          }}
        />
      </div>

      {children}

      <style>{`
        @keyframes aurora-drift {
          0% {
            transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
          }
          50% {
            transform: translate3d(${12 * amplitude}%, ${-8 * amplitude}%, 0) scale(1.08) rotate(3deg);
          }
          100% {
            transform: translate3d(${-10 * amplitude}%, ${6 * amplitude}%, 0) scale(0.96) rotate(-2deg);
          }
        }
        @keyframes aurora-drift-reverse {
          0% {
            transform: translate3d(0, 0, 0) scale(1.05) rotate(0deg);
          }
          50% {
            transform: translate3d(${-12 * amplitude}%, ${10 * amplitude}%, 0) scale(0.98) rotate(-4deg);
          }
          100% {
            transform: translate3d(${8 * amplitude}%, ${-6 * amplitude}%, 0) scale(1.04) rotate(2deg);
          }
        }
      `}</style>
    </div>
  );
}

export default Aurora;
