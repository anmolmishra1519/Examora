export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

export function questionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    mcq: "Multiple Choice",
    multi_select: "Multiple Select",
    true_false: "True / False",
    short_answer: "Short Answer",
    long_answer: "Long Answer",
    descriptive: "Descriptive",
  };
  return map[type] || type;
}
