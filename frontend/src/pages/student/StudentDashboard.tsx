import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarClock, GraduationCap } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner, EmptyState } from "@/components/ui/Badges";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/format";

interface StudentDashboardData {
  upcoming_exams: { id: string; title: string; subject: string; exam_date: string | null; duration_minutes: number; total_marks: number; status: string; in_progress: boolean }[];
  completed_exams: { id: string; title: string; subject: string; exam_date: string | null; score: number | null; total_marks: number; result_status: string; released: boolean }[];
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<StudentDashboardData>({
    queryKey: ["student-dashboard"],
    queryFn: () => api.get("/dashboard/student").then((r) => r.data),
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Welcome, {user?.full_name?.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-ink-muted">Here are your examinations.</p>

      {isLoading || !data ? (
        <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">Upcoming Examinations</h2>
            {data.upcoming_exams.length === 0 ? (
              <EmptyState icon={<CalendarClock size={28} />} title="No upcoming examinations" description="Your faculty will notify you once an exam is scheduled." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.upcoming_exams.map((e) => (
                  <div key={e.id} className="card p-5">
                    <h3 className="font-display text-base font-semibold text-ink">{e.title}</h3>
                    <p className="text-sm text-ink-muted">{e.subject}</p>
                    <div className="mt-3 space-y-1 text-sm text-ink-muted">
                      <div>{formatDateTime(e.exam_date)}</div>
                      <div>{e.duration_minutes} Minutes &middot; {e.total_marks} Marks</div>
                    </div>
                    <Link to={`/student/exams/${e.id}/instructions`} className="btn-primary mt-4 w-full">
                      {e.in_progress ? "Resume Examination" : "View Examination"}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">Completed Examinations</h2>
            {data.completed_exams.length === 0 ? (
              <EmptyState icon={<GraduationCap size={28} />} title="No completed examinations yet" />
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Score</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.completed_exams.map((e) => (
                      <tr key={e.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-3">
                          <div className="font-medium text-ink">{e.title}</div>
                          <div className="text-xs text-ink-muted">{e.subject}</div>
                        </td>
                        <td className="px-5 py-3 text-ink-muted">{formatDateTime(e.exam_date)}</td>
                        <td className="px-5 py-3 text-ink-muted">{e.released && e.score !== null ? `${e.score} / ${e.total_marks}` : "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`badge ${e.result_status === "Pass" ? "bg-success-bg text-success" : e.result_status === "Fail" ? "bg-danger-bg text-danger" : "bg-ink/5 text-ink-muted"}`}>
                            {e.released ? e.result_status : "Awaiting Release"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
