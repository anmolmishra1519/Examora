import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileWarning, RotateCcw, PenSquare, Loader2 } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";

const ALL_STEPS = [
  "Document uploaded",
  "Text extracted",
  "Sections detected",
  "Questions identified",
  "Question types detected",
  "Marks identified",
  "Options detected",
  "Instructions detected",
  "Examination structure generated",
];

interface StatusResponse {
  processing_status: string;
  processing_log: string[];
  extraction_confidence: { questions_detected?: number; needs_review?: number; warnings?: string[]; used_ocr?: boolean };
  question_count: number;
  section_count: number;
  total_marks: number;
  duration_minutes: number;
}

export default function ProcessingScreen() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const { data, refetch } = useQuery<StatusResponse>({
    queryKey: ["processing-status", examId],
    queryFn: () => api.get(`/exams/${examId}/processing-status`).then((r) => r.data),
    refetchInterval: (query) => {
      const status = query.state.data?.processing_status;
      return status === "processing" || status === "uploading" ? 900 : false;
    },
  });

  const done = data?.processing_status === "ready" || data?.processing_status === "needs_review";
  const failed = data?.processing_status === "failed";
  const completedSteps = data?.processing_log?.length || 0;

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate(`/faculty/exams/${examId}/review`), 900);
      return () => clearTimeout(t);
    }
  }, [done, examId, navigate]);

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      await api.post(`/exams/${examId}/parse`);
      refetch();
    } catch (err) {
      setRetryError(apiErrorMessage(err));
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
      {failed ? (
        <>
          <FileWarning size={40} className="mb-4 text-danger" />
          <h1 className="font-display text-xl font-semibold text-ink">We couldn't fully process this document</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Something went wrong while reading the file. You can retry processing, or build the exam manually instead.
          </p>
          {retryError && <p className="mt-2 text-sm text-danger">{retryError}</p>}
          <div className="mt-6 flex gap-3">
            <button onClick={retry} disabled={retrying} className="btn-secondary"><RotateCcw size={15} /> Retry Processing</button>
            <button onClick={() => navigate(`/faculty/exams/${examId}/review`)} className="btn-primary"><PenSquare size={15} /> Create Manually</button>
          </div>
        </>
      ) : (
        <>
          <div className="relative mb-6">
            <Loader2 size={44} className={`text-navy-500 ${done ? "" : "animate-spin"}`} />
          </div>
          <h1 className="font-display text-xl font-semibold text-ink">
            {done ? "Your examination is ready." : "Analyzing your question paper..."}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">This usually takes a few seconds.</p>

          <div className="card mt-8 w-full space-y-2.5 p-6 text-left">
            {ALL_STEPS.map((step, i) => {
              const isDone = i < completedSteps;
              return (
                <div key={step} className="flex items-center gap-3">
                  {isDone ? (
                    <CheckCircle2 size={17} className="shrink-0 text-success" />
                  ) : (
                    <div className="h-[17px] w-[17px] shrink-0 rounded-full border-2 border-line" />
                  )}
                  <span className={`text-sm ${isDone ? "text-ink" : "text-ink-faint"}`}>{step}</span>
                </div>
              );
            })}
          </div>

          {done && data && (
            <div className="mt-6 grid w-full grid-cols-2 gap-3 text-sm">
              <SummaryStat label="Questions" value={data.question_count} />
              <SummaryStat label="Sections" value={data.section_count} />
              <SummaryStat label="Total Marks" value={data.total_marks} />
              <SummaryStat label="Needs Review" value={data.extraction_confidence?.needs_review || 0} highlight={(data.extraction_confidence?.needs_review || 0) > 0} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`card px-4 py-3 ${highlight ? "border-warning/30 bg-warning-bg" : ""}`}>
      <div className={`font-display text-xl font-semibold ${highlight ? "text-warning" : "text-ink"}`}>{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}
