import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner, EmptyState } from "@/components/ui/Badges";
import { formatDateTime } from "@/lib/format";

interface AuditEntry {
  id: string; actor: string; action: string; entity: string; entity_id: string | null;
  timestamp: string; metadata: Record<string, any>;
}

export default function AuditLogs() {
  const { data, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["audit-logs"],
    queryFn: () => api.get("/audit-logs").then((r) => r.data),
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Audit Logs</h1>
      <p className="mt-1 text-sm text-ink-muted">A complete record of activity across your examinations.</p>

      <div className="card mt-6 overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner className="text-navy-500" size={28} /></div>
        ) : !data || data.length === 0 ? (
          <EmptyState icon={<ScrollText size={32} />} title="No activity recorded yet" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {data.map((log) => (
                <tr key={log.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{log.actor || "System"}</td>
                  <td className="px-5 py-3 text-ink-muted">{log.action}</td>
                  <td className="px-5 py-3 text-ink-muted">{log.entity}</td>
                  <td className="px-5 py-3 text-ink-faint">{formatDateTime(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
