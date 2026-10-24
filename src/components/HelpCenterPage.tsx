import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUp,
  Bot,
  CarFront,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  FileText,
  HelpCircle,
  Info,
  Mail,
  MessageSquare,
  Phone,
  RotateCcw,
  ScanLine,
  Search,
  Sparkles,
  Ticket,
  X,
  Zap,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SpotlightCard, BlurText } from "@/components/react-bits";
import { FAQ_CATEGORIES, FAQ_DATABASE, type FAQCategory, type FAQItem } from "@/lib/faq-rag-data";

export function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FAQCategory | "All">("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | "All">("All");
  const [expandedItems, setExpandedItems] = useState<string[]>(["prk-01", "bok-01"]);
  const [metadataOpen, setMetadataOpen] = useState<Record<string, boolean>>({});

  // Reset subcategory when category changes
  const handleCategoryChange = (cat: FAQCategory | "All") => {
    setSelectedCategory(cat);
    setSelectedSubcategory("All");
  };

  // Subcategories available for current selection
  const availableSubcategories = useMemo(() => {
    if (selectedCategory === "All") return [];
    const catInfo = FAQ_CATEGORIES.find((c) => c.id === selectedCategory);
    return catInfo ? catInfo.subcategories : [];
  }, [selectedCategory]);

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return FAQ_DATABASE.filter((item) => {
      // Category filter
      if (selectedCategory !== "All" && item.category !== selectedCategory) {
        return false;
      }
      // Subcategory filter
      if (selectedSubcategory !== "All" && item.subcategory !== selectedSubcategory) {
        return false;
      }
      // Text search
      if (!query) return true;
      const matchQuestion = item.question.toLowerCase().includes(query);
      const matchAnswer = item.answer.toLowerCase().includes(query);
      const matchCategory = item.category.toLowerCase().includes(query);
      const matchSub = item.subcategory.toLowerCase().includes(query);
      const matchKeywords = item.keywords.some((k) => k.toLowerCase().includes(query));
      return matchQuestion || matchAnswer || matchCategory || matchSub || matchKeywords;
    });
  }, [searchQuery, selectedCategory, selectedSubcategory]);

  // Expand / collapse all
  const toggleAll = () => {
    if (expandedItems.length === filteredFaqs.length) {
      setExpandedItems([]);
    } else {
      setExpandedItems(filteredFaqs.map((f) => f.id));
    }
  };

  const handleSelectRelated = (relatedId: string) => {
    const target = FAQ_DATABASE.find((f) => f.id === relatedId);
    if (target) {
      setSelectedCategory(target.category);
      setSelectedSubcategory("All");
      setSearchQuery("");
      if (!expandedItems.includes(target.id)) {
        setExpandedItems((prev) => [...prev, target.id]);
      }
      // Smooth scroll to target
      setTimeout(() => {
        const el = document.getElementById(`faq-${target.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  };

  const toggleMetadata = (id: string) => {
    setMetadataOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getCategoryIcon = (category: FAQCategory) => {
    switch (category) {
      case "Parking":
        return <CarFront className="size-4 shrink-0 text-primary" />;
      case "Booking":
        return <Ticket className="size-4 shrink-0 text-cyan-400" />;
      case "Payments":
        return <CreditCard className="size-4 shrink-0 text-amber-400" />;
      case "Cancellation & Refunds":
        return <RotateCcw className="size-4 shrink-0 text-rose-400" />;
      case "EV Charging":
        return <Zap className="size-4 shrink-0 text-emerald-400" />;
      case "Entry & Exit":
        return <ScanLine className="size-4 shrink-0 text-purple-400" />;
      case "Parking AI":
        return <Bot className="size-4 shrink-0 text-primary" />;
      default:
        return <HelpCircle className="size-4 shrink-0 text-muted-foreground" />;
    }
  };

  return (
    <section className="page-reveal min-h-screen pt-28 pb-20">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        {/* ── Breadcrumbs ── */}
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
                <button
                  type="button"
                  onClick={() => handleCategoryChange("All")}
                  className={cn(
                    "text-muted-foreground hover:text-foreground",
                    selectedCategory === "All" && "text-foreground font-medium",
                  )}
                >
                  Help Center
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {selectedCategory !== "All" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-semibold text-primary">
                    {selectedCategory}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {selectedSubcategory !== "All" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-muted-foreground">
                    {selectedSubcategory}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        {/* ── Hero / Page Header ── */}
        <SpotlightCard
          spotlightColor="rgba(6, 182, 212, 0.22)"
          borderColor="rgba(6, 182, 212, 0.45)"
          className="relative mb-10 overflow-hidden rounded-2xl border border-border/80 bg-surface/90 p-6 sm:p-10 shadow-sm"
        >
          <div className="max-w-3xl">
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              <span className="live-dot" aria-hidden="true" />
              <span className="text-primary font-mono">ParkGrid Knowledge Hub · BKC Mumbai</span>
            </p>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              <BlurText text="FAQs & Help Center" delay={80} className="font-display" />
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              Official guide to ParkGrid One facility rules, parking floors (B1–L2), EV charging,
              instant reservations, payments, and automated QR entry.
            </p>
          </div>

          {/* ── Search Bar ── */}
          <div className="mt-8 max-w-2xl">
            <div className="relative flex items-center">
              <Search className="absolute left-4 size-5 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by topic (e.g., heavy vehicles, cancellation refund, EV tariff, QR gate)..."
                className="w-full rounded-xl border border-border bg-background py-3.5 pl-12 pr-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                aria-label="Search FAQs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Quick search tags */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">Popular:</span>
              {[
                "Heavy vehicles",
                "Floors B1-L2",
                "EV Charging ₹12/kWh",
                "Cancellation policy",
                "QR code problems",
                "15m Grace period",
              ].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setSearchQuery(term)}
                  className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </SpotlightCard>

        {/* ── Category Filter Tabs ── */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Select Category ({FAQ_CATEGORIES.length} Topics)
            </h2>
            {filteredFaqs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {expandedItems.length === filteredFaqs.length ? "Collapse all" : "Expand all"}
              </Button>
            )}
          </div>

          <div
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"
            role="tablist"
            aria-label="FAQ categories"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === "All"}
              onClick={() => handleCategoryChange("All")}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border px-4 py-2.5 text-xs font-medium transition",
                selectedCategory === "All"
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border bg-surface text-muted-foreground hover:border-border/80 hover:text-foreground",
              )}
            >
              <span>📂</span> All Topics
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {FAQ_DATABASE.length}
              </Badge>
            </button>

            {FAQ_CATEGORIES.map((cat) => {
              const count = FAQ_DATABASE.filter((f) => f.category === cat.id).length;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap border px-4 py-2.5 text-xs font-medium transition",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border bg-surface text-muted-foreground hover:border-border/80 hover:text-foreground",
                  )}
                >
                  <span>{cat.emoji}</span>
                  {cat.name}
                  <Badge
                    variant={isSelected ? "default" : "secondary"}
                    className="ml-1 px-1.5 py-0 text-[10px]"
                  >
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* ── Subcategory Filter Pills (when category is selected) ── */}
          {availableSubcategories.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
              <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Subcategories:
              </span>
              <button
                type="button"
                onClick={() => setSelectedSubcategory("All")}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs transition",
                  selectedSubcategory === "All"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-surface text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                All
              </button>
              {availableSubcategories.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubcategory(sub)}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs transition",
                    selectedSubcategory === sub
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-surface text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Main FAQ Content Area ── */}
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* FAQ Accordion List */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing <strong className="text-foreground">{filteredFaqs.length}</strong> questions
                {selectedCategory !== "All" && ` in ${selectedCategory}`}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            </div>

            {filteredFaqs.length === 0 ? (
              <div className="grid min-h-64 place-items-center border border-dashed border-border bg-surface p-8 text-center">
                <div className="max-w-md">
                  <HelpCircle className="mx-auto size-10 text-muted-foreground" />
                  <h3 className="mt-4 font-display text-xl font-semibold">No questions found</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We couldn’t find an exact FAQ matching "{searchQuery}". You can clear your
                    search, browse another category, or ask our 24/7 AI Concierge.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                      Clear Search
                    </Button>
                    <Link to="/assistant">
                      <Button size="sm">
                        <Bot className="size-4" /> Ask Parking AI
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <Accordion
                type="multiple"
                value={expandedItems}
                onValueChange={setExpandedItems}
                className="space-y-3"
              >
                {filteredFaqs.map((item) => {
                  const isMetaOpen = !!metadataOpen[item.id];
                  return (
                    <AccordionItem
                      key={item.id}
                      value={item.id}
                      id={`faq-${item.id}`}
                      className="interactive-lift border border-border bg-surface transition-colors data-[state=open]:border-primary/50"
                    >
                      <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]]:bg-accent/30">
                        <div className="flex flex-1 items-start gap-3.5 text-left">
                          <span className="mt-1">{getCategoryIcon(item.category)}</span>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                {item.subcategory}
                              </span>
                              {item.badge && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "px-1.5 py-0 text-[10px] font-mono",
                                    item.badge.includes("Notice")
                                      ? "border-amber-500/50 text-amber-500 bg-amber-500/10 font-bold"
                                      : "border-primary/40 text-primary bg-primary/5",
                                  )}
                                >
                                  {item.badge}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-display text-base font-semibold sm:text-lg">
                              {item.question}
                            </h3>
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-5 pb-5 pt-2">
                        {/* Important callout alert if applicable */}
                        {item.importantNotice && (
                          <div className="mb-4 flex items-start gap-3 border-l-2 border-amber-500 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
                            <Info className="size-4 shrink-0 text-amber-400" />
                            <div>
                              <strong className="block font-semibold">Important Rule Notice</strong>
                              <span>{item.importantNotice}</span>
                            </div>
                          </div>
                        )}

                        {/* Answer text */}
                        <div className="text-sm leading-7 text-muted-foreground whitespace-pre-line">
                          {item.answer}
                        </div>

                        {/* Related questions */}
                        {item.relatedIds && item.relatedIds.length > 0 && (
                          <div className="mt-4 border-t border-border/60 pt-3">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                              Related Questions:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {item.relatedIds.map((relId) => {
                                const relItem = FAQ_DATABASE.find((f) => f.id === relId);
                                if (!relItem) return null;
                                return (
                                  <button
                                    key={relId}
                                    type="button"
                                    onClick={() => handleSelectRelated(relId)}
                                    className="group flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                                  >
                                    <span className="line-clamp-1">{relItem.question}</span>
                                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* RAG Knowledge Metadata Toggle */}
                        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                          <button
                            type="button"
                            onClick={() => toggleMetadata(item.id)}
                            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                          >
                            <FileText className="size-3" />
                            {isMetaOpen ? "Hide RAG Metadata" : "View RAG Chunk Metadata"}
                            <ChevronDown
                              className={cn(
                                "size-3 transition-transform",
                                isMetaOpen && "rotate-180",
                              )}
                            />
                          </button>
                          <span className="font-mono text-[10px]">Updated: {item.lastUpdated}</span>
                        </div>

                        {/* Metadata drawer */}
                        {isMetaOpen && (
                          <div className="mt-2 grid gap-1.5 border border-border/80 bg-background/80 p-3 font-mono text-[10px] text-muted-foreground">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground/80">Category:</span>
                              <span className="text-foreground">{item.category}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground/80">Subcategory:</span>
                              <span className="text-foreground">{item.subcategory}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground/80">Document:</span>
                              <span className="text-primary">{item.document}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground/80">Source:</span>
                              <span className="truncate max-w-[240px] text-foreground">
                                {item.source}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground/80">Version:</span>
                              <span className="text-foreground">v{item.version}</span>
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}

            {/* Back to top helper */}
            <div className="mt-8 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={scrollToTop}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowUp className="size-3.5" /> Back to top
              </Button>
            </div>
          </div>

          {/* ── Sidebar: Quick Navigation & Support Concierge ── */}
          <aside className="space-y-6">
            {/* Quick Contact Card */}
            <div className="interactive-lift border border-border bg-surface p-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Need Fast Resolution?
              </span>
              <h3 className="mt-2 font-display text-xl font-semibold">24/7 Facility Help</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Our on-site control team and marshals are stationed right at Ground Level (G1) in
                BKC.
              </p>

              <div className="mt-5 space-y-3">
                <a
                  href="tel:+912048272400"
                  className="flex items-center gap-3 border border-border bg-background p-3 text-xs transition hover:border-primary"
                >
                  <Phone className="size-4 text-primary" />
                  <div>
                    <strong className="block text-foreground">+91 20 4827 2400</strong>
                    <span className="text-[10px] text-muted-foreground">
                      Emergency &amp; Barrier Control
                    </span>
                  </div>
                </a>

                <a
                  href="mailto:help@parkgrid.one"
                  className="flex items-center gap-3 border border-border bg-background p-3 text-xs transition hover:border-primary"
                >
                  <Mail className="size-4 text-primary" />
                  <div>
                    <strong className="block text-foreground">help@parkgrid.one</strong>
                    <span className="text-[10px] text-muted-foreground">
                      Ticketing &amp; Invoices
                    </span>
                  </div>
                </a>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <Link to="/support" className="block">
                  <Button className="w-full">
                    <MessageSquare className="size-4" /> Contact Support Form
                  </Button>
                </Link>
                <Link to="/assistant" className="mt-2 block">
                  <Button variant="outline" className="w-full">
                    <Bot className="size-4" /> Ask Parking AI
                  </Button>
                </Link>
              </div>
            </div>

            {/* Quick Rules Snapshot */}
            <div className="interactive-lift border border-border bg-surface p-5 text-xs">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Quick Facility Rules
              </span>
              <ul className="mt-3 space-y-2.5 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    Speed limit inside facility: <strong>8 km/h</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    Heavy vehicles on <strong>G1 &amp; B1/B2 only</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    Standard parking: <strong>₹50/hour + GST</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    EV Charging: <strong>₹12/kWh</strong> (60 kW CCS2)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    Exit grace period: <strong>15 minutes</strong>
                  </span>
                </li>
              </ul>
            </div>

            {/* RAG Knowledge Base link */}
            <div className="interactive-lift border border-border/80 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="size-4" />
                <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
                  RAG Knowledge Base
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                All 32 questions and 6 operational manuals are indexed for our AI assistant.
              </p>
              <Link
                to="/admin/knowledge"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                Inspect Knowledge Base Chunks <ArrowRight className="size-3" />
              </Link>
            </div>
          </aside>
        </div>

        {/* ── Still Need Help? Bottom CTA Banner ── */}
        <div className="mt-14 border border-primary/30 bg-surface p-8 sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="max-w-2xl">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Still Need Assistance?
              </span>
              <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
                Have a specific booking or on-site issue?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Submit a structured ticket to our Bandra Kurla Complex support desk. Track your
                inquiry status in real-time or reach out directly to our 24/7 on-site team.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/support">
                <Button size="lg" className="magnetic-cta">
                  Contact Support <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/assistant">
                <Button size="lg" variant="outline">
                  <Bot className="size-4" /> Ask Parking AI
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
