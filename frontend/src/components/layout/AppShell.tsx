import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, Radio, BarChart3, ScrollText, Settings, LogOut,
  GraduationCap, ClipboardList, Award, Menu, X,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import { Logomark, Wordmark } from "./Logo";
import { useAuth } from "@/hooks/useAuth";

const facultyNav = [
  { to: "/faculty", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/faculty/exams", label: "Examinations", icon: FileText },
  { to: "/faculty/monitoring", label: "Live Monitoring", icon: Radio },
  { to: "/faculty/results", label: "Results", icon: Award },
  { to: "/faculty/reports", label: "Reports", icon: BarChart3 },
  { to: "/faculty/audit-logs", label: "Audit Logs", icon: ScrollText },
];

const studentNav = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/student/exams", label: "Examinations", icon: ClipboardList },
  { to: "/student/results", label: "Results", icon: GraduationCap },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = user?.role === "faculty" ? facultyNav : studentNav;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Logomark size={26} />
          <Wordmark />
        </div>
        <button className="btn-ghost !px-2" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar */}
        <aside
          className={clsx(
            "fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-line bg-surface md:sticky md:top-0 md:block md:h-screen",
            mobileOpen ? "block" : "hidden"
          )}
        >
          <div className="flex h-full flex-col px-4 py-5">
            <div className="mb-8 hidden items-center gap-2 px-2 md:flex">
              <Logomark size={30} />
              <div>
                <Wordmark />
                <div className="-mt-1 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
                  Build. Conduct. Verify.
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive ? "bg-navy-600 text-white" : "text-ink-muted hover:bg-navy-50 hover:text-navy-700"
                    )
                  }
                >
                  <item.icon size={17} />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-6 border-t border-line pt-4">
              <div className="mb-3 flex items-center gap-3 px-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-100 font-display text-sm font-semibold text-navy-700">
                  {user?.full_name?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{user?.full_name}</div>
                  <div className="truncate text-xs capitalize text-ink-muted">{user?.role}</div>
                </div>
              </div>
              <button onClick={handleLogout} className="btn-ghost w-full justify-start !px-3">
                <LogOut size={16} /> Log out
              </button>
            </div>
          </div>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-30 bg-ink/20 md:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Main content */}
        <main className="min-h-screen w-full flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
