'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { supabase, UserProfile } from '../lib/supabase';

export default function AccountProfile({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const [error, setError] = useState('');

  async function signOut() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    router.replace('/student/login');
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">ACCOUNT</p><h1>Your profile</h1><p className="muted">Your account information.</p></div>
      </div>
      <section className="panel profile-panel">
        <div className="profile-hero">
          <div className="avatar profile-avatar">{profile.full_name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div>
          <div><h2>{profile.full_name}</h2><p className="muted">{profile.role[0].toUpperCase()}{profile.role.slice(1)}</p></div>
        </div>
        <div className="profile-fields">
          <div><small>Full name</small><b>{profile.full_name}</b></div>
          <div><small>{profile.role === 'student' ? 'Roll number' : 'Role'}</small><b>{profile.roll_number || profile.role}</b></div>
          <div><small>Email</small><b>{profile.email}</b></div>
          <div><small>Department</small><b>{profile.department || 'Not set'}</b></div>
          <div><small>Year / section</small><b>{[profile.year, profile.section ? `Section ${profile.section}` : null].filter(Boolean).join(' · ') || '—'}</b></div>
        </div>
        <div className="info-note"><ShieldCheck size={18} /><p>Account data and reviewer permissions are managed by Supabase.</p></div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="button" className="button secondary" onClick={signOut}>Sign out</button>
      </section>
    </>
  );
}
