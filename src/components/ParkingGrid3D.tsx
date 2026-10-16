// Adapted from the supplied Bolt grid; the base app owns floors and selection.
import { useRef, useState, useEffect, useId, type CSSProperties, type PointerEvent } from "react";
import { motion, type MotionStyle } from "framer-motion";
import {
  CarFront,
  Bike,
  Zap,
  Accessibility,
  Check,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParkingSlotData, LevelCode } from "@/lib/parking-data";
import { LEVEL_CONFIG } from "@/lib/parking-data";
import { useReducedMotion, useVisible } from "./effects/useParkingMotion";
import { MapEffects } from "./effects/ParkingEffects";

interface Props {
  slots: ParkingSlotData[];
  selectedSlot: ParkingSlotData | null;
  onSelectSlot: (slot: ParkingSlotData) => void;
  activeFloor: LevelCode | string | number;
  pulsing?: string | null;
}
const INITIAL = { x: 35, y: -10 };
const COLORS: Record<string, string> = {
  available: "var(--available)",
  occupied: "var(--destructive)",
  reserved: "var(--reserved)",
  selected: "var(--selected)",
  maintenance: "var(--muted-foreground)",
  blocked: "var(--muted-foreground)",
};

export default function ParkingGrid3D({
  slots,
  selectedSlot,
  onSelectSlot,
  activeFloor,
  pulsing,
}: Props) {
  const reduced = useReducedMotion();
  const { ref, visible } = useVisible<HTMLDivElement>();
  const host = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(INITIAL);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const drag = useRef({ x: 0, y: 0, rotX: 0, rotY: 0, moved: false });
  const infoId = useId();
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const resize = () => setFit(Math.min(1, Math.max(0.4, (element.clientWidth - 24) / 440)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    drag.current.moved = false;
    if (event.pointerType === "touch" || event.button !== 0) return;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      rotX: rotation.x,
      rotY: rotation.y,
      moved: false,
    };
    setDragging(true);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = event.clientX - drag.current.x,
      dy = event.clientY - drag.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      drag.current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setHovered(null);
      setRotation({
        x: Math.max(15, Math.min(60, drag.current.rotX - dy * 0.3)),
        y: Math.max(-40, Math.min(40, drag.current.rotY + dx * 0.3)),
      });
    }
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const info =
    slots.find((slot) => slot.id === hovered) ?? slots.find((slot) => slot.id === selectedSlot?.id);
  return (
    <div ref={ref} className="pg3d">
      <div className="pg3d-toolbar">
        <p className="text-xs text-muted-foreground">
          Level{" "}
          {typeof activeFloor === "string" && activeFloor in LEVEL_CONFIG
            ? LEVEL_CONFIG[activeFloor as LevelCode].label
            : activeFloor}{" "}
          · {slots.filter((slot) => slot.status === "available").length} available in view
        </p>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Parking map view controls">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Rotate left"
            onClick={() => setRotation((r) => ({ ...r, y: Math.max(-40, r.y - 10) }))}
          >
            <ArrowLeft />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Rotate right"
            onClick={() => setRotation((r) => ({ ...r, y: Math.min(40, r.y + 10) }))}
          >
            <ArrowRight />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zoom out"
            disabled={zoom <= 0.7}
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
          >
            <ZoomOut />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zoom in"
            disabled={zoom >= 1.3}
            onClick={() => setZoom((z) => Math.min(1.3, z + 0.15))}
          >
            <ZoomIn />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Reset map view"
            onClick={() => {
              setRotation(INITIAL);
              setZoom(1);
            }}
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Drag to rotate · Use controls to zoom or rotate on touch
      </p>
      <div
        ref={host}
        className="pg3d-scene"
        data-dragging={dragging}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => setDragging(false)}
        onPointerLeave={() => {
          if (!drag.current.moved) setDragging(false);
        }}
      >
        <div
          className="pg3d-world"
          style={{
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${fit * zoom})`,
            transition: dragging || reduced ? "none" : "transform 120ms ease-out",
          }}
        >
          <div className="pg3d-platform holo-grid-floor" aria-hidden="true" />
          {slots.map((slot, index) => {
            const selected = selectedSlot?.id === slot.id;
            const color = COLORS[selected ? "selected" : slot.status];
            const Icon =
              slot.type === "EV"
                ? Zap
                : slot.type === "Bike"
                  ? Bike
                  : slot.type === "Accessible"
                    ? Accessibility
                    : CarFront;
            return (
              <div
                key={slot.id}
                className="pg3d-position"
                style={{ left: 24 + (index % 4) * 96, top: 24 + Math.floor(index / 4) * 112 }}
              >
                <motion.button
                  type="button"
                  className={`pg3d-slot${pulsing === slot.id ? " slot-click-pulse" : ""}`}
                  aria-label={`${slot.id}, ${slot.status}, ${slot.type}, ₹${slot.price} per hour`}
                  aria-disabled={slot.status !== "available"}
                  aria-pressed={selected}
                  aria-describedby={infoId}
                  initial={false}
                  animate={{
                    opacity: !reduced && !visible ? 0 : 1,
                    scale: !reduced && !visible ? 0.97 : 1,
                  }}
                  transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : index * 0.024 }}
                  style={{ "--slot-color": color } as MotionStyle}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== "touch" && !dragging) setHovered(slot.id);
                  }}
                  onPointerLeave={() => setHovered(null)}
                  onFocus={() => setHovered(slot.id)}
                  onBlur={() => setHovered(null)}
                  onClick={(e) => {
                    if (slot.status !== "available" || (e.detail !== 0 && drag.current.moved))
                      return;
                    onSelectSlot(slot);
                  }}
                >
                  <span className="flex items-center justify-between font-mono text-xs font-bold">
                    {slot.id}
                    {selected && <Check size={14} aria-hidden="true" />}
                  </span>
                  <Icon className="parking-vehicle" size={23} aria-hidden="true" />
                  <span className="text-[10px] capitalize">
                    {selected ? "Selected" : slot.status}
                  </span>
                </motion.button>
              </div>
            );
          })}
        </div>
        <MapEffects host={host} />
      </div>
      <p id={infoId} className="pg3d-info" aria-live="polite">
        {info
          ? `${info.id} · Zone ${info.zone} · ${info.type} · ${info.status} · ₹${info.price}/hour${info.status !== "available" ? " · Cannot be selected" : ""}`
          : "Hover or focus a bay for details. Select an available bay to book."}
      </p>
    </div>
  );
}
