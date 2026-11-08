import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Plus, FileText, Search } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge, Spinner, EmptyState } from "@/components/ui/Badges";
import { formatDate } from "@/lib/format";
import type { ExamListItemT, ExamStatus } from "@/types";

const filters: { key: ExamStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];

export default function ExamsList() {
  const [filter, setFilter] = useState<ExamStatus | "all">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<ExamListItemT[]>({
    queryKey: ["exams"],
    queryFn: () => api.get("/exams").then((r) => r.data),
  });

  const filtered = (data || [])
    .filter((e) => filter === "all" || e.status === filter)
    .filter((e) => (e.title + e.subject).toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Examinations</h1>
          <p className="mt-1 text-sm text-ink-muted">Manage every exam you've built, scheduled, or run.</p>
        </div>
        <Link to="/faculty/exams/new" className="btn-primary"><Plus size={16} /> Create Examination</Link>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key ? "bg-navy-600 text-white" : "bg-white text-ink-muted border border-line hover:bg-canvas"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="input w-56 pl-9" placeholder="Search exams..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText size={32} />}
          title="No examinations found"
          description="Try a different filter, or create your first examination to get started."
          action={<Link to="/faculty/exams/new" className="btn-primary mt-2"><Plus size={16} /> Create Examination</Link>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exam) => (
            <Link to={`/faculty/exams/${exam.id}`} key={exam.id} className="card p-5 transition-shadow hover:shadow-pop">
              <div className="mb-3 flex items-start justify-between">
                <StatusBadge status={exam.status} />
                <span className="text-xs text-ink-faint">{formatDate(exam.exam_date)}</span>
              </div>
              <h3 className="font-display text-lg font-semibold leading-snug text-ink">{exam.title}</h3>
              <p className="mt-0.5 text-sm text-ink-muted">{exam.subject}</p>
              <div className="mt-4 flex items-center gap-4 text-xs text-ink-muted">
                <span>{exam.question_count} Questions</span>
                <span>{exam.total_marks} Marks</span>
                <span>{exam.duration_minutes} min</span>
                {exam.student_count > 0 && <span>{exam.student_count} Students</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
