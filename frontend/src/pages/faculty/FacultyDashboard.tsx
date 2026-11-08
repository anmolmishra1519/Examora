import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, FileText, Users, TrendingUp, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/ui/Badges";
import { Spinner } from "@/components/ui/Badges";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/format";

interface DashboardData {
  active_exams: number;
  upcoming_exams: number;
  completed_exams: number;
  total_students: number;
  average_score: number;
  pass_percentage: number;
  high_risk_attempts: number;
  recent_exams: { id: string; title: string; subject: string; status: string; exam_date: string | null; student_count: number }[];
}

export default function FacultyDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["faculty-dashboard"],
    queryFn: () => api.get("/dashboard/faculty").then((r) => r.data),
  });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Welcome back, {user?.full_name?.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-ink-muted">Here's what's happening across your examinations.</p>
        </div>
        <Link to="/faculty/exams/new" className="btn-primary">
          <Plus size={16} /> Create Examination
        </Link>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Active Exams" value={data.active_exams} icon={FileText} tone="navy" />
            <StatCard label="Upcoming Exams" value={data.upcoming_exams} icon={FileText} tone="ink" />
            <StatCard label="Completed Exams" value={data.completed_exams} icon={FileText} tone="ink" />
            <StatCard label="Total Students" value={data.total_students} icon={Users} tone="ink" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard label="Average Score" value={`${data.average_score}%`} icon={TrendingUp} />
            <MetricCard label="Pass Percentage" value={`${data.pass_percentage}%`} icon={TrendingUp} />
            <MetricCard label="High-Risk Attempts" value={data.high_risk_attempts} icon={ShieldAlert} tone="danger" />
          </div>

          <div className="card mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="font-display text-lg font-semibold text-ink">Recent Examinations</h2>
              <Link to="/faculty/exams" className="text-sm font-semibold text-navy-600 hover:underline">View all</Link>
            </div>
            {data.recent_exams.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-ink-muted">
                No examinations yet. <Link to="/faculty/exams/new" className="font-semibold text-navy-600 hover:underline">Create your first one</Link>.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-6 py-3">Exam</th>
                    <th className="px-6 py-3">Students</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_exams.map((e) => (
                    <tr key={e.id} className="border-b border-line last:border-0 hover:bg-canvas/60">
                      <td className="px-6 py-4">
                        <div className="font-medium text-ink">{e.title}</div>
                        <div className="text-xs text-ink-muted">{e.subject}</div>
                      </td>
                      <td className="px-6 py-4 text-ink-muted">{e.student_count} Students</td>
                      <td className="px-6 py-4 text-ink-muted">{formatDate(e.exam_date)}</td>
                      <td className="px-6 py-4"><StatusBadge status={e.status} /></td>
                      <td className="px-6 py-4 text-right">
                        <Link to={`/faculty/exams/${e.id}`} className="text-sm font-semibold text-navy-600 hover:underline">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: "navy" | "ink" }) {
  return (
    <div className="card p-5">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-control ${tone === "navy" ? "bg-navy-600 text-white" : "bg-navy-50 text-navy-600"}`}>
        <Icon size={16} />
      </div>
      <div className="font-display text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs font-medium text-ink-muted">{label}</div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone?: "danger" }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tone === "danger" ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="font-display text-xl font-semibold text-ink">{value}</div>
        <div className="text-xs font-medium text-ink-muted">{label}</div>
      </div>
    </div>
  );
}
