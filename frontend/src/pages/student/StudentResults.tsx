import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Award } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner, EmptyState } from "@/components/ui/Badges";

interface CompletedExam {
  id: string; title: string; subject: string; exam_date: string | null;
  score: number | null; total_marks: number; result_status: string; released: boolean;
}

export default function StudentResults() {
  const { data, isLoading } = useQuery<{ completed_exams: CompletedExam[] }>({
    queryKey: ["student-dashboard"],
    queryFn: () => api.get("/dashboard/student").then((r) => r.data),
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Results</h1>
      <p className="mt-1 text-sm text-ink-muted">Your released examination results.</p>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>
      ) : !data || data.completed_exams.length === 0 ? (
        <div className="mt-6"><EmptyState icon={<Award size={32} />} title="No results yet" description="Your results will appear here after you complete an examination." /></div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {data.completed_exams.map((e) => (
            <div key={e.id} className="card p-5">
              <h3 className="font-display text-base font-semibold text-ink">{e.title}</h3>
              <p className="text-sm text-ink-muted">{e.subject}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-ink-muted">{e.released && e.score !== null ? `${e.score} / ${e.total_marks}` : "Awaiting release"}</span>
                <span className={`badge ${e.result_status === "Pass" ? "bg-success-bg text-success" : e.result_status === "Fail" ? "bg-danger-bg text-danger" : "bg-ink/5 text-ink-muted"}`}>
                  {e.released ? e.result_status : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
