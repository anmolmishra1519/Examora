import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/router/RequireAuth";
import AppShell from "@/components/layout/AppShell";

import Landing from "@/pages/public/Landing";
import Login from "@/pages/public/Login";
import Register from "@/pages/public/Register";

import FacultyDashboard from "@/pages/faculty/FacultyDashboard";
import ExamsList from "@/pages/faculty/ExamsList";
import CreateExam from "@/pages/faculty/CreateExam";
import ProcessingScreen from "@/pages/faculty/ProcessingScreen";
import ExamDetail from "@/pages/faculty/ExamDetail";
import AIReview from "@/pages/faculty/AIReview";
import ExamConfigure from "@/pages/faculty/ExamConfigure";
import ExamPreview from "@/pages/faculty/ExamPreview";
import MonitoringPicker from "@/pages/faculty/MonitoringPicker";
import LiveMonitoring from "@/pages/faculty/LiveMonitoring";
import StudentIntegrityReview from "@/pages/faculty/StudentIntegrityReview";
import ResultsPicker from "@/pages/faculty/ResultsPicker";
import ResultsDetail from "@/pages/faculty/ResultsDetail";
import ReportsPicker from "@/pages/faculty/ReportsPicker";
import ReportsDetail from "@/pages/faculty/ReportsDetail";
import AuditLogs from "@/pages/faculty/AuditLogs";

import StudentDashboard from "@/pages/student/StudentDashboard";
import StudentExams from "@/pages/student/StudentExams";
import ExamInstructions from "@/pages/student/ExamInstructions";
import SystemCheck from "@/pages/student/SystemCheck";
import CameraCheck from "@/pages/student/CameraCheck";
import ExamInterface from "@/pages/student/ExamInterface";
import SubmissionConfirmation from "@/pages/student/SubmissionConfirmation";
import StudentResults from "@/pages/student/StudentResults";
import StudentResultDetail from "@/pages/student/StudentResultDetail";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Full-screen exam experience lives outside AppShell chrome */}
            <Route element={<RequireAuth roles={["student"]} />}>
              <Route path="/attempt/:attemptId" element={<ExamInterface />} />
              <Route path="/attempt/:attemptId/submitted" element={<SubmissionConfirmation />} />
            </Route>

            <Route element={<RequireAuth roles={["faculty", "admin"]} />}>
              <Route element={<AppShell />}>
                <Route path="/faculty" element={<FacultyDashboard />} />
                <Route path="/faculty/exams" element={<ExamsList />} />
                <Route path="/faculty/exams/new" element={<CreateExam />} />
                <Route path="/faculty/exams/:examId" element={<ExamDetail />} />
                <Route path="/faculty/exams/:examId/processing" element={<ProcessingScreen />} />
                <Route path="/faculty/exams/:examId/review" element={<AIReview />} />
                <Route path="/faculty/exams/:examId/configure" element={<ExamConfigure />} />
                <Route path="/faculty/exams/:examId/preview" element={<ExamPreview />} />
                <Route path="/faculty/monitoring" element={<MonitoringPicker />} />
                <Route path="/faculty/monitoring/:examId" element={<LiveMonitoring />} />
                <Route path="/faculty/monitoring/:examId/student/:attemptId" element={<StudentIntegrityReview />} />
                <Route path="/faculty/results" element={<ResultsPicker />} />
                <Route path="/faculty/results/:examId" element={<ResultsDetail />} />
                <Route path="/faculty/reports" element={<ReportsPicker />} />
                <Route path="/faculty/reports/:examId" element={<ReportsDetail />} />
                <Route path="/faculty/audit-logs" element={<AuditLogs />} />
              </Route>
            </Route>

            <Route element={<RequireAuth roles={["student"]} />}>
              <Route element={<AppShell />}>
                <Route path="/student" element={<StudentDashboard />} />
                <Route path="/student/exams" element={<StudentExams />} />
                <Route path="/student/exams/:examId/instructions" element={<ExamInstructions />} />
                <Route path="/student/exams/:examId/system-check" element={<SystemCheck />} />
                <Route path="/student/exams/:examId/camera-check" element={<CameraCheck />} />
                <Route path="/student/results" element={<StudentResults />} />
                <Route path="/student/results/:attemptId" element={<StudentResultDetail />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
