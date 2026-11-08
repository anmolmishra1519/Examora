import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner, EmptyState, StatusBadge } from "@/components/ui/Badges";
import { formatDateTime } from "@/lib/format";
import type { ExamListItemT } from "@/types";

export default function StudentExams() {
  const { data, isLoading } = useQuery<ExamListItemT[]>({
    queryKey: ["exams"],
    queryFn: () => api.get("/exams").then((r) => r.data),
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Examinations</h1>
      <p className="mt-1 text-sm text-ink-muted">All examinations available to you.</p>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>
      ) : !data || data.length === 0 ? (
        <div className="mt-6"><EmptyState icon={<ClipboardList size={32} />} title="No examinations available" /></div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {data.map((e) => (
            <div key={e.id} className="card p-5">
              <div className="mb-2 flex items-center justify-between">
                <StatusBadge status={e.status} />
                <span className="text-xs text-ink-muted">{e.total_marks} Marks</span>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink">{e.title}</h3>
              <p className="text-sm text-ink-muted">{e.subject}</p>
              <div className="mt-3 text-sm text-ink-muted">{formatDateTime(e.exam_date)} &middot; {e.duration_minutes} min</div>
              <Link to={`/student/exams/${e.id}/instructions`} className="btn-primary mt-4 w-full">View Examination</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
