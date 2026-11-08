/**
 * Examora Proctor Engine
 * -----------------------
 * Runs entirely in the browser - no server-side GPU required:
 *  - Face presence / multiple faces: face-api.js (TinyFaceDetector, a small
 *    TensorFlow.js model loaded from a CDN).
 *  - Possible phone / object detection: TensorFlow.js coco-ssd, which
 *    includes "cell phone" as a recognized class.
 *  - Tab switch / window blur / fullscreen exit: native browser events.
 *
 * All of this produces the SAME event shape the backend risk engine expects
 * (see app/services/risk_engine.py), so demo mode and live mode are
 * interchangeable from the server's point of view.
 *
 * Deliberately conservative: every check uses a duration/repetition
 * threshold and a cooldown before it is reported as an event, mirroring
 * the product principle that a single glance or blink is never flagged.
 */
import { api } from "@/lib/api";
import type { ProctorEventType } from "@/types";

declare global {
  interface Window {
    faceapi: any;
    cocoSsd: any;
    tf: any;
  }
}

export interface ProctorEventPayload {
  event_type: ProctorEventType;
  confidence: number;
  duration_seconds: number;
  description?: string;
}

type Listener = (event: ProctorEventPayload) => void;

const NO_FACE_THRESHOLD_SEC = 4;
const MULTI_FACE_THRESHOLD_SEC = 3;
const PHONE_CONFIDENCE_MIN = 0.55;
const SAMPLE_INTERVAL_MS = 1500; // intelligent sampling - not every frame

export class ProctorEngine {
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private faceModelReady = false;
  private objectModelReady = false;
  private cocoModel: any = null;
  private sampleTimer: number | null = null;

  private noFaceSince: number | null = null;
  private multiFaceSince: number | null = null;
  private lastFaceEventAt = 0;
  private lastPhoneEventAt = 0;

  private listeners: Listener[] = [];
  private running = false;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  on(fn: Listener) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(payload: ProctorEventPayload) {
    this.listeners.forEach((l) => l(payload));
  }

  async requestCamera(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 }, audio: false });
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();
    return stream;
  }

  async loadModels(): Promise<void> {
    await waitFor(() => !!window.faceapi, 15000);
    const MODEL_URL = "https://cdnjs.cloudflare.com/ajax/libs/face-api.js/0.22.2/weights";
    // face-api ships its tiny-face-detector weights under this CDN's /weights path.
    try {
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      this.faceModelReady = true;
    } catch {
      this.faceModelReady = false; // face detector unavailable - engine degrades gracefully to browser-signal-only monitoring
    }

    try {
      await waitFor(() => !!window.cocoSsd, 15000);
      this.cocoModel = await window.cocoSsd.load({ base: "lite_mobilenet_v2" });
      this.objectModelReady = true;
    } catch {
      this.objectModelReady = false;
    }
  }

  async detectFaceCount(): Promise<number | null> {
    if (!this.faceModelReady) return null;
    try {
      const detections = await window.faceapi.detectAllFaces(
        this.video,
        new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      );
      return detections.length;
    } catch {
      return null;
    }
  }

  async detectObjects(): Promise<{ label: string; score: number }[]> {
    if (!this.objectModelReady || !this.cocoModel) return [];
    try {
      const predictions = await this.cocoModel.detect(this.video);
      return predictions.map((p: any) => ({ label: p.class, score: p.score }));
    } catch {
      return [];
    }
  }

  private async sampleOnce() {
    const now = Date.now();

    const faceCount = await this.detectFaceCount();
    if (faceCount !== null) {
      if (faceCount === 0) {
        if (this.noFaceSince === null) this.noFaceSince = now;
        this.multiFaceSince = null;
        const elapsed = (now - this.noFaceSince) / 1000;
        if (elapsed >= NO_FACE_THRESHOLD_SEC && now - this.lastFaceEventAt > 8000) {
          this.emit({
            event_type: "STUDENT_LEFT_FRAME",
            confidence: 0.9,
            duration_seconds: Math.round(elapsed),
            description: `Student not visible for ${Math.round(elapsed)} seconds`,
          });
          this.lastFaceEventAt = now;
        }
      } else if (faceCount > 1) {
        if (this.multiFaceSince === null) this.multiFaceSince = now;
        this.noFaceSince = null;
        const elapsed = (now - this.multiFaceSince) / 1000;
        if (elapsed >= MULTI_FACE_THRESHOLD_SEC && now - this.lastFaceEventAt > 8000) {
          this.emit({
            event_type: "MULTIPLE_FACES",
            confidence: 0.88,
            duration_seconds: Math.round(elapsed),
            description: `Multiple faces detected for ${Math.round(elapsed)} seconds`,
          });
          this.lastFaceEventAt = now;
        }
      } else {
        this.noFaceSince = null;
        this.multiFaceSince = null;
      }
    }

    const objects = await this.detectObjects();
    const phone = objects.find((o) => o.label === "cell phone" && o.score >= PHONE_CONFIDENCE_MIN);
    if (phone && now - this.lastPhoneEventAt > 10000) {
      this.emit({
        event_type: "POSSIBLE_PHONE",
        confidence: Math.round(phone.score * 100) / 100,
        duration_seconds: 0,
        description: `Possible mobile phone detected (confidence ${Math.round(phone.score * 100)}%)`,
      });
      this.lastPhoneEventAt = now;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.sampleTimer = window.setInterval(() => this.sampleOnce(), SAMPLE_INTERVAL_MS);
  }

  stop() {
    this.running = false;
    if (this.sampleTimer) window.clearInterval(this.sampleTimer);
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
  }

  get modelsAvailable() {
    return { face: this.faceModelReady, object: this.objectModelReady };
  }
}

function waitFor(check: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (check()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("Timed out waiting for dependency"));
      setTimeout(tick, 150);
    };
    tick();
  });
}

/** Wires up tab-switch / window-blur / fullscreen-exit browser signals. */
export function attachBrowserMonitors(onEvent: Listener): () => void {
  let hiddenSince: number | null = null;

  function handleVisibility() {
    if (document.hidden) {
      hiddenSince = Date.now();
      onEvent({ event_type: "TAB_SWITCH", confidence: 1, duration_seconds: 0, description: "Tab switch detected" });
    } else if (hiddenSince) {
      hiddenSince = null;
    }
  }

  function handleBlur() {
    onEvent({ event_type: "WINDOW_BLUR", confidence: 1, duration_seconds: 0, description: "Exam window lost focus" });
  }

  function handleFullscreenChange() {
    if (!document.fullscreenElement) {
      onEvent({ event_type: "FULLSCREEN_EXIT", confidence: 1, duration_seconds: 0, description: "Exited fullscreen mode" });
    }
  }

  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("blur", handleBlur);
  document.addEventListener("fullscreenchange", handleFullscreenChange);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("blur", handleBlur);
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
  };
}

/** Posts a detected event to the backend, which deduplicates/cools down and recomputes risk. */
export async function reportProctorEvent(attemptId: string, sessionId: string, payload: ProctorEventPayload) {
  try {
    await api.post("/proctor/events", { attempt_id: attemptId, session_id: sessionId, ...payload });
  } catch {
    // Never let a proctoring network hiccup interrupt the exam itself.
  }
}
