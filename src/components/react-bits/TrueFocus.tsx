import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TrueFocusProps {
  sentence?: string;
  manualMode?: boolean;
  blurAmount?: number;
  borderColor?: string;
  glowColor?: string;
  animationDuration?: number;
  pauseBetweenAnimations?: number;
  className?: string;
}

export function TrueFocus({
  sentence = "Smart Simple Fast Secure",
  manualMode = false,
  blurAmount = 4,
  borderColor = "oklch(0.69 0.15 190)",
  glowColor = "rgba(6, 182, 212, 0.4)",
  animationDuration = 0.5,
  pauseBetweenAnimations = 1.2,
  className = "",
}: TrueFocusProps) {
  const words = sentence.split(" ");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastActiveIndex, setLastActiveIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [focusRect, setFocusRect] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (manualMode) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, (animationDuration + pauseBetweenAnimations) * 1000);

    return () => clearInterval(interval);
  }, [manualMode, animationDuration, pauseBetweenAnimations, words.length]);

  useEffect(() => {
    if (currentIndex === null || currentIndex === -1) return;
    if (!wordRefs.current[currentIndex] || !containerRef.current) return;

    const parentRect = containerRef.current.getBoundingClientRect();
    const activeRect = wordRefs.current[currentIndex]!.getBoundingClientRect();

    setFocusRect({
      x: activeRect.left - parentRect.left,
      y: activeRect.top - parentRect.top,
      width: activeRect.width,
      height: activeRect.height,
    });
  }, [currentIndex, words.length]);

  const handleMouseEnter = (index: number) => {
    if (manualMode) {
      setLastActiveIndex(index);
      setCurrentIndex(index);
    }
  };

  const handleMouseLeave = () => {
    if (manualMode) {
      setCurrentIndex(lastActiveIndex ?? 0);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex flex-wrap items-center gap-x-2 gap-y-1 py-1", className)}
    >
      {words.map((word, index) => {
        const isActive = index === currentIndex;
        return (
          <span
            key={index}
            ref={(el) => {
              wordRefs.current[index] = el;
            }}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
            className="relative cursor-pointer transition-all duration-300 select-none"
            style={{
              filter: isActive ? "blur(0px)" : `blur(${blurAmount}px)`,
              opacity: isActive ? 1 : 0.45,
            }}
          >
            {word}
          </span>
        );
      })}

      <motion.div
        className="pointer-events-none absolute rounded-md border"
        animate={{
          x: focusRect.x - 4,
          y: focusRect.y - 2,
          width: focusRect.width + 8,
          height: focusRect.height + 4,
          opacity: focusRect.width > 0 ? 1 : 0,
        }}
        transition={{
          duration: animationDuration,
          ease: "easeInOut",
        }}
        style={{
          borderColor,
          boxShadow: `0 0 16px ${glowColor}`,
        }}
      >
        <span
          className="absolute -top-[3px] -left-[3px] size-1.5 border-t-2 border-l-2"
          style={{ borderColor }}
        />
        <span
          className="absolute -top-[3px] -right-[3px] size-1.5 border-t-2 border-r-2"
          style={{ borderColor }}
        />
        <span
          className="absolute -bottom-[3px] -left-[3px] size-1.5 border-b-2 border-l-2"
          style={{ borderColor }}
        />
        <span
          className="absolute -bottom-[3px] -right-[3px] size-1.5 border-b-2 border-r-2"
          style={{ borderColor }}
        />
      </motion.div>
    </div>
  );
}

export default TrueFocus;
