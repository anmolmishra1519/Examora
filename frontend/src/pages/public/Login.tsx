import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Logomark, Wordmark } from "@/components/layout/Logo";
import { useAuth } from "@/hooks/useAuth";
import { apiErrorMessage } from "@/lib/api";
import { ErrorBanner } from "@/components/ui/Badges";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === "faculty" ? "/faculty" : "/student");
    } catch (err) {
      setError(apiErrorMessage(err, "Invalid email or password."));
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(role: "faculty" | "student") {
    setEmail(role === "faculty" ? "faculty@examora.app" : "student@examora.app");
    setPassword("Demo@123");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <Logomark />
          <Wordmark />
        </Link>

        <div className="card p-8">
          <h1 className="font-display text-2xl font-semibold text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-muted">Log in to your Examora account.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <ErrorBanner message={error} />}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? "Logging in..." : "Log in"} <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-6 rounded-control border border-dashed border-line bg-canvas px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Development / demo credentials</p>
            <div className="flex gap-2">
              <button onClick={() => fillDemo("faculty")} className="btn-secondary flex-1 !py-1.5 text-xs">Fill Faculty Demo</button>
              <button onClick={() => fillDemo("student")} className="btn-secondary flex-1 !py-1.5 text-xs">Fill Student Demo</button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-ink-muted">
            New to Examora? <Link to="/register" className="font-semibold text-navy-600 hover:underline">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
