import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/Badges";
import type { ExamT } from "@/types";

export default function ExamInstructions() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [acknowledged, setAcknowledged] = useState(false);

  const { data: exam, isLoading } = useQuery<ExamT>({
    queryKey: ["exam", examId],
    queryFn: () => api.get(`/exams/${examId}`).then((r) => r.data),
  });

  if (isLoading || !exam) {
    return <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-ink">Examination Instructions</h1>
      <p className="mt-1 text-sm text-ink-muted">{exam.title} &middot; {exam.subject}</p>

      <div className="card mt-6 p-6">
        <div className="grid grid-cols-2 gap-4 border-b border-line pb-5 text-sm md:grid-cols-4">
          <InfoItem label="Duration" value={`${exam.duration_minutes} min`} />
          <InfoItem label="Total Marks" value={exam.total_marks} />
          <InfoItem label="Questions" value={exam.question_count} />
          <InfoItem label="Passing Marks" value={exam.passing_marks} />
        </div>

        <ul className="mt-5 space-y-2.5 text-sm text-ink-muted">
          <li>&bull; {exam.free_navigation ? "You may navigate freely between questions." : "Questions must be answered in order."}</li>
          <li>&bull; {exam.allow_mark_for_review ? "You can mark questions for review and revisit them later." : "Marking for review is not enabled for this exam."}</li>
          <li>&bull; Your answers are automatically saved as you work — no manual save is required.</li>
          <li>&bull; The examination timer is authoritative on our servers; closing your browser will not pause it.</li>
          <li>&bull; A stable camera and browser environment is required for the duration of the exam.</li>
          <li>&bull; The exam must be taken in fullscreen mode within a supported browser.</li>
          <li>&bull; Once submitted, your examination cannot be reopened.</li>
        </ul>

        {exam.proctoring_enabled && (
          <div className="mt-5 flex items-start gap-3 rounded-control border border-navy-100 bg-navy-50 px-4 py-3.5">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-navy-600" />
            <p className="text-sm text-navy-800">
              This examination uses intelligent monitoring to identify potentially suspicious activity.
              Detected events are reviewed by faculty and do not automatically determine academic misconduct.
            </p>
          </div>
        )}

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-control border border-line px-4 py-3.5">
          <input type="checkbox" className="mt-0.5" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
          <span className="text-sm text-ink">
            I have read and understood the examination instructions{exam.proctoring_enabled ? ", and I consent to intelligent monitoring during this examination" : ""}.
          </span>
        </label>

        <button
          onClick={() => navigate(`/student/exams/${examId}/system-check`)}
          disabled={!acknowledged}
          className="btn-primary mt-5 w-full py-3"
        >
          Continue to System Check <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-display text-lg font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}
