import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface SquaresProps {
  direction?: "right" | "left" | "up" | "down" | "diagonal";
  speed?: number;
  borderColor?: string;
  squareSize?: number;
  hoverFillColor?: string;
  className?: string;
}

export function Squares({
  direction = "diagonal",
  speed = 0.5,
  borderColor = "rgba(255, 255, 255, 0.06)",
  squareSize = 48,
  hoverFillColor = "rgba(6, 182, 212, 0.18)",
  className = "",
}: SquaresProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridOffset = useRef({ x: 0, y: 0 });
  const hoveredSquare = useRef<{ x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    const startX = Math.floor(gridOffset.current.x / squareSize) * squareSize;
    const startY = Math.floor(gridOffset.current.y / squareSize) * squareSize;

    // Draw active hovered square
    if (hoveredSquare.current) {
      ctx.fillStyle = hoverFillColor;
      ctx.fillRect(
        hoveredSquare.current.x,
        hoveredSquare.current.y,
        squareSize,
        squareSize,
      );
    }

    // Draw grid lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = borderColor;

    for (let x = startX; x < width + squareSize; x += squareSize) {
      ctx.beginPath();
      ctx.moveTo(x - (gridOffset.current.x % squareSize), 0);
      ctx.lineTo(x - (gridOffset.current.x % squareSize), height);
      ctx.stroke();
    }

    for (let y = startY; y < height + squareSize; y += squareSize) {
      ctx.beginPath();
      ctx.moveTo(0, y - (gridOffset.current.y % squareSize));
      ctx.lineTo(width, y - (gridOffset.current.y % squareSize));
      ctx.stroke();
    }

    ctx.restore();
  }, [borderColor, hoverFillColor, squareSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      draw();
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    let animationFrameId: number;

    const animate = () => {
      switch (direction) {
        case "right":
          gridOffset.current.x = (gridOffset.current.x - speed + squareSize) % squareSize;
          break;
        case "left":
          gridOffset.current.x = (gridOffset.current.x + speed) % squareSize;
          break;
        case "up":
          gridOffset.current.y = (gridOffset.current.y + speed) % squareSize;
          break;
        case "down":
          gridOffset.current.y = (gridOffset.current.y - speed + squareSize) % squareSize;
          break;
        case "diagonal":
          gridOffset.current.x = (gridOffset.current.x - speed + squareSize) % squareSize;
          gridOffset.current.y = (gridOffset.current.y - speed + squareSize) % squareSize;
          break;
      }

      draw();
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [direction, speed, squareSize, draw]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const startX = Math.floor((mouseX + (gridOffset.current.x % squareSize)) / squareSize) * squareSize - (gridOffset.current.x % squareSize);
    const startY = Math.floor((mouseY + (gridOffset.current.y % squareSize)) / squareSize) * squareSize - (gridOffset.current.y % squareSize);

    hoveredSquare.current = { x: startX, y: startY };
  };

  const handleMouseLeave = () => {
    hoveredSquare.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("pointer-events-auto size-full", className)}
    />
  );
}

export default Squares;
