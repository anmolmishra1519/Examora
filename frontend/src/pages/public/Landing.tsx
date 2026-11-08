import { Link } from "react-router-dom";
import {
  ArrowRight, Upload, Wand2, ListChecks, Eye, CheckCircle2, ShieldCheck,
  Camera, MonitorSmartphone, ScanEye, FileWarning, Lock, ClipboardCheck,
} from "lucide-react";
import { Logomark, Wordmark } from "@/components/layout/Logo";

const builderSteps = [
  { icon: Upload, title: "Upload", text: "Faculty upload an existing question paper — PDF, DOCX, JPG, or PNG." },
  { icon: Wand2, title: "Understand", text: "Examora reads the document and identifies sections, questions, marks, and options." },
  { icon: ListChecks, title: "Structure", text: "Everything is organized into a clean, ready-to-configure examination." },
  { icon: Eye, title: "Review", text: "Faculty confirms every AI-extracted detail before anything goes live." },
  { icon: CheckCircle2, title: "Publish", text: "One click generates an access code and opens the exam to students." },
];

const proctorSignals = [
  { icon: Camera, label: "Camera" },
  { icon: MonitorSmartphone, label: "Browser Activity" },
  { icon: ScanEye, label: "Computer Vision" },
];

const faqs = [
  {
    q: "Does Examora accuse students of cheating?",
    a: "No. Examora surfaces potentially suspicious activity with supporting evidence. Every finding requires a faculty member's review before any academic decision is made.",
  },
  {
    q: "What happens if the document AI misreads a question?",
    a: "Every extracted question, option, mark, and answer carries a confidence score. Anything uncertain is flagged for review, and nothing is ever silently invented.",
  },
  {
    q: "Does Examora record continuous video?",
    a: "No. Examora is built around event metadata and minimal evidence rather than continuous recording, in line with our privacy-by-design approach.",
  },
  {
    q: "Can we self-host Examora?",
    a: "Yes. The stack is a standard React/FastAPI/PostgreSQL application designed to run on infrastructure your institution already trusts.",
  },
];

export default function Landing() {
  return (
    <div className="bg-canvas">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Logomark />
            <Wordmark />
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink-muted md:flex">
            <a href="#builder" className="hover:text-ink">Exam Builder</a>
            <a href="#proctor" className="hover:text-ink">Exam Proctor</a>
            <a href="#privacy" className="hover:text-ink">Privacy</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost !px-3">Log in</Link>
            <Link to="/register" className="btn-primary">Create Examination</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <div className="grid items-center gap-14 md:grid-cols-2">
          <div>
            <span className="eyebrow">Smart college examination platform</span>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-ink md:text-6xl">
              Build. Conduct.<br />Verify.
            </h1>
            <p className="mt-6 max-w-md text-lg text-ink-muted">
              Smart examination infrastructure for modern colleges and universities. Turn existing
              question papers into structured online exams, and monitor integrity with evidence — not accusations.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register" className="btn-primary px-5 py-3 text-base">
                Create Examination <ArrowRight size={17} />
              </Link>
              <a href="#builder" className="btn-secondary px-5 py-3 text-base">See How It Works</a>
            </div>
          </div>

          {/* Signature element: an answer-sheet / OMR grid rendered as a live artifact */}
          <AnswerSheetSignature />
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card p-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-control bg-navy-50 text-navy-600">
              <Upload size={20} />
            </div>
            <h3 className="font-display text-xl font-semibold text-ink">Exam Builder</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Turn question papers into structured online examinations. Upload a PDF, DOCX, JPG, or
              PNG and Examora extracts sections, questions, marks, and options automatically.
            </p>
          </div>
          <div className="card p-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-control bg-navy-50 text-navy-600">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-display text-xl font-semibold text-ink">Exam Proctor</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Identify potentially suspicious examination activity and provide evidence-based
              insights so faculty can review examination integrity with confidence.
            </p>
          </div>
        </div>
      </section>

      {/* Exam Builder marketing section */}
      <section id="builder" className="border-y border-line bg-surface py-20">
        <div className="mx-auto max-w-6xl px-6">
          <span className="eyebrow">Exam Builder</span>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold text-ink md:text-4xl">
            Turn Question Papers Into Exams
          </h2>
          <p className="mt-4 max-w-lg text-ink-muted">
            Upload an existing question paper and let Examora structure it into a ready-to-conduct
            digital examination — no manual re-typing required.
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-5">
            {builderSteps.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="card h-full p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-navy-600 text-white">
                    <step.icon size={16} />
                  </div>
                  <div className="font-display text-base font-semibold text-ink">{step.title}</div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{step.text}</p>
                </div>
                {i < builderSteps.length - 1 && (
                  <div className="absolute right-[-10px] top-1/2 hidden -translate-y-1/2 text-line md:block">
                    <ArrowRight size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proctoring marketing section */}
      <section id="proctor" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <span className="eyebrow">Exam Proctor</span>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold text-ink md:text-4xl">
            Evidence-Based Examination Integrity
          </h2>
          <p className="mt-4 max-w-lg text-ink-muted">
            Examora identifies potentially suspicious activity and helps faculty review examination
            integrity with evidence — the final academic decision always belongs to authorized faculty.
          </p>

          <div className="mt-12 grid items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
            <div className="flex justify-center gap-4">
              {proctorSignals.map((s) => (
                <div key={s.label} className="card flex w-28 flex-col items-center gap-2 px-3 py-5 text-center">
                  <s.icon size={20} className="text-navy-600" />
                  <span className="text-xs font-medium text-ink-muted">{s.label}</span>
                </div>
              ))}
            </div>
            <ArrowRight size={20} className="mx-auto hidden text-line md:block" />
            <div className="flex flex-col gap-3">
              {[
                { icon: FileWarning, label: "Suspicious Events", tone: "text-warning" },
                { icon: ScanEye, label: "Risk Analysis", tone: "text-navy-600" },
                { icon: ClipboardCheck, label: "Faculty Review", tone: "text-success" },
              ].map((s) => (
                <div key={s.label} className="card flex items-center gap-3 px-4 py-3">
                  <s.icon size={18} className={s.tone} />
                  <span className="text-sm font-medium text-ink">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy & security */}
      <section id="privacy" className="border-y border-line bg-navy-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-300">Privacy by design</span>
              <h2 className="mt-3 font-display text-3xl font-semibold">
                Metadata, not surveillance.
              </h2>
              <p className="mt-4 max-w-md text-navy-100">
                Examora never permanently stores raw webcam footage by default. Event metadata and
                minimal evidence power every integrity decision — with explicit student consent before
                monitoring ever begins.
              </p>
            </div>
            <div className="grid gap-3">
              {[
                "Explicit student consent before every exam",
                "Role-based access control across faculty and students",
                "Configurable evidence retention, not continuous recording",
                "Full audit logging of every faculty decision",
              ].map((line) => (
                <div key={line} className="flex items-start gap-3 rounded-control border border-white/10 bg-white/5 px-4 py-3">
                  <Lock size={16} className="mt-0.5 shrink-0 text-navy-300" />
                  <span className="text-sm text-navy-50">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="mb-10 text-center font-display text-3xl font-semibold text-ink">Frequently asked questions</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="card group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-ink">
                {f.q}
                <span className="ml-4 text-ink-faint transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-ink-muted md:flex-row">
          <div className="flex items-center gap-2">
            <Logomark size={22} />
            <span className="font-display font-semibold text-ink">Examora</span>
          </div>
          <p>Build. Conduct. Verify.</p>
          <p>&copy; {new Date().getFullYear()} Examora. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

/** Signature hero visual: a stylized answer sheet / OMR grid, evoking the
 * physical exam paper Examora digitizes - filled in as if mid-exam. */
function AnswerSheetSignature() {
  const rows = [1, 2, 3, 4, 5, 6];
  const filled: Record<number, number> = { 1: 1, 2: 3, 3: 0, 5: 2 };
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-3 -z-10 rounded-[22px] bg-gradient-to-br from-navy-100 to-transparent blur-2xl" />
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-navy-600 px-5 py-3 text-white">
          <span className="font-display text-sm font-semibold">Database Management Systems</span>
          <span className="font-mono text-xs text-navy-200">DBMS-28A7</span>
        </div>
        <div className="space-y-3 px-5 py-5">
          {rows.map((row) => (
            <div key={row} className="flex items-center gap-3">
              <span className="w-5 text-xs font-semibold text-ink-faint">{row}.</span>
              <div className="flex gap-2">
                {["A", "B", "C", "D"].map((label, i) => (
                  <div
                    key={label}
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                      filled[row] === i
                        ? "border-navy-600 bg-navy-600 text-white"
                        : "border-line text-ink-faint"
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line bg-canvas px-5 py-3">
          <span className="text-xs text-ink-muted">Question 6 of 30</span>
          <span className="font-mono text-xs font-semibold text-navy-600">01:24:36</span>
        </div>
      </div>
    </div>
  );
}
