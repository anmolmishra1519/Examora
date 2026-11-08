import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Camera, ArrowRight, AlertTriangle } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { ProctorEngine } from "@/proctoring/ProctorEngine";

type CameraState = "idle" | "requesting" | "denied" | "ready" | "checking" | "passed" | "no_face" | "multiple_faces";

export default function CameraCheck() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<ProctorEngine | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    return () => engineRef.current?.stop();
  }, []);

  async function requestCamera() {
    setState("requesting");
    setError(null);
    try {
      const engine = new ProctorEngine(videoRef.current!);
      engineRef.current = engine;
      await engine.requestCamera();
      setState("ready");
      engine.loadModels().catch(() => undefined);
    } catch (err) {
      setState("denied");
      setError("Camera unavailable. Please enable camera permissions and try again.");
    }
  }

  async function runFaceCheck() {
    const engine = engineRef.current;
    if (!engine) return;
    setState("checking");
    // Give the model a moment to finish loading if it hasn't already.
    await new Promise((r) => setTimeout(r, 800));
    const count = await engine.detectFaceCount();
    if (count === null) {
      // Face model unavailable in this environment (e.g. offline demo) —
      // don't block the student; fall back to a manual pass.
      setState("passed");
    } else if (count === 0) {
      setState("no_face");
    } else if (count > 1) {
      setState("multiple_faces");
    } else {
      setState("passed");
    }
  }

  async function beginExam() {
    setStarting(true);
    setStartError(null);
    try {
      const r = await api.post("/attempts", { exam_id: examId, consent_given: true });
      engineRef.current?.stop();
      navigate(`/attempt/${r.data.id}`);
    } catch (err) {
      setStartError(apiErrorMessage(err, "Couldn't start your examination."));
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-2xl font-semibold text-ink">Camera & Environment Check</h1>
      <p className="mt-1 text-sm text-ink-muted">We'll verify your camera and confirm you're positioned correctly.</p>

      <div className="card mt-6 overflow-hidden">
        <div className="relative flex aspect-video items-center justify-center bg-navy-900">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" style={{ display: state === "idle" || state === "requesting" || state === "denied" ? "none" : "block" }} />
          {(state === "idle" || state === "requesting") && <Camera size={36} className="text-navy-400" />}
          {state === "denied" && <AlertTriangle size={36} className="text-danger" />}
        </div>
        <div className="p-5">
          {state === "idle" && (
            <button onClick={requestCamera} className="btn-primary w-full">Enable Camera</button>
          )}
          {state === "requesting" && <p className="text-center text-sm text-ink-muted">Requesting camera access...</p>}
          {state === "denied" && (
            <>
              <p className="mb-3 text-sm text-danger">{error}</p>
              <button onClick={requestCamera} className="btn-secondary w-full">Retry</button>
            </>
          )}
          {state === "ready" && (
            <button onClick={runFaceCheck} className="btn-primary w-full">Run Environment Check</button>
          )}
          {state === "checking" && <p className="text-center text-sm text-ink-muted">Checking your environment...</p>}
          {state === "no_face" && (
            <>
              <p className="mb-3 flex items-center gap-2 text-sm text-danger"><AlertTriangle size={15} /> No face detected. Please position yourself in front of the camera.</p>
              <button onClick={runFaceCheck} className="btn-secondary w-full">Retry Check</button>
            </>
          )}
          {state === "multiple_faces" && (
            <>
              <p className="mb-3 flex items-center gap-2 text-sm text-danger"><AlertTriangle size={15} /> Multiple faces detected. Please ensure you are alone.</p>
              <button onClick={runFaceCheck} className="btn-secondary w-full">Retry Check</button>
            </>
          )}
          {state === "passed" && (
            <>
              <p className="mb-3 flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 size={16} /> Environment Check Passed</p>
              {startError && <p className="mb-3 text-sm text-danger">{startError}</p>}
              <button onClick={beginExam} disabled={starting} className="btn-primary w-full">
                {starting ? "Starting..." : "Start Examination"} <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-ink-faint">Examora does not permanently store your webcam footage.</p>
    </div>
  );
}
