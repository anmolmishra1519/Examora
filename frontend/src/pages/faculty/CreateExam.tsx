import { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileType2, PenSquare, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api";
import { ErrorBanner } from "@/components/ui/Badges";

type Mode = "choose" | "upload" | "manual";

export default function CreateExam() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("choose");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const ALLOWED = [".pdf", ".docx", ".jpg", ".jpeg", ".png"];

  function validateAndSetFile(f: File) {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED.includes(ext)) {
      setError(`Unsupported file type: ${ext}. Please upload a PDF, DOCX, JPG, or PNG.`);
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError("File exceeds the 20MB upload limit.");
      return;
    }
    setError(null);
    setFile(f);
  }

  async function handleUploadSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a question paper to upload.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await api.post("/exams/upload", formData, {
        params: { title, subject },
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/faculty/exams/${r.data.id}/processing`);
    } catch (err) {
      setError(apiErrorMessage(err, "We couldn't upload this document. Please try again."));
      setSubmitting(false);
    }
  }

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await api.post("/exams", { title, subject });
      navigate(`/faculty/exams/${r.data.id}/review`);
    } catch (err) {
      setError(apiErrorMessage(err));
      setSubmitting(false);
    }
  }

  if (mode === "choose") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-semibold text-ink">Create Examination</h1>
        <p className="mt-1 text-sm text-ink-muted">Choose how you'd like to build this exam.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <button onClick={() => setMode("upload")} className="card group p-6 text-left transition-shadow hover:shadow-pop">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-control bg-navy-600 text-white">
              <Upload size={20} />
            </div>
            <h3 className="font-display text-lg font-semibold text-ink">Upload Existing Question Paper</h3>
            <p className="mt-1.5 text-sm text-ink-muted">Let Examora read your PDF, DOCX, JPG, or PNG and structure it automatically.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-navy-600">
              Recommended <ArrowRight size={14} />
            </span>
          </button>

          <button onClick={() => setMode("manual")} className="card group p-6 text-left transition-shadow hover:shadow-pop">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-control bg-navy-50 text-navy-600">
              <PenSquare size={20} />
            </div>
            <h3 className="font-display text-lg font-semibold text-ink">Create Manually</h3>
            <p className="mt-1.5 text-sm text-ink-muted">Start from a blank examination and build sections and questions yourself.</p>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <div className="mx-auto max-w-lg">
        <button onClick={() => setMode("choose")} className="mb-4 text-sm font-medium text-ink-muted hover:text-ink">&larr; Back</button>
        <h1 className="font-display text-2xl font-semibold text-ink">Create Manually</h1>
        <form onSubmit={handleManualSubmit} className="card mt-6 space-y-4 p-6">
          {error && <ErrorBanner message={error} />}
          <div>
            <label className="label">Examination Title</label>
            <input required className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mid Semester Examination" />
          </div>
          <div>
            <label className="label">Subject</label>
            <input required className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Database Management Systems" />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
            {submitting ? "Creating..." : "Continue to Question Editor"} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <button onClick={() => setMode("choose")} className="mb-4 text-sm font-medium text-ink-muted hover:text-ink">&larr; Back</button>
      <h1 className="font-display text-2xl font-semibold text-ink">Upload Question Paper</h1>
      <form onSubmit={handleUploadSubmit} className="card mt-6 space-y-5 p-6">
        {error && <ErrorBanner message={error} />}

        <div>
          <label className="label">Examination Title</label>
          <input required className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mid Semester Examination" />
        </div>
        <div>
          <label className="label">Subject</label>
          <input required className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Database Management Systems" />
        </div>

        <div>
          <label className="label">Question Paper</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files[0]) validateAndSetFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInput.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver ? "border-navy-500 bg-navy-50" : "border-line bg-canvas hover:bg-navy-50/40"
            }`}
          >
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
            />
            {file ? (
              <>
                <FileType2 size={28} className="mb-2 text-navy-600" />
                <div className="text-sm font-semibold text-ink">{file.name}</div>
                <div className="text-xs text-ink-muted">{(file.size / 1024).toFixed(0)} KB</div>
              </>
            ) : (
              <>
                <Upload size={28} className="mb-2 text-navy-400" />
                <div className="text-sm font-semibold text-ink">Drag & drop your document</div>
                <div className="my-1 text-xs text-ink-muted">or</div>
                <span className="btn-secondary !py-1.5 !px-3 text-xs">Browse Files</span>
                <div className="mt-3 text-xs text-ink-faint">PDF &bull; DOCX &bull; JPG &bull; PNG</div>
              </>
            )}
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
          {submitting ? "Uploading..." : "Upload & Process"} <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}
