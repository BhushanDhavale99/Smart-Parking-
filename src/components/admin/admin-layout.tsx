import { useState, useEffect } from "react";
import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MapPin,
  Grid3X3,
  CalendarCheck,
  Activity,
  Users,
  BookOpen,
  CreditCard,
  Tag,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import parkGridLogo from "@/assets/parkgrid-logo.png";
import { AnimatedLogo } from "@/components/animated-logo";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: string;
  comingSoon?: boolean;
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
      { to: "/admin/users", label: "Users & Accounts", icon: Users, badge: "Live DB" },
      { to: "/admin/payments", label: "Payments", icon: CreditCard, comingSoon: true },
      { to: "/admin/pricing", label: "Pricing rules", icon: Tag, comingSoon: true },
    ],
  },
  {
    group: "System",
    items: [
      { to: "/admin/knowledge", label: "Knowledge Base", icon: BookOpen },
      { to: "/admin/settings", label: "Settings", icon: Settings, comingSoon: true },
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
  "/admin/pricing": "Pricing rules",
  "/admin/knowledge": "Knowledge Base",
  "/admin/settings": "Settings",
};

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

          {/* Center: Global Search Placeholder (Coming soon) */}
          <div className="hidden md:flex items-center relative w-64 lg:w-72">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground/60" />
            <Input
              disabled
              placeholder="Search console (coming soon)..."
              className="h-8 pl-8 text-xs bg-muted/20 border-border/80 text-muted-foreground cursor-not-allowed"
            />
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
                      {!collapsed && item.comingSoon && (
                        <span className="rounded bg-muted/60 text-muted-foreground font-mono text-[9px] px-1 py-0.2">
                          Soon
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden pt-14"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="bg-background border-r border-border w-72 max-w-[85vw] h-full p-4 overflow-y-auto shadow-2xl flex flex-col justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                  <div className="flex items-center gap-2">
                    <div className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md border border-primary/30 bg-background">
                      <AnimatedLogo
                        src={parkGridLogo}
                        alt="ParkGrid"
                        preset="static"
                        className="size-full"
                        imgClassName="object-cover"
                      />
                    </div>
                    <span className="font-display font-semibold text-sm">Navigation</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="space-y-5">
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
                            {item.comingSoon && (
                              <span className="rounded bg-muted/60 text-muted-foreground font-mono text-[9px] px-1 py-0.2">
                                Soon
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
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
