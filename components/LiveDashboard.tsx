'use client';

import { Activity, ArrowDownRight, ArrowRight, Check, CheckCircle2, Clock3, ClipboardList, FileText, LucideIcon, Plus, Users, X } from 'lucide-react';
import { Application, Status } from '../lib/data';
import { UserProfile } from '../lib/supabase';

type Role = 'student' | 'mentor' | 'hod';

type Props = {
  role: Role;
  apps: Application[];
  profile: UserProfile;
  hasAssignments: boolean | null;
  link: (href: string, label: React.ReactNode, className?: string) => React.ReactNode;
};

const labels: Record<Status, string> = {
  PENDING_MENTOR: 'Awaiting mentor',
  MENTOR_APPROVED: 'Mentor approved',
  MENTOR_REJECTED: 'Mentor declined',
  HOD_APPROVED: 'Approved',
  HOD_REJECTED: 'Declined',
};

function badgeClass(status: Status) {
  return status.includes('APPROVED') ? 'good' : status.includes('REJECTED') ? 'bad' : 'wait';
}

export default function LiveDashboard({ role, apps, profile, hasAssignments, link }: Props) {
  const records = role === 'student' ? apps.filter(app => app.userId === profile.id) : apps;
  const queue = records.filter(app => role === 'mentor'
    ? app.status === 'PENDING_MENTOR'
    : role === 'hod' && app.status === 'MENTOR_APPROVED');
  const visibleRecords = role === 'student' ? records : queue;
  const rejected = records.filter(app => app.status.endsWith('REJECTED')).length;
  const approved = records.filter(app => app.status === 'HOD_APPROVED').length;
  const pending = records.filter(app => app.status === 'PENDING_MENTOR' || app.status === 'MENTOR_APPROVED').length;
  const title = role === 'student'
    ? `Good morning, ${profile.full_name.split(/\s+/)[0]}`
    : role === 'mentor' ? 'Your review queue' : 'Department overview';
  const metrics: { label: string; value: number; icon: LucideIcon }[] = role === 'student'
    ? [
      { label: 'Total requests', value: records.length, icon: ClipboardList },
      { label: 'In review', value: pending, icon: Clock3 },
      { label: 'Approved', value: approved, icon: CheckCircle2 },
      { label: 'Declined', value: rejected, icon: X },
    ]
    : role === 'mentor'
      ? [
        { label: 'Awaiting your review', value: queue.length, icon: Clock3 },
        { label: 'Reviewed', value: records.filter(app => app.status !== 'PENDING_MENTOR').length, icon: CheckCircle2 },
        { label: 'Total assigned', value: records.length, icon: Users },
      ]
      : [
        { label: 'Awaiting HOD review', value: queue.length, icon: Clock3 },
        { label: 'Final approved', value: approved, icon: CheckCircle2 },
        { label: 'Total assigned', value: records.length, icon: Users },
      ];

  return <>
    <div className="greeting">
      <div>
        <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()} <span className="live-dot" /></p>
        <h1>{title}<span className="wave">✳</span></h1>
        <p className="muted">{role === 'student'
          ? 'Here’s where your leave requests stand today.'
          : role === 'mentor' ? 'Review requests assigned to your department and section.'
            : 'Review mentor-approved requests and record the final decision.'}</p>
      </div>
      {role === 'student' && link('/student/apply', <><Plus size={18} /> Apply for leave</>, 'button primary')}
    </div>

    {role !== 'student' && hasAssignments === false && <section className="panel reviewer-setup-note" role="status">
      <h2>Reviewer access needs setup</h2>
      <p>No reviewer assignment is linked to {profile.email}, so student requests cannot appear in this queue yet.</p>
      <p>Ask your Supabase administrator to set this account’s reviewer role and match its department/section in <code>reviewer_assignments</code>. The department must exactly match the student profile.</p>
    </section>}

    <div className="welcome-strip">
      <div className="welcome-icon"><Activity size={19} /></div>
      <div>
        <b>{role === 'student' ? 'Your college leave workspace' : role === 'mentor' ? 'Mentor review workspace' : 'HOD review workspace'}</b>
        <p>{role === 'student'
          ? 'Your submitted requests are shared with the reviewers assigned to your department.'
          : role === 'mentor' ? 'Approve requests to forward them to the HOD, or decline with a reason.'
            : 'Only mentor-approved requests are ready for your final review.'}</p>
      </div>
      <span className="live-pill">LIVE</span>
    </div>

    <div className="metric-grid">
      {metrics.map(({ label, value, icon: MetricIcon }, index) => <div className="metric" key={label}>
        <div className={`metric-icon m${index}`}><MetricIcon size={18} /></div>
        <div><small>{label}</small><b>{value}</b></div>
        <ArrowDownRight className="metric-arrow" size={16} />
      </div>)}
    </div>

    <div className="dashboard-grid">
      <section className="panel recent">
        <div className="panel-title">
          <div>
            <h2>{role === 'student' ? 'Recent applications' : 'Requests requiring attention'}</h2>
            <p>{role === 'student' ? 'Your latest leave requests' : `${queue.length} item${queue.length === 1 ? '' : 's'} awaiting your review`}</p>
          </div>
          {link(role === 'student' ? '/student/history' : `/${role}/applications`, <>View {role === 'student' ? 'all' : 'queue'} <ArrowRight size={15} /></>, 'text-link')}
        </div>
        {visibleRecords.length ? <div className="recent-list">{visibleRecords.slice(0, 5).map(app =>
          <a className="recent-row" href={`/${role}/applications/${app.id}`} key={app.id}>
            <span className="document-icon"><FileText size={17} /></span>
            <span className="row-main"><b>{app.reference}</b><small>{role === 'student'
              ? `${app.type} · ${app.from} — ${app.to}`
              : `${app.name} · ${app.roll} · ${app.type} · ${app.from}`}</small></span>
            <span className={`badge ${badgeClass(app.status)}`}><i />{labels[app.status]}</span>
            <ArrowRight className="row-arrow" size={16} />
          </a>)}</div> : <div className="empty compact-empty">
          <ClipboardList />
          <p>{role === 'student'
            ? 'No leave requests yet. Submit an application to get started.'
            : hasAssignments === false
              ? 'Your reviewer assignment is missing. Ask an administrator to set up your department and section.'
              : role === 'hod'
                ? 'No requests have been approved by a mentor yet. They will appear here when ready for your decision.'
                : 'No requests are waiting for your review.'}</p>
          {role === 'student' && link('/student/apply', 'Create an application', 'text-link')}
        </div>}
      </section>

      <aside className="panel side-panel">
        <div className="panel-title"><div><h2>Review workflow</h2><p>Each request follows these steps</p></div></div>
        <div className="flow">
          <div className="flow-item done"><span><Check size={14} /></span><div><b>Student submits</b><small>Saved in Supabase</small></div></div>
          <div className={`flow-item ${role === 'mentor' ? 'current' : ''}`}><span>2</span><div><b>Mentor review</b><small>Approve to send it to the HOD</small></div></div>
          <div className={`flow-item ${role === 'hod' ? 'current' : ''}`}><span>3</span><div><b>HOD decision</b><small>Final decision after mentor approval</small></div></div>
          <div className="flow-item"><span>4</span><div><b>Student update</b><small>See the latest decision in applications</small></div></div>
        </div>
      </aside>
    </div>
  </>;
}
