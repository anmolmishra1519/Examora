import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from "lucide-react";

interface CheckResult {
  label: string;
  status: "checking" | "pass" | "fail";
  detail?: string;
}

export default function SystemCheck() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [checks, setChecks] = useState<CheckResult[]>([
    { label: "Browser", status: "checking" },
    { label: "Fullscreen Support", status: "checking" },
    { label: "Network", status: "checking" },
    { label: "Local Storage", status: "checking" },
  ]);

  function runChecks() {
    setChecks((prev) => prev.map((c) => ({ ...c, status: "checking" })));

    setTimeout(() => {
      const isSupportedBrowser = "fetch" in window && "Promise" in window;
      const supportsFullscreen = !!document.documentElement.requestFullscreen;
      const isOnline = navigator.onLine;
      let storageOk = true;
      try {
        window.sessionStorage.setItem("examora_check", "1");
        window.sessionStorage.removeItem("examora_check");
      } catch {
        storageOk = false;
      }

      setChecks([
        { label: "Browser", status: isSupportedBrowser ? "pass" : "fail", detail: isSupportedBrowser ? "Supported" : "Please use a modern browser (Chrome, Edge, Firefox)" },
        { label: "Fullscreen Support", status: supportsFullscreen ? "pass" : "fail", detail: supportsFullscreen ? "Supported" : "Your browser does not support fullscreen mode" },
        { label: "Network", status: isOnline ? "pass" : "fail", detail: isOnline ? "Stable" : "No network connection detected" },
        { label: "Local Storage", status: storageOk ? "pass" : "fail", detail: storageOk ? "Available" : "Storage is blocked — check browser privacy settings" },
      ]);
    }, 700);
  }

  useEffect(() => { runChecks(); }, []);

  const allDone = checks.every((c) => c.status !== "checking");
  const allPass = checks.every((c) => c.status === "pass");

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-2xl font-semibold text-ink">System Check</h1>
      <p className="mt-1 text-sm text-ink-muted">Confirming your device meets the examination requirements.</p>

      <div className="card mt-6 divide-y divide-line">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-medium text-ink">{c.label}</div>
              {c.status !== "checking" && <div className="text-xs text-ink-muted">{c.detail}</div>}
            </div>
            {c.status === "checking" && <div className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-navy-600" />}
            {c.status === "pass" && <CheckCircle2 size={18} className="text-success" />}
            {c.status === "fail" && <XCircle size={18} className="text-danger" />}
          </div>
        ))}
      </div>

      {allDone && !allPass && (
        <div className="mt-4 rounded-control border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
          Some checks failed. Please resolve the issues above and retry.
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <button onClick={runChecks} className="btn-secondary flex-1"><RotateCcw size={15} /> Retry</button>
        <button
          onClick={() => navigate(`/student/exams/${examId}/camera-check`)}
          disabled={!allDone || !allPass}
          className="btn-primary flex-1"
        >
          Continue <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
