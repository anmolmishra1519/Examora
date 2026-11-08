import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Download, Check, X, Eye, ChevronDown, ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { downloadFile } from "@/lib/api";
import { Spinner, RiskBadge, SeverityBadge, ReviewStatusBadge } from "@/components/ui/Badges";
import { formatTime } from "@/lib/format";

interface IntegrityData {
  attempt_id: string;
  student_name: string;
  exam_id: string;
  exam_title: string;
  status: string;
  risk: { score: number; risk_level: "low" | "medium" | "high"; reasons: string[] } | null;
  events: any[];
  final_review: { status: string; notes: string | null };
}

const FINAL_STATUSES = [
  { key: "normal", label: "Normal" },
  { key: "reviewed_no_violation", label: "Reviewed — No Violation" },
  { key: "reviewed_violation", label: "Reviewed — Violation" },
  { key: "further_investigation", label: "Further Investigation" },
];

export default function StudentIntegrityReview() {
  const { examId, attemptId } = useParams();
  const queryClient = useQueryClient();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [finalStatus, setFinalStatus] = useState<string | null>(null);
  const [finalNotes, setFinalNotes] = useState("");

  const { data, isLoading } = useQuery<IntegrityData>({
    queryKey: ["integrity", attemptId],
    queryFn: () => api.get(`/integrity/attempts/${attemptId}`).then((r) => r.data),
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>;
  }

  const status = finalStatus ?? data.final_review.status;

  async function reviewEvent(eventId: string, decision: string) {
    await api.post(`/integrity/events/${eventId}/review`, { decision, notes: notesDraft[eventId] });
    queryClient.invalidateQueries({ queryKey: ["integrity", attemptId] });
  }

  async function saveFinalReview() {
    await api.post(`/integrity/attempts/${attemptId}/final-review`, { status, notes: finalNotes || data!.final_review.notes });
    queryClient.invalidateQueries({ queryKey: ["integrity", attemptId] });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/faculty/monitoring/${examId}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Back to Live Monitoring
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{data.student_name} — Integrity Review</h1>
          <p className="mt-1 text-sm text-ink-muted">{data.exam_title}</p>
        </div>
        <a href={`/api/reports/student/${attemptId}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary" onClick={(e) => { e.preventDefault(); downloadFile(`/reports/student/${attemptId}/pdf`, `${data.student_name}-integrity-report.pdf`); }}>
          <Download size={15} /> Export Report
        </a>
      </div>

      {data.risk && (
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-4xl font-semibold text-ink">{data.risk.score}<span className="text-lg text-ink-faint"> / 100</span></div>
              <div className="text-sm text-ink-muted">Integrity Score</div>
            </div>
            <RiskBadge level={data.risk.risk_level} />
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">Why this score?</h3>
            <ul className="space-y-1.5">
              {data.risk.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" /> {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="card mt-5 p-6">
        <h3 className="mb-4 font-display text-base font-semibold text-ink">Event Timeline</h3>
        {data.events.length === 0 ? (
          <p className="text-sm text-ink-muted">No suspicious events were recorded during this attempt.</p>
        ) : (
          <div className="space-y-3">
            {data.events.map((e) => {
              const isOpen = expandedEvent === e.id;
              return (
                <div key={e.id} className="rounded-control border border-line">
                  <button onClick={() => setExpandedEvent(isOpen ? null : e.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-ink-faint">{formatTime(e.timestamp)}</span>
                      <span className="text-sm font-medium text-ink">{e.description}</span>
                      <SeverityBadge severity={e.severity} />
                    </div>
                    <div className="flex items-center gap-2">
                      <ReviewStatusBadge status={e.review_status} />
                      {isOpen ? <ChevronUp size={15} className="text-ink-faint" /> : <ChevronDown size={15} className="text-ink-faint" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-line bg-canvas/60 px-4 py-4">
                      <div className="mb-3 grid grid-cols-3 gap-3 text-xs text-ink-muted">
                        <div>Confidence: <span className="font-semibold text-ink">{Math.round(e.confidence * 100)}%</span></div>
                        <div>Duration: <span className="font-semibold text-ink">{e.duration_seconds}s</span></div>
                        <div>Type: <span className="font-semibold text-ink">{e.event_type.replaceAll("_", " ")}</span></div>
                      </div>
                      <textarea
                        className="input min-h-[60px] text-sm"
                        placeholder="Add a note for this decision (optional)"
                        value={notesDraft[e.id] ?? e.review?.notes ?? ""}
                        onChange={(ev) => setNotesDraft((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                      />
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => reviewEvent(e.id, "confirmed")} className="btn-danger !py-1.5 text-xs"><X size={13} /> Confirm</button>
                        <button onClick={() => reviewEvent(e.id, "dismissed")} className="btn-secondary !py-1.5 text-xs"><Check size={13} /> Dismiss</button>
                        <button onClick={() => reviewEvent(e.id, "under_review")} className="btn-ghost !py-1.5 text-xs"><Eye size={13} /> Needs Further Review</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card mt-5 p-6">
        <h3 className="mb-3 font-display text-base font-semibold text-ink">Final Review Decision</h3>
        <div className="flex flex-wrap gap-2">
          {FINAL_STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => setFinalStatus(s.key)}
              className={`rounded-control border px-3.5 py-2 text-sm font-medium ${
                status === s.key ? "border-navy-600 bg-navy-50 text-navy-700" : "border-line text-ink-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <textarea
          className="input mt-3 min-h-[70px]"
          placeholder="Overall notes for this student's integrity review (optional)"
          value={finalNotes || data.final_review.notes || ""}
          onChange={(e) => setFinalNotes(e.target.value)}
        />
        <button onClick={saveFinalReview} className="btn-primary mt-3">Save Final Review</button>
        <p className="mt-3 text-xs text-ink-faint">
          This score reflects system-detected activity only. It is an indicator, not proof of academic misconduct — the final decision belongs to authorized faculty.
        </p>
      </div>
    </div>
  );
}
