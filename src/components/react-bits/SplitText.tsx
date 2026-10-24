import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  by?: "words" | "chars";
  threshold?: number;
  rootMargin?: string;
  textAlign?: "left" | "center" | "right";
  onAnimationComplete?: () => void;
  style?: React.CSSProperties;
}

export function SplitText({
  text = "",
  className = "",
  delay = 40,
  duration = 0.55,
  by = "words",
  threshold = 0.1,
  rootMargin = "-20px",
  textAlign = "left",
  onAnimationComplete,
  style,
}: SplitTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(containerRef, { once: true, amount: threshold });

  const items = by === "words" ? text.split(" ") : text.split("");

  return (
    <span
      ref={containerRef}
      className={cn("inline-flex flex-wrap items-baseline", className)}
      style={{
        textAlign,
        ...style,
      }}
      aria-label={text}
    >
      {items.map((item, index) => {
        const isSpace = item === " ";
        return (
          <span
            key={index}
            className="inline-block overflow-hidden pb-1"
            style={{ marginRight: by === "words" ? "0.28em" : isSpace ? "0.25em" : "0" }}
          >
            <motion.span
              className="inline-block"
              initial={{
                opacity: 0,
                y: "110%",
                filter: "blur(8px)",
              }}
              animate={
                inView
                  ? {
                      opacity: 1,
                      y: 0,
                      filter: "blur(0px)",
                    }
                  : {
                      opacity: 0,
                      y: "110%",
                      filter: "blur(8px)",
                    }
              }
              transition={{
                duration,
                delay: (index * delay) / 1000,
                ease: [0.22, 1, 0.36, 1],
              }}
              {...(index === items.length - 1 && onAnimationComplete
                ? { onAnimationComplete }
                : {})}
            >
              {item}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

export default SplitText;
