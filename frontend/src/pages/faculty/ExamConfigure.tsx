import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Spinner, ErrorBanner } from "@/components/ui/Badges";
import type { ExamT } from "@/types";

export default function ExamConfigure() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { data: exam, isLoading } = useQuery<ExamT>({
    queryKey: ["exam", examId],
    queryFn: () => api.get(`/exams/${examId}`).then((r) => r.data),
  });

  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exam) {
      setForm({
        title: exam.title, subject: exam.subject, semester: exam.semester || "",
        exam_date: exam.exam_date ? toLocalInput(exam.exam_date) : "",
        duration_minutes: exam.duration_minutes, passing_marks: exam.passing_marks || Math.round(exam.total_marks * 0.4),
        negative_marking: exam.negative_marking, randomize_questions: exam.randomize_questions,
        randomize_options: exam.randomize_options, allow_mark_for_review: exam.allow_mark_for_review,
        free_navigation: exam.free_navigation, proctoring_enabled: exam.proctoring_enabled,
        proctor_sensitivity: exam.proctor_sensitivity, warning_limit: exam.warning_limit,
        result_release_mode: exam.result_release_mode, reveal_answers: exam.reveal_answers,
      });
    }
  }, [exam?.id]);

  if (isLoading || !exam || !form) {
    return <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>;
  }

  function set(key: string, value: any) {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.put(`/exams/${examId}`, {
        ...form,
        exam_date: form.exam_date ? new Date(form.exam_date).toISOString() : null,
        duration_minutes: Number(form.duration_minutes),
        passing_marks: Number(form.passing_marks),
        warning_limit: Number(form.warning_limit),
      });
      navigate(`/faculty/exams/${examId}/preview`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <h1 className="font-display text-2xl font-semibold text-ink">Exam Configuration</h1>
      <p className="mt-1 text-sm text-ink-muted">Set the rules students will experience during this examination.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {error && <ErrorBanner message={error} />}

        <Section title="Basics">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title"><input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
            <Field label="Subject"><input className="input" value={form.subject} onChange={(e) => set("subject", e.target.value)} /></Field>
            <Field label="Semester"><input className="input" value={form.semester} onChange={(e) => set("semester", e.target.value)} /></Field>
            <Field label="Date & Time"><input type="datetime-local" className="input" value={form.exam_date} onChange={(e) => set("exam_date", e.target.value)} /></Field>
            <Field label="Duration (minutes)"><input type="number" className="input" value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} /></Field>
            <Field label={`Passing Marks (of ${exam.total_marks})`}><input type="number" className="input" value={form.passing_marks} onChange={(e) => set("passing_marks", e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Question Behavior">
          <Toggle label="Negative Marking" checked={form.negative_marking} onChange={(v) => set("negative_marking", v)} />
          <Toggle label="Randomize Question Order" checked={form.randomize_questions} onChange={(v) => set("randomize_questions", v)} />
          <Toggle label="Randomize Option Order" checked={form.randomize_options} onChange={(v) => set("randomize_options", v)} />
          <Toggle label="Allow Mark for Review" checked={form.allow_mark_for_review} onChange={(v) => set("allow_mark_for_review", v)} />
          <Toggle label="Free Navigation Between Questions" checked={form.free_navigation} onChange={(v) => set("free_navigation", v)} />
        </Section>

        <Section title="Proctoring">
          <Toggle label="Enable Exam Proctor" checked={form.proctoring_enabled} onChange={(v) => set("proctoring_enabled", v)} />
          {form.proctoring_enabled && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Field label="Sensitivity">
                <select className="input" value={form.proctor_sensitivity} onChange={(e) => set("proctor_sensitivity", e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </Field>
              <Field label="Warning Limit"><input type="number" className="input" value={form.warning_limit} onChange={(e) => set("warning_limit", e.target.value)} /></Field>
            </div>
          )}
        </Section>

        <Section title="Results">
          <Field label="Result Release">
            <select className="input" value={form.result_release_mode} onChange={(e) => set("result_release_mode", e.target.value)}>
              <option value="manual">Manual — I'll release results myself</option>
              <option value="automatic">Automatic — release as soon as graded</option>
            </select>
          </Field>
          <Toggle label="Reveal Correct Answers with Results" checked={form.reveal_answers} onChange={(v) => set("reveal_answers", v)} />
        </Section>

        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? "Saving..." : "Continue to Preview"} <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-display text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-control border border-line px-3.5 py-2.5">
      <span className="text-sm text-ink">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-navy-600" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}
