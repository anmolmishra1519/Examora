import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/Badges";
import type { ResultT } from "@/types";

export default function StudentResultDetail() {
  const { attemptId } = useParams();

  const { data, isLoading, error } = useQuery<ResultT>({
    queryKey: ["result", attemptId],
    queryFn: () => api.get(`/results/${attemptId}`).then((r) => r.data),
    retry: false,
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-xl font-semibold text-ink">Result not yet available</h1>
        <p className="mt-2 text-sm text-ink-muted">Your faculty has not released this result yet. Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-2xl font-semibold text-ink">{data.exam_title}</h1>

      <div className="card mt-6 p-6 text-center">
        <div className="font-display text-4xl font-semibold text-ink">{data.marks_obtained} / {data.total_marks}</div>
        <div className="mt-1 text-sm text-ink-muted">Score</div>
        <div className="mt-4 font-display text-2xl font-semibold text-navy-600">{data.percentage}%</div>
        <div className="text-xs text-ink-muted">Percentage</div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
          <Stat label="Correct" value={data.correct_count} tone="success" />
          <Stat label="Incorrect" value={data.incorrect_count} tone="danger" />
          <Stat label="Unanswered" value={data.unanswered_count} />
        </div>

        {data.pending_manual_grading > 0 && (
          <p className="mt-4 text-xs text-warning">{data.pending_manual_grading} question(s) pending manual evaluation.</p>
        )}

        <div className="mt-6 border-t border-line pt-5">
          {data.passed === true && <span className="badge bg-success-bg px-4 py-1.5 text-sm text-success">PASS</span>}
          {data.passed === false && <span className="badge bg-danger-bg px-4 py-1.5 text-sm text-danger">FAIL</span>}
          {data.passed === null && <span className="badge bg-ink/5 px-4 py-1.5 text-sm text-ink-muted">PENDING EVALUATION</span>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  const cls = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div>
      <div className={`font-display text-xl font-semibold ${cls}`}>{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}
