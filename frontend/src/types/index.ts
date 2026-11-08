export type Role = "faculty" | "student" | "admin";

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  department?: string | null;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  semester?: string | null;
  student_count: number;
}

export interface OptionT {
  id?: string;
  label: string;
  text: string;
  order: number;
}

export interface QuestionT {
  id: string;
  section_id: string;
  question_text: string;
  question_type: "mcq" | "multi_select" | "true_false" | "short_answer" | "long_answer" | "descriptive";
  marks: number;
  negative_marks: number;
  difficulty: string;
  order: number;
  explanation?: string | null;
  correct_answer: any;
  ai_generated_answer: boolean;
  needs_review: boolean;
  ai_confidence: Record<string, number>;
  options: OptionT[];
}

export interface SectionT {
  id: string;
  name: string;
  instructions?: string | null;
  order: number;
  questions: QuestionT[];
}

export type ExamStatus = "draft" | "scheduled" | "live" | "completed" | "archived";

export interface ExamT {
  id: string;
  title: string;
  subject: string;
  course_id?: string | null;
  semester?: string | null;
  exam_date?: string | null;
  duration_minutes: number;
  total_marks: number;
  passing_marks: number;
  negative_marking: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  allow_mark_for_review: boolean;
  free_navigation: boolean;
  proctoring_enabled: boolean;
  proctor_sensitivity: string;
  warning_limit: number;
  result_release_mode: string;
  reveal_answers: boolean;
  status: ExamStatus;
  access_code?: string | null;
  source_document_name?: string | null;
  processing_status: string;
  processing_log: string[];
  extraction_confidence: Record<string, any>;
  created_at: string;
  published_at?: string | null;
  sections: SectionT[];
  question_count: number;
}

export interface ExamListItemT {
  id: string;
  title: string;
  subject: string;
  status: ExamStatus;
  exam_date?: string | null;
  duration_minutes: number;
  total_marks: number;
  student_count: number;
  question_count: number;
}

export interface AttemptQuestionT {
  id: string;
  section_id: string;
  section_name: string;
  question_text: string;
  question_type: QuestionT["question_type"];
  marks: number;
  order: number;
  options: OptionT[];
  response: any;
  marked_for_review: boolean;
  is_answered: boolean;
}

export interface AttemptDetailT {
  id: string;
  exam_id: string;
  exam_title: string;
  exam_subject: string;
  status: string;
  server_start_time?: string | null;
  server_end_time?: string | null;
  seconds_remaining: number;
  duration_minutes: number;
  total_marks: number;
  proctoring_enabled: boolean;
  allow_mark_for_review: boolean;
  questions: AttemptQuestionT[];
}

export type ProctorEventType =
  | "FACE_NOT_DETECTED"
  | "MULTIPLE_FACES"
  | "STUDENT_LEFT_FRAME"
  | "POSSIBLE_PHONE"
  | "GAZE_OFF_SCREEN"
  | "TAB_SWITCH"
  | "WINDOW_BLUR"
  | "FULLSCREEN_EXIT"
  | "PAGE_VISIBILITY_CHANGE"
  | "AUDIO_ACTIVITY";

export interface ProctorEventT {
  id: string;
  event_type: ProctorEventType;
  severity: "low" | "medium" | "high";
  confidence: number;
  timestamp: string;
  duration_seconds: number;
  description: string;
  review_status: "detected" | "under_review" | "confirmed" | "dismissed";
  evidence_reference?: any;
  review?: { decision: string; notes?: string | null; faculty_id: string } | null;
}

export interface RiskT {
  score: number;
  risk_level: "low" | "medium" | "high";
  reasons: string[];
}

export interface LiveStudentCard {
  attempt_id: string;
  student_id: string;
  student_name: string;
  status: string;
  integrity_score: number;
  risk_level: "low" | "medium" | "high";
  event_count: number;
  warnings: number;
  session_id: string | null;
}

export interface ResultT {
  attempt_id: string;
  student_name: string;
  exam_title: string;
  total_marks: number;
  marks_obtained: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  pending_manual_grading: number;
  percentage: number;
  passed?: boolean | null;
  released: boolean;
}
