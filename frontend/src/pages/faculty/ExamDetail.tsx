import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  PenSquare, Settings, Eye, Radio, Award, BarChart3, Copy, Check, FileText,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Spinner, StatusBadge } from "@/components/ui/Badges";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ExamT } from "@/types";

export default function ExamDetail() {
  const { examId } = useParams();
  const [copied, setCopied] = useState(false);

  const { data: exam, isLoading } = useQuery<ExamT>({
    queryKey: ["exam", examId],
    queryFn: () => api.get(`/exams/${examId}`).then((r) => r.data),
  });

  if (isLoading || !exam) {
    return <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>;
  }

  function copyCode() {
    if (exam?.access_code) {
      navigator.clipboard.writeText(exam.access_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const isPublished = exam.status !== "draft";
  const isDone = exam.status === "completed" || exam.status === "archived";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <StatusBadge status={exam.status} />
            {exam.processing_status !== "none" && exam.processing_status !== "ready" && (
              <StatusBadge status={exam.processing_status} />
            )}
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">{exam.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{exam.subject} {exam.semester ? `· ${exam.semester}` : ""}</p>
        </div>
        {exam.access_code && (
          <div className="card flex items-center gap-3 px-4 py-2.5">
            <div>
              <div className="text-xs text-ink-muted">Access Code</div>
              <div className="font-mono text-sm font-semibold text-navy-700">{exam.access_code}</div>
            </div>
            <button onClick={copyCode} className="btn-ghost !px-2">
              {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <InfoStat label="Questions" value={exam.question_count} />
        <InfoStat label="Total Marks" value={exam.total_marks} />
        <InfoStat label="Duration" value={`${exam.duration_minutes} min`} />
        <InfoStat label="Exam Date" value={formatDate(exam.exam_date)} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          to={`/faculty/exams/${examId}/review`}
          icon={PenSquare}
          title="Review & Edit Questions"
          description={`${exam.question_count} questions across ${exam.sections.length} sections. Edit, add, or reorder before publishing.`}
        />
        <ActionCard
          to={`/faculty/exams/${examId}/configure`}
          icon={Settings}
          title="Exam Configuration"
          description="Duration, marks, randomization, proctoring sensitivity, and result release settings."
        />
        <ActionCard
          to={`/faculty/exams/${examId}/preview`}
          icon={Eye}
          title={isPublished ? "Preview" : "Preview & Publish"}
          description={isPublished ? "See exactly what students see." : "Review the exam exactly as students will see it, then publish."}
        />
        {isPublished && (
          <>
            <ActionCard to={`/faculty/monitoring/${examId}`} icon={Radio} title="Live Monitoring" description="Watch active attempts and integrity signals in real time." />
            <ActionCard to={`/faculty/results/${examId}`} icon={Award} title="Results" description="Auto-graded scores, manual grading, and result release." />
            <ActionCard to={`/faculty/reports/${examId}`} icon={BarChart3} title="Reports" description="Score distribution, integrity statistics, PDF & CSV export." />
          </>
        )}
      </div>

      {exam.source_document_name && (
        <div className="card mt-6 flex items-center gap-3 px-5 py-4">
          <FileText size={18} className="text-navy-500" />
          <div className="text-sm">
            <span className="font-medium text-ink">{exam.source_document_name}</span>
            <span className="text-ink-muted"> — uploaded source document</span>
          </div>
        </div>
      )}

      {exam.published_at && (
        <p className="mt-4 text-xs text-ink-faint">Published {formatDateTime(exam.published_at)}</p>
      )}
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="font-display text-xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}

function ActionCard({ to, icon: Icon, title, description }: { to: string; icon: any; title: string; description: string }) {
  return (
    <Link to={to} className="card p-5 transition-shadow hover:shadow-pop">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-control bg-navy-50 text-navy-600">
        <Icon size={18} />
      </div>
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
    </Link>
  );
}
