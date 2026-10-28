import { Application } from './data';
import { supabase, UserProfile } from './supabase';

type ApplicationRow = {
  id: string;
  reference: string;
  user_id: string;
  student_name: string;
  roll: string;
  department: string;
  year: string;
  section: string;
  type: string;
  from_date: string;
  to_date: string;
  departure_time: string;
  return_time: string;
  reason: string;
  status: Application['status'];
  created_at: string;
  mentor_comment: string | null;
  hod_comment: string | null;
  token: string;
};

export type VerifiedApplication = {
  reference: string;
  student_name: string;
  roll: string;
  from_date: string;
  to_date: string;
  status: string;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add the project URL and publishable key to .env.local.');
  }
  return supabase;
}

function toApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    name: row.student_name,
    roll: row.roll,
    branch: row.department,
    year: row.year,
    section: row.section,
    type: row.type,
    from: row.from_date,
    to: row.to_date,
    departure: row.departure_time,
    returnAt: row.return_time,
    reason: row.reason,
    status: row.status,
    created: row.created_at.slice(0, 10),
    mentorComment: row.mentor_comment ?? undefined,
    hodComment: row.hod_comment ?? undefined,
    token: row.token,
  };
}

const applicationColumns =
  'id,reference,user_id,student_name,roll,department,year,section,type,from_date,to_date,departure_time,return_time,reason,status,created_at,mentor_comment,hod_comment,token';

export async function hasReviewerAssignments(): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from('reviewer_assignments')
    .select('id')
    .limit(1);
  if (error) throw error;
  return data.length > 0;
}

export async function loadApplications(): Promise<Application[]> {
  const { data, error } = await requireSupabase()
    .from('leave_applications')
    .select(applicationColumns)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ApplicationRow[]).map(toApplication);
}

export async function createApplication(profile: UserProfile, input: {
  type: string;
  from: string;
  to: string;
  departure: string;
  returnAt: string;
  reason: string;
}): Promise<Application> {
  if (!profile.roll_number || !profile.department || !profile.year || !profile.section) {
    throw new Error('Complete your student profile before submitting a leave request.');
  }

  const { data, error } = await requireSupabase()
    .from('leave_applications')
    .insert({
      user_id: profile.id,
      student_name: profile.full_name,
      roll: profile.roll_number,
      department: profile.department,
      year: profile.year,
      section: profile.section,
      type: input.type,
      from_date: input.from,
      to_date: input.to,
      departure_time: input.departure,
      return_time: input.returnAt,
      reason: input.reason,
    })
    .select(applicationColumns)
    .single();

  if (error) throw error;
  return toApplication(data as ApplicationRow);
}

export async function recordDecision(
  id: string,
  role: 'mentor' | 'hod',
  decision: 'approve' | 'reject',
  comment: string,
): Promise<Application> {
  const status: Application['status'] = role === 'mentor'
    ? decision === 'approve' ? 'MENTOR_APPROVED' : 'MENTOR_REJECTED'
    : decision === 'approve' ? 'HOD_APPROVED' : 'HOD_REJECTED';
  const changes = role === 'mentor'
    ? { status, mentor_comment: comment }
    : { status, hod_comment: comment };
  const { data, error } = await requireSupabase()
    .from('leave_applications')
    .update(changes)
    .eq('id', id)
    .select(applicationColumns)
    .single();
  if (error) throw error;
  return toApplication(data as ApplicationRow);
}

export async function verifyApplication(token: string): Promise<VerifiedApplication | null> {
  const { data, error } = await requireSupabase()
    .rpc('verify_leave_application', { application_token: token });
  if (error) throw error;
  return (data as VerifiedApplication[])[0] ?? null;
}
