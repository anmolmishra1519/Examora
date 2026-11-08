import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Send, X } from "lucide-react";
import { api, downloadFile } from "@/lib/api";
import { Spinner, EmptyState } from "@/components/ui/Badges";
import { questionTypeLabel } from "@/lib/format";

interface ResultsData {
  exam_id: string;
  exam_title: string;
  total_students: number;
  submitted: number;
  not_submitted: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  pass_percentage: number;
  results: {
    attempt_id: string; student_name: string; total_marks: number; marks_obtained: number;
    correct_count: number; incorrect_count: number; unanswered_count: number;
    pending_manual_grading: number; percentage: number; passed: boolean | null; released: boolean;
  }[];
}

export default function ResultsDetail() {
  const { examId } = useParams();
  const queryClient = useQueryClient();
  const [gradingAttempt, setGradingAttempt] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);

  const { data, isLoading } = useQuery<ResultsData>({
    queryKey: ["results", examId],
    queryFn: () => api.get("/results", { params: { exam_id: examId } }).then((r) => r.data),
  });

  async function release() {
    setReleasing(true);
    await api.post(`/results/${examId}/release`);
    await queryClient.invalidateQueries({ queryKey: ["results", examId] });
    setReleasing(false);
  }

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{data.exam_title} — Results</h1>
          <p className="mt-1 text-sm text-ink-muted">{data.submitted} of {data.total_students} students submitted.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadFile(`/reports/exam/${examId}/csv`, `${data.exam_title}-report.csv`)} className="btn-secondary"><Download size={15} /> CSV</button>
          <button onClick={() => downloadFile(`/reports/exam/${examId}/pdf`, `${data.exam_title}-report.pdf`)} className="btn-secondary"><Download size={15} /> PDF</button>
          <button onClick={release} disabled={releasing} className="btn-primary"><Send size={15} /> {releasing ? "Releasing..." : "Release Results"}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Submitted" value={data.submitted} />
        <Stat label="Not Submitted" value={data.not_submitted} />
        <Stat label="Average Score" value={data.average_score} />
        <Stat label="Pass %" value={`${data.pass_percentage}%`} />
      </div>

      <div className="card mt-6 overflow-x-auto">
        {data.results.length === 0 ? (
          <EmptyState title="No submissions yet" description="Results will appear here once students submit the examination." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Score</th>
                <th className="px-5 py-3">Percentage</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">Pending Grading</th>
                <th className="px-5 py-3">Released</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.attempt_id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{r.student_name}</td>
                  <td className="px-5 py-3 text-ink-muted">{r.marks_obtained} / {r.total_marks}</td>
                  <td className="px-5 py-3 text-ink-muted">{r.percentage}%</td>
                  <td className="px-5 py-3">
                    {r.pending_manual_grading > 0 ? (
                      <span className="badge bg-warning-bg text-warning">Pending</span>
                    ) : r.passed ? (
                      <span className="badge bg-success-bg text-success">Pass</span>
                    ) : (
                      <span className="badge bg-danger-bg text-danger">Fail</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{r.pending_manual_grading || "—"}</td>
                  <td className="px-5 py-3 text-ink-muted">{r.released ? "Yes" : "No"}</td>
                  <td className="px-5 py-3 text-right">
                    {r.pending_manual_grading > 0 && (
                      <button onClick={() => setGradingAttempt(r.attempt_id)} className="text-sm font-semibold text-navy-600 hover:underline">Grade</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {gradingAttempt && <GradingModal attemptId={gradingAttempt} onClose={() => { setGradingAttempt(null); queryClient.invalidateQueries({ queryKey: ["results", examId] }); }} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="font-display text-xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}

function GradingModal({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["attempt-answers", attemptId],
    queryFn: () => api.get(`/results/${attemptId}/answers`).then((r) => r.data),
  });
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const ungraded = (data?.items || []).filter((i: any) =>
    ["short_answer", "long_answer", "descriptive"].includes(i.question_type) && !i.manually_graded && i.is_answered
  );

  async function saveGrade(answerId: string, max: number) {
    const value = parseFloat(marks[answerId]);
    if (isNaN(value) || value < 0 || value > max) return;
    setSaving(answerId);
    await api.post(`/results/answers/${answerId}/grade`, { marks_awarded: value, grader_note: notes[answerId] });
    await refetch();
    setSaving(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-card bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">Grade Descriptive Answers — {data?.student_name}</h2>
          <button onClick={onClose} className="btn-ghost !px-2"><X size={18} /></button>
        </div>
        <div className="space-y-5 p-6">
          {isLoading ? (
            <Spinner className="mx-auto text-navy-500" size={24} />
          ) : ungraded.length === 0 ? (
            <p className="text-sm text-ink-muted">All descriptive answers for this student have been graded.</p>
          ) : (
            ungraded.map((item: any) => (
              <div key={item.answer_id} className="rounded-control border border-line p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{questionTypeLabel(item.question_type)} &middot; {item.marks} marks</span>
                </div>
                <p className="text-sm font-medium text-ink">{item.question_text}</p>
                <div className="mt-2 rounded-control bg-canvas px-3 py-2 text-sm text-ink-muted">{item.response}</div>
                <div className="mt-3 flex items-end gap-2">
                  <div className="w-28">
                    <label className="label">Marks (max {item.marks})</label>
                    <input type="number" min={0} max={item.marks} step="0.5" className="input" value={marks[item.answer_id] ?? ""} onChange={(e) => setMarks((prev) => ({ ...prev, [item.answer_id]: e.target.value }))} />
                  </div>
                  <div className="flex-1">
                    <label className="label">Note (optional)</label>
                    <input className="input" value={notes[item.answer_id] ?? ""} onChange={(e) => setNotes((prev) => ({ ...prev, [item.answer_id]: e.target.value }))} />
                  </div>
                  <button onClick={() => saveGrade(item.answer_id, item.marks)} disabled={saving === item.answer_id} className="btn-primary !py-2.5">
                    {saving === item.answer_id ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
