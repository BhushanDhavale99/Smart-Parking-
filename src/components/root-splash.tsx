import { useEffect } from "react";
import parkGridLogo from "@/assets/parkgrid-logo.png";
import { AnimatedLogo } from "@/components/animated-logo";

interface RootSplashProps {
  exiting?: boolean;
}

export function RootSplash({ exiting = false }: RootSplashProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "ParkGrid";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <div
      role="status"
      aria-label="Loading ParkGrid"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#060913] text-foreground select-none transition-opacity duration-300 ease-out motion-reduce:transition-none ${
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-250 motion-reduce:animate-none">
        <div className="grid size-16 sm:size-20 place-items-center overflow-hidden rounded-2xl border border-primary/40 bg-background/80 shadow-[0_0_32px_rgba(0,229,255,0.25)]">
          <AnimatedLogo
            src={parkGridLogo}
            alt="ParkGrid"
            preset="static"
            className="size-full"
            imgClassName="object-contain p-2"
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="font-display text-lg font-bold tracking-wider text-white">PARKGRID</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary/80">
            BKC · Mumbai
          </span>
        </div>
      </div>
    </div>
  );
}
