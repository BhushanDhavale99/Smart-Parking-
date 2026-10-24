import React from "react";
import { cn } from "@/lib/utils";

export interface StarBorderProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  className?: string;
  color?: string;
  speed?: string;
  children: React.ReactNode;
}

export function StarBorder({
  as: Component = "button",
  className = "",
  color = "oklch(0.69 0.15 190)",
  speed = "6s",
  children,
  ...props
}: StarBorderProps) {
  return (
    <Component
      className={cn(
        "relative inline-block overflow-hidden rounded-xl p-[1px] transition-all duration-300 focus:outline-none",
        className,
      )}
      {...props}
    >
      <div
        className="absolute inset-[-100%] animate-[spin_6s_linear_infinite]"
        style={{
          background: `conic-gradient(from 0deg, transparent 0 340deg, ${color} 360deg)`,
          animationDuration: speed,
        }}
      />
      <div className="relative size-full rounded-xl bg-background/90 backdrop-blur-md px-4 py-2">
        {children}
      </div>
    </Component>
  );
}

export default StarBorder;
