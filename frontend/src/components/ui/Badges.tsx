import { AlertTriangle, CheckCircle2, Clock, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { ReactNode } from "react";
import clsx from "clsx";

export function Spinner({ className, size }: { className?: string; size?: number }) {
  return <Loader2 className={clsx("animate-spin", className)} size={size} />;
}

export function RiskBadge({ level }: { level: "low" | "medium" | "high" }) {
  const map = {
    low: { label: "LOW RISK", cls: "bg-success-bg text-success" },
    medium: { label: "MEDIUM RISK", cls: "bg-warning-bg text-warning" },
    high: { label: "HIGH RISK", cls: "bg-danger-bg text-danger" },
  } as const;
  const v = map[level];
  return <span className={clsx("badge", v.cls)}>{v.label}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-ink/5 text-ink-muted" },
    scheduled: { label: "Scheduled", cls: "bg-navy-50 text-navy-600" },
    live: { label: "Live", cls: "bg-success-bg text-success" },
    completed: { label: "Completed", cls: "bg-ink/5 text-ink-muted" },
    archived: { label: "Archived", cls: "bg-ink/5 text-ink-faint" },
    processing: { label: "Processing", cls: "bg-navy-50 text-navy-600" },
    needs_review: { label: "Needs Review", cls: "bg-warning-bg text-warning" },
    ready: { label: "Ready", cls: "bg-success-bg text-success" },
    failed: { label: "Failed", cls: "bg-danger-bg text-danger" },
  };
  const v = map[status] || { label: status, cls: "bg-ink/5 text-ink-muted" };
  return <span className={clsx("badge", v.cls)}>{v.label}</span>;
}

export function ReviewStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: ReactNode }> = {
    detected: { label: "Detected", cls: "bg-warning-bg text-warning", icon: <AlertTriangle size={12} /> },
    under_review: { label: "Under Review", cls: "bg-navy-50 text-navy-600", icon: <Clock size={12} /> },
    confirmed: { label: "Confirmed", cls: "bg-danger-bg text-danger", icon: <ShieldAlert size={12} /> },
    dismissed: { label: "Dismissed", cls: "bg-success-bg text-success", icon: <CheckCircle2 size={12} /> },
  };
  const v = map[status] || map.detected;
  return <span className={clsx("badge", v.cls)}>{v.icon}{v.label}</span>;
}

export function SeverityBadge({ severity }: { severity: "low" | "medium" | "high" }) {
  const map = {
    low: "bg-ink/5 text-ink-muted",
    medium: "bg-warning-bg text-warning",
    high: "bg-danger-bg text-danger",
  } as const;
  return <span className={clsx("badge", map[severity])}>{severity.toUpperCase()}</span>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-navy-300">{icon}</div>}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "bg-success" : pct >= 60 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-ink-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/5">
        <div className={clsx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-ink-muted">{pct}%</span>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-control border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
      <XCircle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
