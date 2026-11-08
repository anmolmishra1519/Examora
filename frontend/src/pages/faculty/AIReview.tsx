import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Copy, ChevronDown, ChevronUp, AlertTriangle, Save, ArrowRight, GripVertical,
} from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Spinner, ConfidenceBar, ErrorBanner } from "@/components/ui/Badges";
import { questionTypeLabel } from "@/lib/format";
import type { ExamT, QuestionT, SectionT } from "@/types";

const QUESTION_TYPES: QuestionT["question_type"][] = ["mcq", "multi_select", "true_false", "short_answer", "long_answer", "descriptive"];

let tempIdCounter = 0;
const tempId = () => `tmp-${Date.now()}-${tempIdCounter++}`;

export default function AIReview() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: exam, isLoading } = useQuery<ExamT>({
    queryKey: ["exam", examId],
    queryFn: () => api.get(`/exams/${examId}`).then((r) => r.data),
  });

  const [sections, setSections] = useState<SectionT[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (exam) setSections(JSON.parse(JSON.stringify(exam.sections)));
  }, [exam?.id]);

  if (isLoading || !exam) {
    return <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>;
  }

  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);
  const totalMarks = sections.reduce((sum, s) => sum + s.questions.reduce((m, q) => m + (Number(q.marks) || 0), 0), 0);
  const needsReviewCount = sections.reduce((sum, s) => sum + s.questions.filter((q) => q.needs_review).length, 0);

  function updateSection(id: string, patch: Partial<SectionT>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSection() {
    const newSection: SectionT = { id: tempId(), name: `Section ${sections.length + 1}`, instructions: "", order: sections.length, questions: [] };
    setSections((prev) => [...prev, newSection]);
  }

  function deleteSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function updateQuestion(sectionId: string, qId: string, patch: Partial<QuestionT>) {
    setSections((prev) => prev.map((s) => s.id !== sectionId ? s : {
      ...s, questions: s.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)),
    }));
  }

  function addQuestion(sectionId: string) {
    setSections((prev) => prev.map((s) => s.id !== sectionId ? s : {
      ...s,
      questions: [...s.questions, {
        id: tempId(), section_id: sectionId, question_text: "", question_type: "mcq", marks: 1,
        negative_marks: 0, difficulty: "medium", order: s.questions.length, explanation: null,
        correct_answer: null, ai_generated_answer: false, needs_review: true, ai_confidence: {},
        options: [{ label: "A", text: "", order: 0 }, { label: "B", text: "", order: 1 }, { label: "C", text: "", order: 2 }, { label: "D", text: "", order: 3 }],
      }],
    }));
  }

  function duplicateQuestion(sectionId: string, question: QuestionT) {
    setSections((prev) => prev.map((s) => s.id !== sectionId ? s : {
      ...s, questions: [...s.questions, { ...JSON.parse(JSON.stringify(question)), id: tempId() }],
    }));
  }

  function deleteQuestion(sectionId: string, qId: string) {
    setSections((prev) => prev.map((s) => s.id !== sectionId ? s : { ...s, questions: s.questions.filter((q) => q.id !== qId) }));
  }

  function moveQuestion(sectionId: string, index: number, dir: -1 | 1) {
    setSections((prev) => prev.map((s) => {
      if (s.id !== sectionId) return s;
      const qs = [...s.questions];
      const target = index + dir;
      if (target < 0 || target >= qs.length) return s;
      [qs[index], qs[target]] = [qs[target], qs[index]];
      return { ...s, questions: qs };
    }));
  }

  function updateOption(sectionId: string, qId: string, optIndex: number, patch: { label?: string; text?: string }) {
    setSections((prev) => prev.map((s) => s.id !== sectionId ? s : {
      ...s, questions: s.questions.map((q) => q.id !== qId ? q : {
        ...q, options: q.options.map((o, i) => (i === optIndex ? { ...o, ...patch } : o)),
      }),
    }));
  }

  async function handleSave(continueNext: boolean) {
    setSaving(true);
    setError(null);
    try {
      const payload = { sections: sections.map((s, si) => ({
        name: s.name, instructions: s.instructions, order: si,
        questions: s.questions.map((q, qi) => ({
          question_text: q.question_text, question_type: q.question_type, marks: Number(q.marks) || 0,
          negative_marks: Number(q.negative_marks) || 0, difficulty: q.difficulty, order: qi,
          explanation: q.explanation, correct_answer: q.correct_answer, ai_generated_answer: q.ai_generated_answer,
          needs_review: q.needs_review, ai_confidence: q.ai_confidence,
          options: q.options.map((o, oi) => ({ label: o.label, text: o.text, order: oi })),
        })),
      }))};
      await api.put(`/exams/${examId}/questions`, payload);
      await queryClient.invalidateQueries({ queryKey: ["exam", examId] });
      if (continueNext) navigate(`/faculty/exams/${examId}/configure`);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save your changes."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <h1 className="font-display text-2xl font-semibold text-ink">Review Your Examination</h1>
      <p className="mt-1 text-sm text-ink-muted">Confirm every question before configuring and publishing.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryChip label="Questions" value={totalQuestions} />
        <SummaryChip label="Sections" value={sections.length} />
        <SummaryChip label="Marks" value={totalMarks} />
        <SummaryChip label="Need Review" value={needsReviewCount} highlight={needsReviewCount > 0} />
      </div>

      {error && <div className="mt-4"><ErrorBanner message={error} /></div>}

      <div className="mt-6 space-y-5">
        {sections.map((section) => (
          <div key={section.id} className="card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <input
                  className="input font-display text-base font-semibold"
                  value={section.name}
                  onChange={(e) => updateSection(section.id, { name: e.target.value })}
                />
                <input
                  className="input text-sm"
                  placeholder="Section instructions (e.g. 10 x 1 = 10 marks)"
                  value={section.instructions || ""}
                  onChange={(e) => updateSection(section.id, { instructions: e.target.value })}
                />
              </div>
              <button onClick={() => deleteSection(section.id)} className="btn-ghost !px-2 text-danger hover:bg-danger-bg">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {section.questions.map((q, qi) => (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  index={qi}
                  total={section.questions.length}
                  expanded={!!expanded[q.id]}
                  onToggle={() => setExpanded((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                  onChange={(patch) => updateQuestion(section.id, q.id, patch)}
                  onOptionChange={(i, patch) => updateOption(section.id, q.id, i, patch)}
                  onDuplicate={() => duplicateQuestion(section.id, q)}
                  onDelete={() => deleteQuestion(section.id, q.id)}
                  onMove={(dir) => moveQuestion(section.id, qi, dir)}
                />
              ))}
            </div>

            <button onClick={() => addQuestion(section.id)} className="btn-secondary mt-3 w-full !py-2 text-sm">
              <Plus size={15} /> Add Question
            </button>
          </div>
        ))}

        <button onClick={addSection} className="btn-secondary w-full py-3">
          <Plus size={16} /> Add Section
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 md:px-0">
          <span className="text-sm text-ink-muted">{totalQuestions} questions &middot; {totalMarks} marks</span>
          <div className="flex gap-2">
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary">
              <Save size={15} /> Save Draft
            </button>
            <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save & Configure Exam"} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryChip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`card px-4 py-3 ${highlight ? "border-warning/30 bg-warning-bg" : ""}`}>
      <div className={`font-display text-xl font-semibold ${highlight ? "text-warning" : "text-ink"}`}>{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}

function QuestionEditor({
  question, index, total, expanded, onToggle, onChange, onOptionChange, onDuplicate, onDelete, onMove,
}: {
  question: QuestionT; index: number; total: number; expanded: boolean;
  onToggle: () => void; onChange: (patch: Partial<QuestionT>) => void;
  onOptionChange: (i: number, patch: { label?: string; text?: string }) => void;
  onDuplicate: () => void; onDelete: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const hasOptions = question.question_type === "mcq" || question.question_type === "multi_select";
  const confidence = question.ai_confidence || {};

  return (
    <div className={`rounded-control border ${question.needs_review ? "border-warning/40 bg-warning-bg/40" : "border-line bg-canvas/40"} p-4`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5 pt-1">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="text-ink-faint hover:text-ink disabled:opacity-30"><ChevronUp size={14} /></button>
          <GripVertical size={13} className="text-ink-faint" />
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="text-ink-faint hover:text-ink disabled:opacity-30"><ChevronDown size={14} /></button>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-faint">Q{index + 1}</span>
            <div className="flex items-center gap-1.5">
              {question.needs_review && (
                <span className="badge bg-warning-bg text-warning"><AlertTriangle size={11} /> Needs Review</span>
              )}
              {question.ai_generated_answer && (
                <span className="badge bg-navy-50 text-navy-600">AI Suggested Answer</span>
              )}
              <button onClick={onDuplicate} className="btn-ghost !px-1.5 !py-1"><Copy size={14} /></button>
              <button onClick={onDelete} className="btn-ghost !px-1.5 !py-1 text-danger hover:bg-danger-bg"><Trash2 size={14} /></button>
              <button onClick={onToggle} className="btn-ghost !px-1.5 !py-1">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
            </div>
          </div>

          <textarea
            className="input mt-2 min-h-[52px] resize-y"
            value={question.question_text}
            onChange={(e) => onChange({ question_text: e.target.value })}
            placeholder="Question text"
          />

          {expanded && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={question.question_type} onChange={(e) => onChange({ question_type: e.target.value as any })}>
                    {QUESTION_TYPES.map((t) => <option key={t} value={t}>{questionTypeLabel(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Marks</label>
                  <input type="number" step="0.5" className="input" value={question.marks} onChange={(e) => onChange({ marks: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Difficulty</label>
                  <select className="input" value={question.difficulty} onChange={(e) => onChange({ difficulty: e.target.value })}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {hasOptions && (
                <div className="space-y-2">
                  <label className="label">Options &amp; Correct Answer</label>
                  {question.options.map((opt, i) => {
                    const isCorrect = Array.isArray(question.correct_answer)
                      ? question.correct_answer.includes(opt.label)
                      : question.correct_answer === opt.label;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (question.question_type === "multi_select") {
                              const current: string[] = Array.isArray(question.correct_answer) ? question.correct_answer : [];
                              const next = current.includes(opt.label) ? current.filter((l) => l !== opt.label) : [...current, opt.label];
                              onChange({ correct_answer: next, ai_generated_answer: false });
                            } else {
                              onChange({ correct_answer: [opt.label], ai_generated_answer: false });
                            }
                          }}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                            isCorrect ? "border-success bg-success text-white" : "border-line text-ink-faint hover:border-navy-400"
                          }`}
                          title="Mark as correct answer"
                        >
                          {opt.label}
                        </button>
                        <input
                          className="input"
                          value={opt.text}
                          onChange={(e) => onOptionChange(i, { text: e.target.value })}
                          placeholder={`Option ${opt.label}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {question.question_type === "true_false" && (
                <div>
                  <label className="label">Correct Answer</label>
                  <div className="flex gap-2">
                    {["True", "False"].map((v) => (
                      <button
                        key={v}
                        onClick={() => onChange({ correct_answer: [v], ai_generated_answer: false })}
                        className={`rounded-control border px-4 py-2 text-sm font-medium ${
                          question.correct_answer?.[0] === v ? "border-navy-600 bg-navy-50 text-navy-700" : "border-line text-ink-muted"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(question.question_type === "short_answer" || question.question_type === "long_answer" || question.question_type === "descriptive") && (
                <p className="rounded-control bg-navy-50 px-3 py-2 text-xs text-navy-700">
                  This question type is manually graded by faculty after submission — no auto-checkable answer key is required.
                </p>
              )}

              <div>
                <label className="label">Explanation (optional)</label>
                <textarea className="input min-h-[44px]" value={question.explanation || ""} onChange={(e) => onChange({ explanation: e.target.value })} placeholder="Shown to students if answers are revealed after grading" />
              </div>

              {Object.keys(confidence).length > 0 && (
                <div className="space-y-1.5 rounded-control bg-canvas px-3 py-2.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">AI Confidence</div>
                  {Object.entries(confidence).map(([k, v]) => (
                    <ConfidenceBar key={k} label={k} value={v as number} />
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input type="checkbox" checked={question.needs_review} onChange={(e) => onChange({ needs_review: e.target.checked })} />
                Flag for further review
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
