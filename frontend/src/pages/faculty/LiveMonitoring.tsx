import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, ShieldAlert, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner, RiskBadge, EmptyState } from "@/components/ui/Badges";
import type { LiveStudentCard } from "@/types";

interface LiveData {
  exam_id: string;
  exam_title: string;
  active_students: number;
  normal: number;
  under_review: number;
  high_risk: number;
  students: LiveStudentCard[];
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "low", label: "Normal" },
  { key: "medium", label: "Medium Risk" },
  { key: "high", label: "High Risk" },
];

export default function LiveMonitoring() {
  const { examId } = useParams();
  const [filter, setFilter] = useState("all");

  const { data, isLoading } = useQuery<LiveData>({
    queryKey: ["live-monitoring", examId],
    queryFn: () => api.get(`/proctor/live/${examId}`).then((r) => r.data),
    refetchInterval: 5000,
  });

  const filtered = (data?.students || []).filter((s) => filter === "all" || s.risk_level === filter);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Live Examination Monitoring</h1>
      <p className="mt-1 text-sm text-ink-muted">{data?.exam_title}</p>

      {isLoading || !data ? (
        <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryStat label="Active Students" value={data.active_students} />
            <SummaryStat label="Normal" value={data.normal} tone="success" />
            <SummaryStat label="Under Review" value={data.under_review} tone="warning" />
            <SummaryStat label="High Risk" value={data.high_risk} tone="danger" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  filter === f.key ? "bg-navy-600 text-white" : "bg-white text-ink-muted border border-line hover:bg-canvas"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="mt-6"><EmptyState icon={<Camera size={32} />} title="No students match this filter" /></div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <Link to={`/faculty/monitoring/${examId}/student/${s.attempt_id}`} key={s.attempt_id} className="card p-5 hover:shadow-pop">
                  <div className="flex items-start justify-between">
                    <h3 className="font-display text-base font-semibold text-ink">{s.student_name}</h3>
                    {s.status === "in_progress" && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-danger">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" /> LIVE
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="font-display text-2xl font-semibold text-ink">{s.integrity_score}<span className="text-sm text-ink-faint"> / 100</span></div>
                      <div className="text-xs text-ink-muted">Integrity Score</div>
                    </div>
                    <RiskBadge level={s.risk_level} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-xs">
                    <div><div className="font-semibold text-ink">{s.warnings}</div><div className="text-ink-muted">Warnings</div></div>
                    <div><div className="font-semibold text-ink">{s.event_count}</div><div className="text-ink-muted">Events</div></div>
                    <div className="flex flex-col items-center"><Eye size={14} className="text-success" /><div className="text-ink-muted">Camera</div></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div className="card p-4">
      <div className={`font-display text-2xl font-semibold ${cls}`}>{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}
