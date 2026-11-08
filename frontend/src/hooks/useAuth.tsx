import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: { full_name: string; email: string; password: string; role: "faculty" | "student"; department?: string }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("examora_token");
    const cached = localStorage.getItem("examora_user");
    if (token && cached) {
      setUser(JSON.parse(cached));
      api.get("/auth/me").then((r) => {
        setUser(r.data);
        localStorage.setItem("examora_user", JSON.stringify(r.data));
      }).catch(() => {
        localStorage.removeItem("examora_token");
        localStorage.removeItem("examora_user");
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email: string, password: string) {
    const r = await api.post("/auth/login", { email, password });
    localStorage.setItem("examora_token", r.data.access_token);
    localStorage.setItem("examora_user", JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user as User;
  }

  async function register(payload: { full_name: string; email: string; password: string; role: "faculty" | "student"; department?: string }) {
    const r = await api.post("/auth/register", payload);
    localStorage.setItem("examora_token", r.data.access_token);
    localStorage.setItem("examora_user", JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user as User;
  }

  function logout() {
    localStorage.removeItem("examora_token");
    localStorage.removeItem("examora_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
