import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Logomark, Wordmark } from "@/components/layout/Logo";

export default function SubmissionConfirmation() {
  const { attemptId } = useParams();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <div className="mb-6 flex items-center gap-2">
        <Logomark />
        <Wordmark />
      </div>
      <CheckCircle2 size={48} className="mb-4 text-success" />
      <h1 className="font-display text-2xl font-semibold text-ink">Examination Submitted</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        Your answers have been recorded. Results will be available once your faculty releases them.
      </p>
      <div className="mt-8 flex gap-3">
        <Link to="/student" className="btn-primary">Back to Dashboard</Link>
        <Link to={`/student/results/${attemptId}`} className="btn-secondary">View Result Status</Link>
      </div>
    </div>
  );
}
