import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

export interface BlurTextProps {
  text: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  animationFrom?: { filter?: string; opacity?: number; transform?: string };
  animationTo?: { filter?: string; opacity?: number; transform?: string };
  easing?: (t: number) => number | string;
  onAnimationComplete?: () => void;
  style?: React.CSSProperties;
}

export function BlurText({
  text = "",
  delay = 100,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.1,
  rootMargin = "0px",
  animationFrom,
  animationTo,
  onAnimationComplete,
  style,
}: BlurTextProps) {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, amount: threshold });

  const defaultFrom =
    direction === "top"
      ? { filter: "blur(12px)", opacity: 0, transform: "translate3d(0,-24px,0)" }
      : { filter: "blur(12px)", opacity: 0, transform: "translate3d(0,24px,0)" };

  const defaultTo = {
    filter: "blur(0px)",
    opacity: 1,
    transform: "translate3d(0,0,0)",
  };

  const fromState = animationFrom || defaultFrom;
  const toState = animationTo || defaultTo;

  return (
    <span ref={ref} className={cn("inline-flex flex-wrap gap-[0.25em]", className)} style={style}>
      {elements.map((element, index) => (
        <motion.span
          key={index}
          initial={fromState}
          animate={inView ? toState : fromState}
          transition={{
            duration: 0.6,
            delay: (index * delay) / 1000,
            ease: [0.25, 0.4, 0.25, 1],
          }}
          onAnimationComplete={() => {
            if (index === elements.length - 1 && onAnimationComplete) {
              onAnimationComplete();
            }
          }}
          className="inline-block will-change-[transform,filter,opacity]"
        >
          {element === " " ? "\u00A0" : element}
        </motion.span>
      ))}
    </span>
  );
}

export default BlurText;
