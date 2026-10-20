import React, { Component, useState, useEffect, type ErrorInfo, type ReactNode } from "react";
import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MapPin,
  Grid3X3,
  CalendarCheck,
  Activity,
  Users,
  CreditCard,
  Settings,
  TrendingUp,
  LogOut,
  Menu,
  X,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import parkGridLogo from "@/assets/parkgrid-logo.png";
import { AnimatedLogo } from "@/components/animated-logo";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: string;
}

const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "Operations",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/admin/map", label: "Live Map", icon: MapPin },
      { to: "/admin/slots", label: "Slots", icon: Grid3X3 },
      { to: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
      { to: "/admin/sessions", label: "Sessions", icon: Activity },
    ],
  },
  {
    group: "Management",
    items: [
      { to: "/admin/users", label: "Users & Accounts", icon: Users },
      { to: "/admin/payments", label: "Payments", icon: CreditCard },
      { to: "/admin/revenue", label: "Revenue", icon: TrendingUp },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ROUTE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/map": "Live Map",
  "/admin/slots": "Slots",
  "/admin/bookings": "Bookings",
  "/admin/sessions": "Sessions",
  "/admin/users": "Users & Accounts",
  "/admin/payments": "Payments",
  "/admin/revenue": "Revenue",
  "/admin/settings": "Settings",
};

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AdminErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AdminErrorBoundary]:", error, errorInfo);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.fallbackKey !== this.props.fallbackKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-8 text-center space-y-4 max-w-lg mx-auto my-8">
          <div className="size-12 rounded-full bg-destructive/20 text-destructive flex items-center justify-center mx-auto">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {this.state.error?.message || "An unexpected error occurred while loading this view."}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs"
          >
            Retry View
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AdminLayout({ children }: { children?: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>("admin@parkgrid.one");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setAdminEmail(session.user.email);
      }
    });
  }, []);

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem("parkgrid_authenticated");
    sessionStorage.removeItem("parkgrid_seen_intro");
    navigate({ to: "/login" });
  };

  const isItemActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.to;
    }
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  };

  const currentTitle = ROUTE_TITLES[pathname] || "Console";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Admin Top Bar ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          {/* Left: Mobile trigger, Desktop collapse, Breadcrumb */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden size-8 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex size-8 text-muted-foreground hover:text-foreground"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>

            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tracking-tight">ParkGrid Admin</span>
              <span>/</span>
              <span className="text-foreground font-medium">{currentTitle}</span>
            </div>
          </div>

          {/* Right: Email with badge, View member site, Log out */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground hidden sm:inline-block font-mono">
                {adminEmail}
              </span>
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] font-mono uppercase px-1.5 py-0 h-5"
              >
                Admin
              </Badge>
            </div>

            <div className="h-4 w-px bg-border/80 hidden sm:block" />

            <Link
              to="/"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors px-2 py-1 rounded"
              title="Return to customer site"
            >
              <span className="hidden sm:inline">View member site</span>
              <span className="sm:hidden">Site</span>
              <ExternalLink className="size-3" />
            </Link>

            <div className="h-4 w-px bg-border/80 hidden sm:block" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2 sm:px-2.5 gap-1.5"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Body: Sidebar + Main Content ── */}
      <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden lg:flex flex-col border-r border-border bg-background transition-all duration-200 shrink-0",
            collapsed ? "w-16" : "w-60",
          )}
        >
          <div
            className={cn(
              "p-3 border-b border-border/60 flex items-center h-14",
              collapsed ? "justify-center" : "gap-2.5",
            )}
          >
            <Link
              to="/"
              title={collapsed ? "ParkGrid Console" : undefined}
              className="flex items-center gap-2.5 overflow-hidden group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-md"
            >
              <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-primary/30 bg-background shadow-[0_0_12px_var(--primary-glow)]">
                <AnimatedLogo
                  src={parkGridLogo}
                  alt="ParkGrid"
                  preset="small"
                  className="size-full"
                  imgClassName="object-cover"
                />
              </div>
              {!collapsed && (
                <div className="leading-tight truncate">
                  <span className="block font-display text-xs font-semibold tracking-wider text-foreground">
                    PARKGRID
                  </span>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                    Console
                  </span>
                </div>
              )}
            </Link>
          </div>
          <nav
            className="flex-1 p-3 space-y-6 overflow-y-auto"
            aria-label="Admin desktop navigation"
          >
            {NAV_GROUPS.map((group) => (
              <div key={group.group} className="space-y-1">
                {!collapsed && (
                  <span className="block px-2.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                    {group.group}
                  </span>
                )}
                {group.items.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center rounded-md px-2.5 py-2 text-xs font-medium transition-colors group",
                        active
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent",
                        collapsed ? "justify-center px-0" : "justify-between",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            active
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-foreground",
                          )}
                        />
                        {!collapsed && <span>{item.label}</span>}
                      </div>
                      {!collapsed && item.badge && (
                        <span className="rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] px-1.5 py-0.2">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="fixed inset-y-0 left-0 w-72 bg-background border-r border-border p-4 flex flex-col justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-primary/30 bg-background">
                      <AnimatedLogo
                        src={parkGridLogo}
                        alt="ParkGrid"
                        preset="small"
                        className="size-full"
                        imgClassName="object-cover"
                      />
                    </div>
                    <div className="leading-tight">
                      <span className="block font-display text-xs font-semibold tracking-wider text-foreground">
                        PARKGRID
                      </span>
                      <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                        Console
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="py-4 space-y-6">
                  {NAV_GROUPS.map((group) => (
                    <div key={group.group} className="space-y-1">
                      <span className="block px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                        {group.group}
                      </span>
                      {group.items.map((item) => {
                        const active = isItemActive(item);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors",
                              active
                                ? "bg-primary/10 text-primary border border-primary/30 font-medium"
                                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent",
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className="size-4" />
                              <span>{item.label}</span>
                            </div>
                            {item.badge && (
                              <span className="rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] px-1.5 py-0.2">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-6">
                <Link
                  to="/"
                  className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground py-2"
                >
                  <span>View member site</span>
                  <ExternalLink className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          <AdminErrorBoundary fallbackKey={pathname}>{children || <Outlet />}</AdminErrorBoundary>
        </main>
      </div>
    </div>
  );
}
