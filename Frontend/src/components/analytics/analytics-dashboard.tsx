"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { getAiSuggestionsToday } from "@/lib/ai-metrics";
import {
  buildAnalyticsSnapshot,
  type AnalyticsRange,
} from "@/lib/analytics/metrics";
import { getChannelConfig } from "@/lib/format";
import { useApprovalStore } from "@/stores/approval-store";
import { useConversationStore } from "@/stores/conversation-store";
import { useMessageStore } from "@/stores/message-store";
import { cn } from "@/lib/utils";

const RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
];

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-500",
  pending: "bg-amber-500",
  resolved: "bg-sky-500",
  closed: "bg-slate-400",
};

export function AnalyticsDashboard() {
  const conversations = useConversationStore((state) => state.conversations);
  const messagesByConversation = useMessageStore((state) => state.byConversation);
  const pendingApprovals = useApprovalStore(
    (state) => Object.keys(state.pendingByConversation).length,
  );

  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAiSuggestions(getAiSuggestionsToday());
  }, []);

  const snapshot = useMemo(
    () =>
      buildAnalyticsSnapshot(
        conversations,
        messagesByConversation,
        pendingApprovals,
        range,
      ),
    [conversations, messagesByConversation, pendingApprovals, range],
  );

  const maxHourly = Math.max(
    1,
    ...snapshot.hourlyActivity.map((item) => item.count),
  );
  const maxChannel = Math.max(
    1,
    ...snapshot.channelMetrics.map((item) => item.count),
  );

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-muted/30 via-background to-background">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <header
          className={cn(
            "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
            mounted && "animate-in fade-in slide-in-from-bottom-3 duration-500",
          )}
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-primary text-white shadow-lg shadow-primary/25">
                <Activity className="size-5" />
                <span className="absolute -end-0.5 -top-0.5 flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Analytics
                </h1>
                <p className="text-sm text-muted-foreground">
                  Live workspace metrics — updates as conversations change
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card/60 p-1">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300",
                  range === item.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            index={0}
            mounted={mounted}
            icon={Users}
            label="Conversations"
            value={snapshot.totalConversations}
            sub={`${snapshot.openConversations} open now`}
            accent="from-violet-500/20 to-violet-500/5"
            iconClass="text-violet-500"
          />
          <MetricCard
            index={1}
            mounted={mounted}
            icon={MessageSquare}
            label="Messages"
            value={snapshot.totalMessages}
            sub={`${snapshot.customerMessages} from customers`}
            accent="from-sky-500/20 to-sky-500/5"
            iconClass="text-sky-500"
          />
          <MetricCard
            index={2}
            mounted={mounted}
            icon={Bot}
            label="Bot replies"
            value={snapshot.botMessages}
            sub={`${snapshot.agentMessages} agent messages`}
            accent="from-emerald-500/20 to-emerald-500/5"
            iconClass="text-emerald-500"
          />
          <MetricCard
            index={3}
            mounted={mounted}
            icon={Sparkles}
            label="AI assist"
            value={aiSuggestions}
            sub={`${snapshot.waitingApproval} awaiting approval`}
            accent="from-amber-500/20 to-amber-500/5"
            iconClass="text-amber-500"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <section
            className={cn(
              "rounded-2xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur lg:col-span-3",
              mounted &&
                "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both",
            )}
            style={{ animationDelay: "120ms" }}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Message volume</h2>
                <p className="text-xs text-muted-foreground">
                  Hourly distribution in selected range
                </p>
              </div>
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>
            <div className="flex h-40 items-end gap-1">
              {snapshot.hourlyActivity.map((item, index) => {
                const height = (item.count / maxHourly) * 100;
                const active = item.count > 0;
                return (
                  <div
                    key={item.hour}
                    className="group relative flex flex-1 flex-col items-center justify-end"
                  >
                    <div
                      className={cn(
                        "w-full max-w-[14px] rounded-t-md bg-gradient-to-t from-primary/80 to-violet-400/90 transition-opacity duration-300",
                        active ? "opacity-100" : "opacity-20",
                        mounted && "analytics-bar-rise",
                      )}
                      style={{
                        height: `${Math.max(active ? 8 : 4, height)}%`,
                        animationDelay: `${index * 18}ms`,
                      }}
                      title={`${item.label}: ${item.count}`}
                    />
                    {item.hour % 4 === 0 ? (
                      <span className="mt-1 text-[9px] text-muted-foreground">
                        {item.hour}
                      </span>
                    ) : null}
                    <div className="pointer-events-none absolute -top-8 z-10 hidden rounded-md bg-foreground px-2 py-0.5 text-[10px] text-background group-hover:block">
                      {item.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            className={cn(
              "rounded-2xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur lg:col-span-2",
              mounted &&
                "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both",
            )}
            style={{ animationDelay: "200ms" }}
          >
            <h2 className="text-sm font-semibold">Conversation status</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Share of conversations by status
            </p>
            <div className="space-y-3">
              {snapshot.statusMetrics.map((item, index) => (
                <div key={item.status} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize text-muted-foreground">
                      {item.status}
                    </span>
                    <span className="font-medium tabular-nums">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700 ease-out",
                        STATUS_COLORS[item.status] ?? "bg-primary",
                      )}
                      style={{
                        width: mounted ? `${item.percent}%` : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section
            className={cn(
              "rounded-2xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur",
              mounted &&
                "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both",
            )}
            style={{ animationDelay: "280ms" }}
          >
            <div className="mb-4 flex items-center gap-2">
              <Zap className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Channels</h2>
            </div>
            {snapshot.channelMetrics.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No conversations in this range yet.
              </p>
            ) : (
              <div className="space-y-3">
                {snapshot.channelMetrics.map((item, index) => {
                  const config = getChannelConfig(item.channel);
                  const active = hoveredChannel === item.channel;
                  return (
                    <button
                      key={item.channel}
                      type="button"
                      onMouseEnter={() => setHoveredChannel(item.channel)}
                      onMouseLeave={() => setHoveredChannel(null)}
                      onFocus={() => setHoveredChannel(item.channel)}
                      onBlur={() => setHoveredChannel(null)}
                      className={cn(
                        "w-full rounded-xl border border-transparent p-2 text-start transition-all duration-300",
                        active && "border-primary/20 bg-primary/5 scale-[1.01]",
                      )}
                    >
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium">{config.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {item.count} · {item.percent.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700 ease-out",
                            config.dotClass,
                          )}
                          style={{
                            width: mounted
                              ? `${(item.count / maxChannel) * 100}%`
                              : "0%",
                            transitionDelay: `${index * 60}ms`,
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section
            className={cn(
              "rounded-2xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur",
              mounted &&
                "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both",
            )}
            style={{ animationDelay: "360ms" }}
          >
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Latest messages across all conversations
            </p>
            {snapshot.recentMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Activity will appear here as messages arrive.
              </p>
            ) : (
              <ul className="space-y-2">
                {snapshot.recentMessages.map((item, index) => (
                  <li
                    key={item.id}
                    className={cn(
                      "flex gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5 transition-colors hover:bg-muted/40",
                      mounted &&
                        "animate-in fade-in slide-in-from-right-2 duration-500 fill-mode-both",
                    )}
                    style={{ animationDelay: `${index * 40 + 400}ms` }}
                  >
                    <span
                      className={cn(
                        "mt-1 size-2 shrink-0 rounded-full",
                        item.sender === "customer"
                          ? "bg-sky-500"
                          : item.sender === "bot"
                            ? "bg-violet-500"
                            : item.sender === "agent"
                              ? "bg-emerald-500"
                              : "bg-muted-foreground",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium capitalize text-muted-foreground">
                        {item.sender}
                      </p>
                      <p className="line-clamp-2 text-sm leading-snug">
                        {item.preview || "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div
          className={cn(
            "grid gap-3 sm:grid-cols-3",
            mounted &&
              "animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both",
          )}
          style={{ animationDelay: "440ms" }}
        >
          <InsightPill
            label="AI active"
            value={snapshot.aiActive}
            total={snapshot.totalConversations}
          />
          <InsightPill
            label="Auto-reply on"
            value={snapshot.autoReplyEnabled}
            total={snapshot.totalConversations}
          />
          <InsightPill
            label="Needs approval"
            value={snapshot.waitingApproval}
            total={snapshot.totalConversations}
            warn
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  index,
  mounted,
  icon: Icon,
  label,
  value,
  sub,
  accent,
  iconClass,
}: {
  index: number;
  mounted: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub: string;
  accent: string;
  iconClass: string;
}) {
  const display = useAnimatedNumber(value, mounted);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card/80 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
        mounted &&
          "animate-in fade-in zoom-in-95 duration-500 fill-mode-both",
      )}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity group-hover:opacity-100",
          accent,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            {display}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-xl bg-background/80 shadow-sm ring-1 ring-border/50",
            iconClass,
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

function InsightPill({
  label,
  value,
  total,
  warn,
}: {
  label: string;
  value: number;
  total: number;
  warn?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 transition-colors",
        warn
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-border bg-card/60",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">
        {value}
        <span className="ms-1 text-sm font-normal text-muted-foreground">
          ({pct}%)
        </span>
      </p>
    </div>
  );
}

function useAnimatedNumber(target: number, enabled: boolean): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    const start = value;
    const diff = target - start;
    if (diff === 0) return;

    const duration = 700;
    const startTime = performance.now();
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + diff * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);

  return value;
}
