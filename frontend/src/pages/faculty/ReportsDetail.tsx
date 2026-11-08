import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Download } from "lucide-react";
import { api, downloadFile } from "@/lib/api";
import { Spinner } from "@/components/ui/Badges";

interface ReportData {
  exam_id: string; title: string; subject: string;
  total_students: number; submitted: number; not_submitted: number;
  average_score: number; highest_score: number; lowest_score: number;
  pass_percentage: number;
  integrity_distribution: { low: number; medium: number; high: number };
  score_distribution: number[];
}

const RISK_COLORS: Record<string, string> = { low: "#1E8A5F", medium: "#A8710A", high: "#B23A2E" };

export default function ReportsDetail() {
  const { examId } = useParams();
  const { data, isLoading } = useQuery<ReportData>({
    queryKey: ["report", examId],
    queryFn: () => api.get(`/reports/exam/${examId}`).then((r) => r.data),
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>;
  }

  const scoreBuckets = bucketScores(data.score_distribution);
  const riskData = [
    { name: "Low", value: data.integrity_distribution.low, key: "low" },
    { name: "Medium", value: data.integrity_distribution.medium, key: "medium" },
    { name: "High", value: data.integrity_distribution.high, key: "high" },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{data.title} — Report</h1>
          <p className="mt-1 text-sm text-ink-muted">{data.subject}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadFile(`/reports/exam/${examId}/csv`, `${data.title}-report.csv`)} className="btn-secondary"><Download size={15} /> Export CSV</button>
          <button onClick={() => downloadFile(`/reports/exam/${examId}/pdf`, `${data.title}-report.pdf`)} className="btn-secondary"><Download size={15} /> Export PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total Students" value={data.total_students} />
        <Stat label="Submitted" value={data.submitted} />
        <Stat label="Average Score" value={data.average_score} />
        <Stat label="Pass %" value={`${data.pass_percentage}%`} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 font-display text-base font-semibold text-ink">Score Distribution</h3>
          {scoreBuckets.every((b) => b.count === 0) ? (
            <p className="py-10 text-center text-sm text-ink-muted">No scored submissions yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={scoreBuckets}>
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#5B6172" }} axisLine={{ stroke: "#E5E4DE" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5B6172" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#F7F6F1" }} contentStyle={{ borderRadius: 10, border: "1px solid #E5E4DE" }} />
                <Bar dataKey="count" fill="#26326B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="mb-4 font-display text-base font-semibold text-ink">Integrity Risk Distribution</h3>
          {riskData.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">No proctoring data recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {riskData.map((d) => <Cell key={d.key} fill={RISK_COLORS[d.key]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E5E4DE" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 flex justify-center gap-4 text-xs">
            {riskData.map((d) => (
              <div key={d.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[d.key] }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="font-display text-xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}

function bucketScores(scores: number[]) {
  const buckets = [
    { range: "0-20%", min: 0, max: 20, count: 0 },
    { range: "21-40%", min: 21, max: 40, count: 0 },
    { range: "41-60%", min: 41, max: 60, count: 0 },
    { range: "61-80%", min: 61, max: 80, count: 0 },
    { range: "81-100%", min: 81, max: 100, count: 0 },
  ];
  const max = Math.max(1, ...scores);
  scores.forEach((s) => {
    const pct = (s / max) * 100;
    const bucket = buckets.find((b) => pct >= b.min && pct <= b.max);
    if (bucket) bucket.count += 1;
  });
  return buckets;
}
