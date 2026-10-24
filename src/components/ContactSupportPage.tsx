import { useEffect, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CarFront,
  CheckCircle2,
  Clock,
  CreditCard,
  FileQuestion,
  HelpCircle,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Ticket as TicketIcon,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SpotlightCard } from "@/components/react-bits";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SUPPORT_CATEGORIES,
  createSupportTicket,
  getStoredTickets,
  type SupportCategory,
  type SupportTicket,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/support-tickets";

export function ContactSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [name, setName] = useState("Bhushan Dhavale");
  const [email, setEmail] = useState("bhushan@example.com");
  const [bookingId, setBookingId] = useState("");
  const [category, setCategory] = useState<SupportCategory>("Booking / Parking");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<SupportTicket | null>(null);

  // Load persisted tickets on mount
  useEffect(() => {
    setTickets(getStoredTickets());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please provide a valid email address");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject for your request");
      return;
    }
    if (!message.trim() || message.length < 10) {
      toast.error("Please provide a detailed description (at least 10 characters)");
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const ticket = createSupportTicket({
        name,
        email,
        bookingId: bookingId || undefined,
        category,
        subject,
        message,
        userId: "BD-9941",
      });

      setTickets(getStoredTickets());
      setSubmittedTicket(ticket);
      setIsSubmitting(false);

      // Reset specific fields
      setSubject("");
      setMessage("");
      setBookingId("");

      toast.success(`Support ticket ${ticket.ticketId} created successfully!`, {
        description: "Our on-site team will review your inquiry immediately.",
      });
    }, 600);
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "Open":
        return (
          <Badge className="bg-primary/20 text-primary border-primary/40 font-mono text-[10px]">
            Open
          </Badge>
        );
      case "In Progress":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 font-mono text-[10px]">
            In Progress
          </Badge>
        );
      case "Resolved":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-mono text-[10px]">
            Resolved
          </Badge>
        );
      case "Closed":
        return (
          <Badge className="bg-muted text-muted-foreground border-border font-mono text-[10px]">
            Closed
          </Badge>
        );
    }
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case "Urgent":
        return (
          <span className="font-mono text-[10px] text-rose-400 font-bold uppercase">
            ⚡ Urgent Priority
          </span>
        );
      case "High":
        return (
          <span className="font-mono text-[10px] text-amber-400 font-semibold uppercase">
            ▲ High Priority
          </span>
        );
      case "Normal":
        return (
          <span className="font-mono text-[10px] text-muted-foreground uppercase">● Normal</span>
        );
      case "Low":
        return (
          <span className="font-mono text-[10px] text-muted-foreground/70 uppercase">▽ Low</span>
        );
    }
  };

  const getCategoryIcon = (catId: SupportCategory) => {
    switch (catId) {
      case "Booking / Parking":
        return <CarFront className="size-4 shrink-0 text-primary" />;
      case "Payment":
        return <CreditCard className="size-4 shrink-0 text-amber-400" />;
      case "Slot Issue":
        return <ShieldAlert className="size-4 shrink-0 text-rose-400" />;
      case "EV Charging":
        return <Zap className="size-4 shrink-0 text-emerald-400" />;
      case "Entry / Exit":
        return <Clock className="size-4 shrink-0 text-purple-400" />;
      case "Account":
        return <User className="size-4 shrink-0 text-blue-400" />;
      case "Other":
        return <HelpCircle className="size-4 shrink-0 text-muted-foreground" />;
    }
  };

  return (
    <section className="page-reveal min-h-screen pt-28 pb-20">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        {/* ── Breadcrumb Navigation ── */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="text-muted-foreground hover:text-foreground">
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/faq" className="text-muted-foreground hover:text-foreground">
                  Help Center
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-primary">
                Contact Support
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* ── Page Header ── */}
        <div className="relative mb-10 overflow-hidden border border-border bg-surface p-6 sm:p-10">
          <div className="max-w-3xl">
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              <span className="live-dot" aria-hidden="true" /> On-Site Operations Desk · BKC Mumbai
            </p>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Contact Support
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              Have an issue with your parking slot, barrier access, payment, or EV charging? Submit
              an official ticket or connect with our 24/7 on-site facility marshals.
            </p>
          </div>
        </div>

        {/* ── Confirmation Modal / Alert when Ticket Created ── */}
        {submittedTicket && (
          <div className="mb-8 border-2 border-primary/50 bg-primary/10 p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-primary" />
                  <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
                    Ticket Created Successfully
                  </span>
                </div>
                <h3 className="font-display text-2xl font-bold">
                  Reference:{" "}
                  <span className="text-primary font-mono">{submittedTicket.ticketId}</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Logged on {new Date(submittedTicket.createdAt).toLocaleString()} · Priority:{" "}
                  <strong>{submittedTicket.priority}</strong> · Status:{" "}
                  <strong>{submittedTicket.status}</strong>
                </p>
                <p className="pt-2 text-sm text-foreground">
                  Our facility team at Bandra Kurla Complex has received your inquiry regarding{" "}
                  <strong>"{submittedTicket.subject}"</strong>. A confirmation copy has been
                  registered under your profile.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSubmittedTicket(null)}
                className="self-start sm:self-center"
              >
                Dismiss Notice
              </Button>
            </div>
          </div>
        )}

        {/* ── Two Column Layout: Support Form & Information Panel ── */}
        <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
          {/* Left: Support Form */}
          <SpotlightCard
            spotlightColor="rgba(6, 182, 212, 0.16)"
            borderColor="rgba(6, 182, 212, 0.35)"
            className="rounded-2xl border border-border/80 bg-surface/90 p-6 sm:p-8 shadow-sm"
          >
            <div className="mb-6 border-b border-border pb-5">
              <h2 className="font-display text-2xl font-semibold">Submit a Support Request</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                All requests are logged with timestamped tracking and assigned to on-duty marshals.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category Selection Grid */}
              <div>
                <label className="mb-2.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Select Issue Category <span className="text-primary">*</span>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SUPPORT_CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={cn(
                          "interactive-lift flex items-start gap-2.5 border p-3 text-left transition",
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                            : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground",
                        )}
                      >
                        <span className="mt-0.5">{getCategoryIcon(cat.id)}</span>
                        <div className="space-y-0.5">
                          <strong className="block text-xs font-semibold leading-tight text-foreground">
                            {cat.label}
                          </strong>
                          <span className="block text-[10px] text-muted-foreground leading-snug">
                            {cat.placeholder}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name & Email Row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="sup-name"
                    className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground"
                  >
                    Your Name <span className="text-primary">*</span>
                  </label>
                  <input
                    id="sup-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="sup-email"
                    className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground"
                  >
                    Email Address <span className="text-primary">*</span>
                  </label>
                  <input
                    id="sup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Booking ID & Subject */}
              <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                <div>
                  <label
                    htmlFor="sup-booking"
                    className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground"
                  >
                    Booking ID <span className="text-muted-foreground/60">(Optional)</span>
                  </label>
                  <input
                    id="sup-booking"
                    type="text"
                    value={bookingId}
                    onChange={(e) => setBookingId(e.target.value)}
                    placeholder="e.g. SP-10231"
                    className="w-full font-mono border border-border bg-background px-3.5 py-2.5 text-sm uppercase placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="sup-subj"
                    className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground"
                  >
                    Subject <span className="text-primary">*</span>
                  </label>
                  <input
                    id="sup-subj"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of the problem"
                    className="w-full border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="sup-msg"
                    className="block text-xs font-mono uppercase tracking-wider text-muted-foreground"
                  >
                    Detailed Message <span className="text-primary">*</span>
                  </label>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {message.length} characters
                  </span>
                </div>
                <textarea
                  id="sup-msg"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please provide specific details (floor, bay number, vehicle plate, transaction date) to help us resolve this swiftly..."
                  className="w-full border border-border bg-background p-3.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Submit CTA */}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted-foreground">
                  🔒 Encrypted transmission · Official ticket generated with SLA tracking.
                </p>
                <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-44 shadow-sm">
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" /> Submit Request
                    </>
                  )}
                </Button>
              </div>
            </form>
          </SpotlightCard>

          {/* Right Column: Direct Contact & Recent Tickets */}
          <div className="space-y-6">
            {/* 24/7 Control Room Hub */}
            <SpotlightCard
              spotlightColor="rgba(6, 182, 212, 0.18)"
              borderColor="rgba(6, 182, 212, 0.35)"
              className="rounded-2xl border border-border/80 bg-surface/90 p-6 shadow-sm"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Immediate Assistance
              </span>
              <h3 className="mt-2 font-display text-xl font-semibold">BKC Operations Desk</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                For urgent barrier lifting or physical obstructions, speak directly with our control
                room.
              </p>

              <div className="mt-6 space-y-4 text-xs">
                <div className="interactive-lift flex items-start gap-3 border border-border bg-background p-3.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <strong className="block text-sm text-foreground">+91 20 4827 2400</strong>
                    <span className="text-[10px] text-muted-foreground">
                      Direct barrier &amp; emergency hotline (24/7)
                    </span>
                  </div>
                </div>

                <div className="interactive-lift flex items-start gap-3 border border-border bg-background p-3.5">
                  <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <strong className="block text-sm text-foreground">help@parkgrid.one</strong>
                    <span className="text-[10px] text-muted-foreground">
                      General support &amp; payment inquiries
                    </span>
                  </div>
                </div>

                <div className="interactive-lift flex items-start gap-3 border border-border bg-background p-3.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <strong className="block text-sm text-foreground">
                      Ground Level (G1) Control Hub
                    </strong>
                    <span className="text-[10px] text-muted-foreground">
                      Bandra Kurla Complex, Mumbai, Maharashtra
                    </span>
                  </div>
                </div>
              </div>

              {/* Service Level Guarantees */}
              <div className="mt-6 border-t border-border pt-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Target Response Times (SLAs)
                </p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>🚨 Slot / Barrier blockage:</span>
                    <strong className="text-foreground">&lt; 10 minutes</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>💳 Payment &amp; refunds:</span>
                    <strong className="text-foreground">&lt; 2 hours</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>📋 General inquiries:</span>
                    <strong className="text-foreground">Within 24 hours</strong>
                  </div>
                </div>
              </div>
            </SpotlightCard>

            {/* AI Assistant Quick Callout */}
            <SpotlightCard
              spotlightColor="rgba(6, 182, 212, 0.22)"
              borderColor="rgba(6, 182, 212, 0.45)"
              className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-sm"
            >
              <div className="flex items-center gap-2 text-primary">
                <Bot className="size-5" />
                <strong className="font-display text-lg">Instant AI Answers</strong>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Looking for parking rates, cancellation timelines, or EV charger specs? Our AI
                Assistant can answer immediately without waiting for a support agent.
              </p>
              <Link to="/assistant" className="mt-4 block">
                <Button variant="outline" size="sm" className="w-full">
                  Chat with Parking AI <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </SpotlightCard>
          </div>
        </div>

        {/* ── Structured Tickets Log (User's Open and Recent Tickets) ── */}
        <div className="mt-14 border border-border bg-surface p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Ticket Ledger
              </span>
              <h2 className="mt-1 font-display text-2xl font-semibold">Your Support Requests</h2>
              <p className="text-xs text-muted-foreground">
                Track status, priority, and timestamps for your submitted inquiries.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {tickets.length} Registered {tickets.length === 1 ? "Ticket" : "Tickets"}
              </Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3.5">Ticket ID</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Subject &amp; Details</th>
                  <th className="p-3.5">Booking Ref</th>
                  <th className="p-3.5">Priority</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((t) => (
                  <tr key={t.ticketId} className="bg-background/50 hover:bg-accent/40 transition">
                    <td className="p-3.5 font-mono font-bold text-primary">{t.ticketId}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 text-xs">
                        {getCategoryIcon(t.category)}
                        <span>{t.category}</span>
                      </div>
                    </td>
                    <td className="p-3.5 max-w-xs">
                      <strong className="block text-xs text-foreground truncate">
                        {t.subject}
                      </strong>
                      <p className="text-[11px] text-muted-foreground truncate">{t.message}</p>
                    </td>
                    <td className="p-3.5 font-mono text-xs text-muted-foreground">
                      {t.bookingId || "—"}
                    </td>
                    <td className="p-3.5">{getPriorityBadge(t.priority)}</td>
                    <td className="p-3.5">{getStatusBadge(t.status)}</td>
                    <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
