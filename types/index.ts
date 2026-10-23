export type UserRole = "student" | "mentor" | "hod";

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING_MENTOR"
  | "MENTOR_APPROVED"
  | "MENTOR_REJECTED"
  | "PENDING_HOD"
  | "HOD_APPROVED"
  | "HOD_REJECTED"
  | "CANCELLED";

export type LeaveCategory =
  | "Personal Leave"
  | "Medical Leave"
  | "Family Emergency"
  | "Campus Outing"
  | "Other";

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  email: string;
  department: string;
  year: string;
  section: string;
  password: string;
  avatar?: string;
  isDemo: boolean;
}

export interface Review {
  reviewerId: string;
  reviewerRole: "mentor" | "hod";
  reviewerName: string;
  decision: "approved" | "rejected";
  comment: string;
  reviewedAt: string;
}

export interface Application {
  id: string;
  reference: string;
  studentId: string;
  leaveType: LeaveCategory;
  startDate: string;
  endDate?: string;
  departureTime?: string;
  returnTime?: string;
  reason: string;
  additionalRemarks?: string;
  letterContent: string;
  submittedAt: string;
  status: ApplicationStatus;
  mentorReview: Review | null;
  hodReview: Review | null;
  verificationToken: string | null;
  verificationUrl: string | null;
  isDemo: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  userRole: UserRole;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  applicationId?: string;
  read: boolean;
  createdAt: string;
}

export interface Mentor {
  id: string;
  name: string;
  staffId: string;
  email: string;
  department: string;
  password: string;
  assignedSections: string[];
  isDemo: boolean;
}

export interface HOD {
  id: string;
  name: string;
  staffId: string;
  email: string;
  department: string;
  password: string;
  isDemo: boolean;
}

export interface AuthSession {
  role: UserRole;
  userId: string;
  isDemo: boolean;
}