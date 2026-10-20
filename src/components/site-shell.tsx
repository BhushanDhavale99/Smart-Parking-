import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  Menu,
  X,
  MapPin,
  UserRound,
  Bell,
  ArrowUpRight,
  Sparkles,
  Clock,
  Navigation,
  Mail,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  LogOut,
  Headphones,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import parkGridLogo from "@/assets/parkgrid-logo.png";
import { AnimatedLogo } from "@/components/animated-logo";
import { ThemeSelector } from "@/components/ThemeSelector";
import { NavigationProgress } from "@/components/navigation-progress";
import { useRealtimeSync } from "@/lib/realtime";
import { RootSplash } from "@/components/root-splash";

/** Lazy-loaded heavy effects — never parsed during the login phase */
const OpeningAnimation = lazy(() =>
  import("@/components/effects/OpeningAnimation").then((m) => ({ default: m.OpeningAnimation })),
);
const CustomCursor = lazy(() =>
  import("@/components/effects/CustomCursor").then((m) => ({ default: m.CustomCursor })),
);

/** Inline replay helper — dispatches the same event OpeningAnimation already listens for */
function replayParkingIntro() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("parkgrid_seen_intro");
    window.dispatchEvent(new CustomEvent("replay-parking-intro"));
  }
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mainLinks = [
  ["/", "Home"],
  ["/parking", "Parking"],
  ["/facilities", "Facilities"],
  ["/location", "Location"],
  ["/assistant", "AI Assistant"],
  ["/bookings", "My Bookings"],
] as const;

const supportLinks = [
  ["/faq", "FAQs & Help Center"],
  ["/support", "Contact Support"],
] as const;

export function BrandMark({
  compact = false,
  variant = "small",
}: {
  compact?: boolean;
  variant?: "small" | "large" | "static";
}) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-11 sm:size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-primary/25 bg-background shadow-[0_0_16px_var(--primary-glow)] transition-transform duration-200 hover:scale-[1.03]">
        <AnimatedLogo
          src={parkGridLogo}
          alt="ParkGrid One"
          preset={variant}
          className="size-full"
          imgClassName="object-cover"
        />
      </span>
      {!compact && (
        <span className="flex flex-col justify-center">
          <strong className="block font-display text-sm font-bold tracking-tight leading-none text-foreground">
            PARKGRID
          </strong>
          <small className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
            BKC · Mumbai
          </small>
        </span>
      )}
    </span>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setAuthInitialized(true);
      })
      .catch((err) => {
        console.warn("Session check failed in SiteShell:", err);
        setSession(null);
        setAuthInitialized(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (!session?.user?.id) {
      setIsAdmin(false);
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (isMounted) {
          setIsAdmin(!error && data?.role === "admin");
        }
      } catch {
        if (isMounted) setIsAdmin(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  // Single app-wide Realtime connection synchronized with user auth state
  useRealtimeSync(session, isAdmin);

  const isHomePage = path === "/";
  const isAuthPage =
    path === "/login" ||
    path === "/signup" ||
    path === "/forgot-password" ||
    path.startsWith("/auth/");

  useEffect(() => {
    const listener = () => setScrolled(window.scrollY > 24);
    listener();
    window.addEventListener("scroll", listener, { passive: true });
    return () => window.removeEventListener("scroll", listener);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    const handleLogout = async () => {
      await supabase.auth.signOut();
      sessionStorage.removeItem("parkgrid_authenticated");
      sessionStorage.removeItem("parkgrid_seen_intro");
      setSession(null);
      navigate({ to: "/login", replace: true });
    };
    window.addEventListener("parkgrid-logout", handleLogout);
    return () => window.removeEventListener("parkgrid-logout", handleLogout);
  }, [navigate]);

  useEffect(() => {
    if (!authInitialized) return;
    const isProtected =
      path === "/" ||
      [
        "/bookings",
        "/checkout",
        "/confirmation",
        "/vehicles",
        "/notifications",
        "/profile",
        "/admin",
      ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

    if (isProtected && !session) {
      if (path === "/") {
        navigate({ to: "/login", replace: true });
      } else {
        navigate({
          to: "/login",
          search: { redirect: path },
          replace: true,
        });
      }
    }
  }, [authInitialized, session, path, navigate]);

  /* Helper: is path active for a link */
  const isActive = (to: string) => path === to || (to !== "/" && path.startsWith(`${to}/`));
  /* Is any support page active */
  const supportActive = supportLinks.some(([to]) => isActive(to));

  const isAdminRoute = path === "/admin" || path.startsWith("/admin/");

  if (isHomePage && (!authInitialized || !session)) {
    return <RootSplash />;
  }

  if (isAuthPage || isAdminRoute) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <NavigationProgress />
        <main id="main-content" className="relative min-h-screen">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavigationProgress />
      <Suspense fallback={null}>
        <CustomCursor />
      </Suspense>
      <Suspense fallback={null}>
        <OpeningAnimation />
      </Suspense>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b py-2.5 sm:py-3 transition-colors duration-250",
          isHomePage && !scrolled
            ? "border-transparent bg-transparent"
            : "border-border/80 bg-background/90 shadow-sm backdrop-blur-xl",
        )}
        style={{ viewTransitionName: "site-header" }}
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link to="/" aria-label="ParkGrid One home">
            <BrandMark />
          </Link>
          <nav
            className="hidden items-center gap-1 xl:gap-1.5 lg:flex"
            aria-label="Main navigation"
          >
            {mainLinks.map(([to, label]) => {
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative whitespace-nowrap rounded-md px-2.5 xl:px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-accent/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "text-primary font-semibold after:absolute after:inset-x-2.5 xl:after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:shadow-[0_0_8px_var(--primary-glow)]"
                      : "text-muted-foreground",
                  )}
                >
                  {label}
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                to="/admin"
                aria-current={isActive("/admin") ? "page" : undefined}
                className={cn(
                  "relative whitespace-nowrap rounded-md px-2.5 xl:px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-amber-400/90 hover:text-amber-300",
                  isActive("/admin") &&
                    "text-amber-400 font-semibold after:absolute after:inset-x-2.5 xl:after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-amber-400 after:shadow-[0_0_8px_oklch(0.75_0.18_70/40%)]",
                )}
              >
                Admin
              </Link>
            )}

            {/* Support dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 xl:px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-accent/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground",
                    supportActive && "text-primary font-semibold",
                  )}
                >
                  <HelpCircle className="size-3.5" />
                  Support
                  <ChevronDown className="size-3 opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-52 p-1.5 border border-border/80 bg-popover/95 backdrop-blur-xl shadow-xl rounded-lg"
              >
                {supportLinks.map(([to, label]) => (
                  <DropdownMenuItem key={to} asChild>
                    <Link
                      to={to}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer rounded-md px-2.5 py-2 text-xs transition-colors",
                        isActive(to)
                          ? "bg-primary/15 text-primary font-semibold"
                          : "hover:bg-accent/80 text-foreground",
                      )}
                    >
                      <ChevronRight className="size-3 text-primary" />
                      {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeSelector />
            {/* Watch Intro – small icon + label near theme switcher */}
            <Button
              size="sm"
              variant="ghost"
              onClick={replayParkingIntro}
              title="Watch Opening Intro"
              className="hidden xl:inline-flex items-center gap-1.5 px-2 text-xs text-muted-foreground hover:text-cyan-400 transition-colors duration-250"
            >
              <Sparkles className="size-3.5 text-cyan-400" />
              <span className="font-mono text-[11px] uppercase tracking-wider">Intro</span>
            </Button>
            {session ? (
              <>
                <Link to="/profile" className="hidden sm:block" aria-label="Profile">
                  <Button size="icon" variant="ghost" aria-label="Profile">
                    <UserRound />
                  </Button>
                </Link>
                <Link to="/notifications" className="hidden sm:block" aria-label="Notifications">
                  <Button size="icon" variant="ghost" aria-label="Notifications">
                    <Bell />
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/login" className="hidden sm:block">
                <Button size="sm" variant="ghost" className="text-xs">
                  Sign in
                </Button>
              </Link>
            )}
            <Link to="/parking">
              <Button className="magnetic-cta">
                Book now <ArrowUpRight className="transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Button
              size="icon"
              variant="ghost"
              className="lg:hidden"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-navigation"
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 lg:hidden",
            open ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
          )}
        >
          <nav
            id="mobile-navigation"
            className="mx-4 mt-3 grid overflow-hidden rounded-2xl border border-border/80 bg-surface/98 p-3 shadow-2xl backdrop-blur-xl"
            aria-label="Mobile navigation"
          >
            <div className="grid gap-1">
              {mainLinks.map(([to, label], index) => {
                const active = path === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-primary/10 text-primary font-semibold" : "text-foreground",
                    )}
                    style={{ transitionDelay: open ? `${index * 25}ms` : "0ms" }}
                  >
                    <span>{label}</span>
                    {active && <span className="size-1.5 rounded-full bg-primary" />}
                  </Link>
                );
              })}
            </div>
            {isAdmin && (
              <Link
                to="/admin"
                aria-current={path.startsWith("/admin") ? "page" : undefined}
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium text-amber-400 transition hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>Admin Operations</span>
                <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">
                  Admin
                </span>
              </Link>
            )}
            {/* Support links in mobile nav */}
            <div className="my-2 border-t border-border/60 pt-2">
              <span className="block px-3.5 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Support &amp; Help
              </span>
              <div className="grid gap-1">
                {supportLinks.map(([to, label], index) => (
                  <Link
                    key={to}
                    to={to}
                    aria-current={path === to ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      path === to && "bg-primary/10 text-primary font-semibold",
                    )}
                    style={{
                      transitionDelay: open ? `${(mainLinks.length + index) * 25}ms` : "0ms",
                    }}
                  >
                    <ChevronRight className="size-3 text-primary" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="my-1 border-t border-border/60 px-2 pt-2">
              <span className="mb-1.5 block text-[10px] font-mono uppercase text-muted-foreground">
                Theme
              </span>
              <ThemeSelector className="w-full justify-start rounded-lg border border-border/80 py-2.5 px-3" />
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                replayParkingIntro();
              }}
              className="mt-1 flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm text-cyan-400 transition hover:bg-cyan-400/10"
            >
              <Sparkles className="size-4" /> Watch Opening Intro
            </button>
            <div className="my-2 border-t border-border/60 pt-2">
              {session ? (
                <div className="grid gap-1">
                  <Link
                    to="/profile"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm text-foreground transition hover:bg-accent"
                  >
                    <UserRound className="size-4 text-primary" /> Profile &amp; Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      window.dispatchEvent(new CustomEvent("parkgrid-logout"));
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm text-destructive transition hover:bg-destructive/10"
                  >
                    <LogOut className="size-4" /> Sign out
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 px-3.5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/20"
                >
                  <UserRound className="size-4" /> Sign in
                </Link>
              )}
            </div>
          </nav>
        </div>
      </header>
      <main id="main-content" className="relative min-h-[calc(100vh-80px)]">
        <Suspense fallback={<div className="min-h-[70vh] w-full" />}>
          <div key={path} className="page-transition-wrapper">
            {children}
          </div>
        </Suspense>
      </main>
      <Link
        to="/assistant"
        className="ai-floating-trigger group fixed bottom-4 right-4 z-40 sm:bottom-5 sm:right-5"
        style={{ viewTransitionName: "ai-floating-trigger" }}
        aria-label="Ask Parking AI"
      >
        <span className="flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-[0_8px_32px_var(--primary-glow)] transition group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-ring sm:size-14">
          <Bot className="size-6" />
        </span>
        <span className="pointer-events-none absolute right-16 top-1/2 hidden -translate-y-1/2 translate-x-2 whitespace-nowrap rounded-md bg-foreground px-3 py-2 text-xs text-background opacity-0 shadow-lg transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:block">
          Ask Parking AI
        </span>
      </Link>
      <footer className="border-t border-border bg-surface" aria-label="Site footer">
        {/* ── Top grid ── */}
        <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-10">
          {/* ── Col 1: Brand ── */}
          <div className="flex flex-col gap-4">
            <Link to="/" aria-label="ParkGrid One home">
              <BrandMark variant="static" />
            </Link>
            <p className="max-w-[260px] text-sm leading-6 text-muted-foreground">
              BKC Mumbai's premium connected parking facility — intelligent barrier-free entry,
              high-speed EV charging, and round-the-clock surveillance.
            </p>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-available/30 bg-available/10 px-3 py-1 font-mono text-[11px] text-available">
              <span className="live-dot" aria-hidden="true" />
              <span>Live · 5 Levels · 150 Bays</span>
            </div>
          </div>

          {/* ── Col 2: Explore ── */}
          <div>
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
              Explore
            </h2>
            <nav aria-label="Footer navigation" className="grid gap-2">
              {(
                [
                  ["/", "Home"],
                  ["/parking", "Parking"],
                  ["/facilities", "Facilities"],
                  ["/ev-charging", "EV Charging"],
                  ["/location", "Location"],
                  ["/assistant", "AI Assistant"],
                  ["/bookings", "My Bookings"],
                ] as const
              ).map(([to, label]) => (
                <Link
                  key={label}
                  to={to}
                  className="group flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-sm"
                >
                  <ChevronRight
                    className="size-3 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
                    aria-hidden="true"
                  />
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* ── Col 3: Visit ── */}
          <div>
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
              Visit
            </h2>
            <ul className="grid gap-4 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Bandra Kurla Complex,
                  <br />
                  Mumbai, Maharashtra 400051
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Open 24 hours · Every day
                  <br />
                  <span className="text-[11px] opacity-70">Speed limit 8 km/h inside</span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Navigation className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Near G-Block, Bandra East
                  <br />
                  <span className="text-[11px] opacity-70">
                    Automated ANPR entry &amp; exit lanes
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Headphones className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <span className="block font-medium text-foreground">24/7 Security Desk</span>
                  <a
                    href="tel:+912250004999"
                    className="text-xs transition-colors hover:text-primary"
                  >
                    +91 (022) 5000-4999
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <a
                  href="mailto:help@parkgrid.one"
                  className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  help@parkgrid.one
                </a>
              </li>
              <li>
                <Link
                  to="/location"
                  className="inline-flex items-center gap-1.5 rounded-sm text-[11px] font-medium text-primary transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Get directions <ExternalLink className="size-3" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>

          {/* ── Col 4: Legal & Support ── */}
          <div>
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
              Legal &amp; Support
            </h2>
            <ul className="grid gap-2 text-sm">
              {(
                [
                  ["/information", "Privacy Policy"],
                  ["/information", "Terms & Conditions"],
                  ["/information", "Cancellation & Refund"],
                  ["/information", "Parking Rules"],
                  ["/faq", "FAQs & Help Center"],
                  ["/support", "Contact Support"],
                ] as const
              ).map(([to, label]) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="group flex w-fit items-center gap-1 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-sm"
                  >
                    <ChevronRight
                      className="size-3 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
                      aria-hidden="true"
                    />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-10">
            <p className="text-[11px] text-muted-foreground">
              © 2026 ParkGrid One · Bandra Kurla Complex, Mumbai
            </p>
            <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground/80">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-available" />
                All Systems Operational
              </span>
              <span>·</span>
              <span>BKC · MUMBAI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
