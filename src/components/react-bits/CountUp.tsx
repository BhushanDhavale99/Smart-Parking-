import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { cn } from "@/lib/utils";

export interface CountUpProps {
  to: number;
  from?: number;
  direction?: "up" | "down";
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export function CountUp({
  to,
  from = 0,
  direction = "up",
  delay = 0,
  duration = 2,
  className = "",
  startWhen = true,
  separator = ",",
  decimals = 0,
  prefix = "",
  suffix = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (!inView || !startWhen) return;

    let startTime: number | null = null;
    let animationFrameId: number;

    const startValue = from;
    const endValue = to;

    const timeoutId = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);

        // Ease-out expo curve for ultra smooth deceleration
        const easeOut =
          progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

        const current =
          direction === "up"
            ? startValue + (endValue - startValue) * easeOut
            : startValue - (startValue - endValue) * easeOut;

        setValue(current);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step);
        } else {
          setValue(endValue);
        }
      };

      animationFrameId = requestAnimationFrame(step);
    }, delay * 1000);

    return () => {
      clearTimeout(timeoutId);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [inView, startWhen, from, to, duration, delay, direction]);

  const formattedValue = value
    .toFixed(decimals)
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  return (
    <span ref={ref} className={cn("inline-block font-mono tracking-tight", className)}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}

export default CountUp;
