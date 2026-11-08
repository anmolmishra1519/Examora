import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Flag, ChevronLeft, ChevronRight, Camera } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Spinner } from "@/components/ui/Badges";
import { formatDuration, questionTypeLabel } from "@/lib/format";
import { attachBrowserMonitors, ProctorEngine, reportProctorEvent, ProctorEventPayload } from "@/proctoring/ProctorEngine";
import type { AttemptDetailT, AttemptQuestionT } from "@/types";
import { Logomark } from "@/components/layout/Logo";

export default function ExamInterface() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: attempt, isLoading } = useQuery<AttemptDetailT>({
    queryKey: ["attempt", attemptId],
    queryFn: () => api.get(`/attempts/${attemptId}`).then((r) => r.data),
  });

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { response: any; marked: boolean; answered: boolean }>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const saveTimers = useRef<Record<string, number>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<ProctorEngine | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [cameraOk, setCameraOk] = useState(false);

  // Seed local answer state from the server once the attempt loads.
  useEffect(() => {
    if (!attempt) return;
    setSecondsLeft(attempt.seconds_remaining);
    const initial: Record<string, { response: any; marked: boolean; answered: boolean }> = {};
    attempt.questions.forEach((q) => {
      initial[q.id] = { response: q.response, marked: q.marked_for_review, answered: q.is_answered };
    });
    setAnswers(initial);
  }, [attempt?.id]);

  // Fullscreen on entry.
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  // Local countdown ticking every second; server remains authoritative via autosave responses.
  useEffect(() => {
    if (secondsLeft === null) return;
    const t = window.setInterval(() => setSecondsLeft((s) => (s !== null ? Math.max(0, s - 1) : s)), 1000);
    return () => window.clearInterval(t);
  }, [secondsLeft !== null]);

  // Fires exactly once when the countdown reaches zero.
  useEffect(() => {
    if (secondsLeft === 0) {
      handleAutoSubmit();
    }
  }, [secondsLeft]);

  // Proctoring setup.
  useEffect(() => {
    if (!attempt || !attempt.proctoring_enabled || !attemptId) return;
    let detachBrowser: (() => void) | undefined;
    let cancelled = false;

    async function setup() {
      try {
        const r = await api.post("/proctor/sessions", { attempt_id: attemptId });
        if (cancelled) return;
        sessionRef.current = r.data.session_id;

        const engine = new ProctorEngine(videoRef.current!);
        engineRef.current = engine;
        await engine.requestCamera();
        setCameraOk(true);
        engine.loadModels().catch(() => undefined);
        engine.on((payload) => handleProctorEvent(payload));
        engine.start();

        detachBrowser = attachBrowserMonitors((payload) => handleProctorEvent(payload));
      } catch {
        setCameraOk(false);
      }
    }
    setup();

    return () => {
      cancelled = true;
      engineRef.current?.stop();
      detachBrowser?.();
    };
  }, [attempt?.id]);

  function handleProctorEvent(payload: ProctorEventPayload) {
    if (attemptId && sessionRef.current) {
      reportProctorEvent(attemptId, sessionRef.current, payload);
    }
    if (["TAB_SWITCH", "WINDOW_BLUR", "FULLSCREEN_EXIT"].includes(payload.event_type)) {
      setWarningCount((c) => {
        const next = c + 1;
        setWarning(`Warning ${next} — Please remain in the examination window.`);
        window.setTimeout(() => setWarning(null), 4000);
        return next;
      });
    }
  }

  const saveAnswer = useCallback((questionId: string, response: any, marked: boolean) => {
    if (saveTimers.current[questionId]) window.clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = window.setTimeout(async () => {
      try {
        const r = await api.put(`/attempts/${attemptId}/answers`, { question_id: questionId, response, marked_for_review: marked });
        if (typeof r.data?.seconds_remaining === "number") setSecondsLeft(r.data.seconds_remaining);
      } catch {
        // Autosave retries silently on the next change; the server remains authoritative at submit time.
      }
    }, 500);
  }, [attemptId]);

  function updateResponse(question: AttemptQuestionT, response: any) {
    setAnswers((prev) => {
      const answered = response !== null && response !== "" && !(Array.isArray(response) && response.length === 0);
      const next = { ...prev, [question.id]: { response, marked: prev[question.id]?.marked || false, answered } };
      saveAnswer(question.id, response, next[question.id].marked);
      return next;
    });
  }

  function toggleMark(question: AttemptQuestionT) {
    setAnswers((prev) => {
      const marked = !prev[question.id]?.marked;
      const next = { ...prev, [question.id]: { ...prev[question.id], marked } };
      saveAnswer(question.id, next[question.id].response, marked);
      return next;
    });
  }

  async function handleAutoSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/attempts/${attemptId}/submit`);
    } catch {
      // Already submitted server-side by the expiry check - safe to ignore.
    } finally {
      engineRef.current?.stop();
      document.exitFullscreen?.().catch(() => undefined);
      navigate(`/attempt/${attemptId}/submitted`);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.post(`/attempts/${attemptId}/submit`);
      engineRef.current?.stop();
      document.exitFullscreen?.().catch(() => undefined);
      navigate(`/attempt/${attemptId}/submitted`);
    } catch (err) {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  }

  if (isLoading || !attempt) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner className="text-navy-500" size={28} /></div>;
  }

  const question = attempt.questions[current];
  const state = answers[question.id];
  const answeredCount = Object.values(answers).filter((a) => a.answered).length;
  const markedCount = Object.values(answers).filter((a) => a.marked).length;

  return (
    <div className="min-h-screen bg-canvas">
      {/* Hidden camera feed for proctoring - not shown large to avoid distraction, small corner indicator only */}
      <video ref={videoRef} muted playsInline className="fixed bottom-4 right-4 z-40 h-20 w-28 rounded-control border border-line object-cover shadow-pop" style={{ display: attempt.proctoring_enabled ? "block" : "none" }} />

      <header className="sticky top-0 z-30 border-b border-line bg-surface px-4 py-3 md:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logomark size={24} />
            <div>
              <div className="text-sm font-semibold text-ink">{attempt.exam_title}</div>
              <div className="text-xs text-ink-muted">{attempt.exam_subject}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {attempt.proctoring_enabled && (
              <span className={`flex items-center gap-1.5 text-xs ${cameraOk ? "text-success" : "text-ink-faint"}`}>
                <Camera size={13} /> {cameraOk ? "Monitoring active" : "Camera unavailable"}
              </span>
            )}
            <div className={`rounded-control px-3 py-1.5 font-mono text-sm font-semibold ${secondsLeft !== null && secondsLeft < 300 ? "bg-danger-bg text-danger" : "bg-navy-50 text-navy-700"}`}>
              {formatDuration(secondsLeft ?? 0)}
            </div>
          </div>
        </div>
      </header>

      {warning && (
        <div className="fixed left-1/2 top-16 z-40 -translate-x-1/2 rounded-control border border-warning/30 bg-warning-bg px-4 py-2 text-sm font-medium text-warning shadow-pop">
          <AlertTriangle size={14} className="mr-1.5 inline" /> {warning}
        </div>
      )}

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[1fr_260px] md:px-6">
        <main className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-muted">Question {current + 1} of {attempt.questions.length}</span>
            <span className="text-xs text-ink-faint">{question.marks} marks &middot; {questionTypeLabel(question.question_type)}</span>
          </div>

          <p className="text-base leading-relaxed text-ink">{question.question_text}</p>

          <div className="mt-6 space-y-3">
            {question.question_type === "mcq" && question.options.map((opt) => (
              <OptionRow key={opt.label} selected={state?.response?.[0] === opt.label} label={opt.label} text={opt.text}
                onClick={() => updateResponse(question, [opt.label])} />
            ))}
            {question.question_type === "multi_select" && question.options.map((opt) => {
              const selected = Array.isArray(state?.response) && state.response.includes(opt.label);
              return (
                <OptionRow key={opt.label} selected={!!selected} label={opt.label} text={opt.text} square
                  onClick={() => {
                    const cur: string[] = Array.isArray(state?.response) ? state.response : [];
                    const next = cur.includes(opt.label) ? cur.filter((l) => l !== opt.label) : [...cur, opt.label];
                    updateResponse(question, next);
                  }} />
              );
            })}
            {question.question_type === "true_false" && ["True", "False"].map((v) => (
              <OptionRow key={v} selected={state?.response?.[0] === v} label={v[0]} text={v} onClick={() => updateResponse(question, [v])} />
            ))}
            {["short_answer", "long_answer", "descriptive"].includes(question.question_type) && (
              <textarea
                className="input min-h-[160px] resize-y"
                placeholder="Type your answer here..."
                value={state?.response || ""}
                onChange={(e) => updateResponse(question, e.target.value)}
              />
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} className="btn-secondary">
              <ChevronLeft size={15} /> Previous
            </button>
            <div className="flex gap-2">
              <button onClick={() => toggleMark(question)} className={`btn-secondary ${state?.marked ? "border-warning/40 bg-warning-bg text-warning" : ""}`}>
                <Flag size={15} /> {state?.marked ? "Marked" : "Mark for Review"}
              </button>
              {current < attempt.questions.length - 1 ? (
                <button onClick={() => setCurrent((c) => Math.min(attempt.questions.length - 1, c + 1))} className="btn-primary">
                  Save & Next <ChevronRight size={15} />
                </button>
              ) : (
                <button onClick={() => setConfirmSubmit(true)} className="btn-primary">Submit Examination</button>
              )}
            </div>
          </div>
        </main>

        <aside className="card h-fit p-4">
          <div className="mb-3 flex justify-between text-xs text-ink-muted">
            <span>{answeredCount} Answered</span>
            <span>{markedCount} Marked</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {attempt.questions.map((q, i) => {
              const s = answers[q.id];
              const isCurrent = i === current;
              let cls = "border-line text-ink-muted";
              if (isCurrent) cls = "border-navy-600 bg-navy-600 text-white";
              else if (s?.marked) cls = "border-warning bg-warning-bg text-warning";
              else if (s?.answered) cls = "border-success bg-success-bg text-success";
              return (
                <button key={q.id} onClick={() => setCurrent(i)} className={`flex h-9 items-center justify-center rounded-control border text-xs font-semibold ${cls}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-1.5 text-xs text-ink-muted">
            <Legend color="bg-success-bg border-success" label="Answered" />
            <Legend color="bg-warning-bg border-warning" label="Marked for Review" />
            <Legend color="bg-white border-line" label="Unanswered" />
          </div>
          <button onClick={() => setConfirmSubmit(true)} className="btn-primary mt-5 w-full">Submit Examination</button>
        </aside>
      </div>

      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-sm rounded-card bg-surface p-6 shadow-pop">
            <h3 className="font-display text-lg font-semibold text-ink">Submit Examination?</h3>
            <p className="mt-2 text-sm text-ink-muted">
              You've answered {answeredCount} of {attempt.questions.length} questions. Once submitted, you cannot make further changes.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmSubmit(false)} className="btn-secondary flex-1">Keep Working</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1">{submitting ? "Submitting..." : "Submit"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({ selected, label, text, onClick, square }: { selected: boolean; label: string; text: string; onClick: () => void; square?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-control border px-4 py-3 text-left text-sm transition-colors ${
        selected ? "border-navy-600 bg-navy-50" : "border-line hover:bg-canvas"
      }`}
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 text-xs font-bold ${square ? "rounded-md" : "rounded-full"} ${
        selected ? "border-navy-600 bg-navy-600 text-white" : "border-line text-ink-faint"
      }`}>
        {label}
      </span>
      <span className="text-ink">{text}</span>
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded border ${color}`} />
      {label}
    </div>
  );
}
