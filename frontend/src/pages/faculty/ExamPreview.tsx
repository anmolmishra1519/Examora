import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, PenSquare, Rocket } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Spinner, ErrorBanner } from "@/components/ui/Badges";
import { questionTypeLabel } from "@/lib/format";
import type { ExamT } from "@/types";

export default function ExamPreview() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<ExamT | null>(null);

  const { data: exam, isLoading } = useQuery<ExamT>({
    queryKey: ["exam", examId],
    queryFn: () => api.get(`/exams/${examId}`).then((r) => r.data),
  });

  if (isLoading || !exam) {
    return <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>;
  }

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      const r = await api.post(`/exams/${examId}/publish`);
      setPublished(r.data);
      queryClient.invalidateQueries({ queryKey: ["exams"] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPublishing(false);
      setConfirming(false);
    }
  }

  if (published) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <CheckCircle2 size={44} className="mx-auto mb-4 text-success" />
        <h1 className="font-display text-2xl font-semibold text-ink">Examination Published</h1>
        <p className="mt-2 text-sm text-ink-muted">Students can now access this exam using the details below.</p>
        <div className="card mt-6 space-y-3 p-6 text-left">
          <div>
            <div className="text-xs text-ink-muted">Exam ID</div>
            <div className="font-mono text-sm text-ink">{published.id}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">Access Code</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-navy-700">{published.access_code}</span>
              <button onClick={() => navigator.clipboard.writeText(published.access_code || "")} className="btn-ghost !px-2"><Copy size={14} /></button>
            </div>
          </div>
        </div>
        <button onClick={() => navigate(`/faculty/exams/${examId}`)} className="btn-primary mt-6">Go to Exam Overview</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Preview Examination</h1>
          <p className="mt-1 text-sm text-ink-muted">This is exactly what students will see.</p>
        </div>
        <button onClick={() => navigate(`/faculty/exams/${examId}/review`)} className="btn-secondary"><PenSquare size={15} /> Back to Edit</button>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      <div className="card overflow-hidden">
        <div className="border-b border-line bg-navy-600 px-6 py-5 text-white">
          <h2 className="font-display text-xl font-semibold">{exam.title}</h2>
          <p className="text-sm text-navy-100">{exam.subject}</p>
          <div className="mt-3 flex gap-5 text-xs text-navy-100">
            <span>{exam.question_count} Questions</span>
            <span>{exam.total_marks} Marks</span>
            <span>{exam.duration_minutes} Minutes</span>
            <span>Passing: {exam.passing_marks} Marks</span>
          </div>
        </div>

        <div className="divide-y divide-line">
          {exam.sections.map((section) => (
            <div key={section.id} className="px-6 py-5">
              <h3 className="font-display text-base font-semibold text-ink">{section.name}</h3>
              {section.instructions && <p className="mt-0.5 text-xs text-ink-muted">{section.instructions}</p>}
              <div className="mt-4 space-y-4">
                {section.questions.map((q, i) => (
                  <div key={q.id} className="text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-ink"><span className="font-semibold">{i + 1}.</span> {q.question_text}</p>
                      <span className="shrink-0 text-xs text-ink-faint">[{q.marks} marks]</span>
                    </div>
                    {q.options.length > 0 && (
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5 pl-5">
                        {q.options.map((o) => (
                          <div key={o.label} className="flex items-center gap-1.5 text-xs text-ink-muted">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-line text-[9px]">{o.label}</span>
                            {o.text}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.options.length === 0 && (
                      <p className="mt-1 pl-5 text-xs italic text-ink-faint">{questionTypeLabel(q.question_type)} — written response</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-4 py-3 md:px-0">
          <button onClick={() => navigate(`/faculty/exams/${examId}/review`)} className="btn-secondary">Back to Edit</button>
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="btn-primary"><Rocket size={15} /> Publish Examination</button>
          ) : (
            <div className="flex items-center gap-2 rounded-control border border-line bg-canvas px-3 py-1.5">
              <span className="text-sm text-ink-muted">Publish now? Students will be able to access it.</span>
              <button onClick={() => setConfirming(false)} className="btn-ghost !py-1">Cancel</button>
              <button onClick={handlePublish} disabled={publishing} className="btn-primary !py-1.5">{publishing ? "Publishing..." : "Confirm & Publish"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
