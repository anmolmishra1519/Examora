import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Award } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner, EmptyState, StatusBadge } from "@/components/ui/Badges";
import type { ExamListItemT } from "@/types";

export default function ResultsPicker() {
  const { data, isLoading } = useQuery<ExamListItemT[]>({
    queryKey: ["exams"],
    queryFn: () => api.get("/exams").then((r) => r.data),
  });

  const withResults = (data || []).filter((e) => e.status === "live" || e.status === "completed");

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Results</h1>
      <p className="mt-1 text-sm text-ink-muted">Select an examination to view and grade results.</p>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>
      ) : withResults.length === 0 ? (
        <div className="mt-6"><EmptyState icon={<Award size={32} />} title="No results yet" description="Results will appear once an examination has been published and attempted." /></div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {withResults.map((exam) => (
            <Link to={`/faculty/results/${exam.id}`} key={exam.id} className="card p-5 hover:shadow-pop">
              <div className="mb-2 flex items-center justify-between">
                <StatusBadge status={exam.status} />
                <span className="text-xs text-ink-muted">{exam.student_count} Students</span>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink">{exam.title}</h3>
              <p className="text-sm text-ink-muted">{exam.subject}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
