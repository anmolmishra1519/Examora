import axios from "axios";

// In local dev, Vite's proxy (see vite.config.ts) forwards /api -> the
// FastAPI server, so no env var is needed. In production (e.g. a Vercel
// frontend talking to a separate Render backend), set VITE_API_URL to the
// full backend URL, such as https://examora-api.onrender.com.
const baseURL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("examora_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("examora_token");
      localStorage.removeItem("examora_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const anyErr = err as any;
  return anyErr?.response?.data?.detail || anyErr?.message || fallback;
}

/** Downloads a file from an authenticated API endpoint (e.g. PDF/CSV report
 * exports). A plain <a href> can't carry the JWT Bearer header these routes
 * require, so we fetch as a blob and trigger the save via an object URL. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await api.get(path, { responseType: "blob" });
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
