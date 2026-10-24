import React, { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Spark {
  id: number;
  x: number;
  y: number;
  angle: number;
}

export interface ClickSparkProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  sparkColor?: string;
  sparkCount?: number;
  sparkRadius?: number;
  duration?: number;
  className?: string;
}

export function ClickSpark({
  children,
  sparkColor = "#06b6d4",
  sparkCount = 8,
  sparkRadius = 24,
  duration = 320,
  className = "",
  ...props
}: ClickSparkProps) {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const nextId = useRef(0);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newSparks: Spark[] = Array.from({ length: sparkCount }).map((_, i) => ({
        id: nextId.current++,
        x,
        y,
        angle: (i * 360) / sparkCount,
      }));

      setSparks((prev) => [...prev, ...newSparks]);

      setTimeout(() => {
        setSparks((prev) => prev.filter((s) => !newSparks.some((ns) => ns.id === s.id)));
      }, duration);
    },
    [sparkCount, duration]
  );

  return (
    <div
      className={cn("relative inline-block", className)}
      onClickCapture={handleClick}
      {...props}
    >
      {children}

      <div className="pointer-events-none absolute inset-0 overflow-visible z-50">
        {sparks.map((spark) => {
          const rad = (spark.angle * Math.PI) / 180;
          const endX = Math.cos(rad) * sparkRadius;
          const endY = Math.sin(rad) * sparkRadius;

          return (
            <span
              key={spark.id}
              className="absolute pointer-events-none rounded-full"
              style={{
                left: spark.x,
                top: spark.y,
                width: 3,
                height: 3,
                backgroundColor: sparkColor,
                boxShadow: `0 0 6px ${sparkColor}`,
                transform: `translate(-50%, -50%) rotate(${spark.angle}deg)`,
                animation: `spark-burst ${duration}ms cubic-bezier(0.25, 1, 0.5, 1) forwards`,
                ["--spark-x" as any]: `${endX}px`,
                ["--spark-y" as any]: `${endY}px`,
              }}
            />
          );
        })}
      </div>

      <style>{`
        @keyframes spark-burst {
          0% {
            transform: translate(-50%, -50%) translate3d(0, 0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) translate3d(var(--spark-x), var(--spark-y), 0) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default ClickSpark;
