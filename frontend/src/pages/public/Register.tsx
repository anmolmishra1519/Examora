import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Logomark, Wordmark } from "@/components/layout/Logo";
import { useAuth } from "@/hooks/useAuth";
import { apiErrorMessage } from "@/lib/api";
import { ErrorBanner } from "@/components/ui/Badges";
import type { Role } from "@/types";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("faculty");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await register({ full_name: fullName, email, password, role: role as "faculty" | "student", department });
      navigate(user.role === "faculty" ? "/faculty" : "/student");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create your account."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <Logomark />
          <Wordmark />
        </Link>

        <div className="card p-8">
          <h1 className="font-display text-2xl font-semibold text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-ink-muted">Set up Examora for your college in a few minutes.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <ErrorBanner message={error} />}

            <div>
              <label className="label">I am a...</label>
              <div className="grid grid-cols-2 gap-2">
                {(["faculty", "student"] as const).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`rounded-control border px-4 py-2.5 text-sm font-semibold capitalize transition-colors ${
                      role === r ? "border-navy-600 bg-navy-50 text-navy-700" : "border-line text-ink-muted hover:bg-canvas"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="full_name">Full name</label>
              <input id="full_name" required className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Ananya Rao" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" />
            </div>
            {role === "faculty" && (
              <div>
                <label className="label" htmlFor="department">Department (optional)</label>
                <input id="department" className="input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Computer Science" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" required minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? "Creating account..." : "Create account"} <ArrowRight size={16} />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Already have an account? <Link to="/login" className="font-semibold text-navy-600 hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
