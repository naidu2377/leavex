'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { isSupabaseConfigured, supabase, UserRole } from '../lib/supabase';

type Props = { pathname: string };

export default function AuthPage({ pathname }: Props) {
  const router = useRouter();
  const isRegister = pathname.endsWith('/register');
  const role = (pathname.split('/')[1] || 'student') as UserRole;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [rollNumber, setRollNumber] = useState('');

  function updateRollNumber(event: ChangeEvent<HTMLInputElement>) {
    const value = event.currentTarget.value.toUpperCase();
    event.currentTarget.value = value;
    setRollNumber(value);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!isSupabaseConfigured || !supabase) {
      setMessage('Supabase is not configured. Add the project URL and publishable key to .env.local, then restart the app.');
      return;
    }

    const values = new FormData(event.currentTarget);
    const identifier = String(values.get('identifier') ?? '').trim();
    const email = String(values.get('email') ?? '').trim();
    const password = String(values.get('password') ?? '');
    setBusy(true);

    try {
      if (isRegister) {
        if (password !== String(values.get('confirmPassword') ?? '')) {
          setMessage('Passwords do not match.');
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: String(values.get('full_name') ?? '').trim(),
              roll_number: String(values.get('roll_number') ?? '').trim().toUpperCase(),
              department: String(values.get('department') ?? '').trim(),
              year: String(values.get('year') ?? ''),
              section: String(values.get('section') ?? '').trim(),
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage('Account created. Check your email to confirm it, then sign in.');
          return;
        }
        router.replace('/student/dashboard');
        return;
      }

      const looksLikeEmail = identifier.includes('@');
      if (!looksLikeEmail && role !== 'student') {
        setMessage('Mentor and HOD accounts must sign in with their college email.');
        return;
      }
      let userId: string;
      if (looksLikeEmail) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
        if (error) throw error;
        if (!data.user) throw new Error('Sign in succeeded but no user profile was returned.');
        userId = data.user.id;
      } else {
        const response = await fetch('/api/auth/roll-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rollNumber: identifier.toUpperCase(), password }),
        });
        const result = await response.json() as { access_token?: string; refresh_token?: string; error?: string };
        if (!response.ok || !result.access_token || !result.refresh_token) {
          throw new Error(result.error || 'Sign in failed. Check your roll number and password.');
        }
        const { data, error } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        if (error) throw error;
        if (!data.user) throw new Error('Sign in succeeded but no user profile was returned.');
        userId = data.user.id;
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (profileError) throw profileError;
      router.replace(`/${profile.role}/dashboard`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="public">
      <header className="public-nav">
        <a href="/" className="brand"><span className="brand-mark">LX</span><span>LEAVE <b>X</b></span></a>
        <span className="public-context">A student leave workspace <i /> Supabase connected</span>
        <div className="public-links"><a href="/#workflow">How it works</a><a href="/#portals">Portals</a></div>
        <a href="/" className="button secondary compact">Home</a>
      </header>
      <div className="auth-wrap">
        <div className="auth-side">
          <p className="eyebrow">LEAVE X · {role.toUpperCase()} PORTAL</p>
          <h1>{isRegister ? 'Create a student profile' : `Welcome back${role === 'student' ? ', student' : ''}.`}</h1>
          <p>Sign in securely to follow a leave request through review.</p>
          <div className="auth-proof">
            <span><Check size={15} /> Supabase Auth</span>
            <span><Check size={15} /> Persistent leave records</span>
            <span><Check size={15} /> Reviewer access controls</span>
          </div>
        </div>
        <form className="panel auth-form" onSubmit={submit}>
          <div className="auth-brand">
            <span className="brand-mark">LX</span>
            <div><h2>{isRegister ? 'Student registration' : `${role[0].toUpperCase()}${role.slice(1)} sign in`}</h2><p>Secure account access</p></div>
          </div>
          {message && <p className="field-error" role="alert">{message}</p>}
          {isRegister && <label>Full name<input name="full_name" required autoComplete="name" placeholder="e.g. Aarav Reddy" /></label>}
          {isRegister
            ? <label>College email<input name="email" type="email" required autoComplete="email" placeholder="name@example.edu" /></label>
            : <label>{role === 'student' ? 'Roll number or college email' : 'College email'}<input name="identifier" required autoComplete="username" placeholder={role === 'student' ? 'e.g. 22B01A05A1 or name@example.edu' : 'name@example.edu'} /></label>}
          {isRegister && <>
            <label>Roll number<input name="roll_number" required value={rollNumber} onChange={updateRollNumber} autoCapitalize="characters" placeholder="E.G. 22B01A05A1" /></label>
            <div className="field-grid">
              <label>Department<select name="department" required defaultValue=""><option value="" disabled>Select department</option><option value="Computer Science (CSE)">Computer Science (CSE)</option><option value="Information Technology (IT)">Information Technology (IT)</option><option value="Artificial Intelligence and Data Science (AI&DS)">Artificial Intelligence and Data Science (AI&amp;DS)</option><option value="Electronics and Communication Engineering (ECE)">Electronics and Communication Engineering (ECE)</option><option value="Electrical and Electronics Engineering (EEE)">Electrical and Electronics Engineering (EEE)</option><option value="Mechanical Engineering (MECH)">Mechanical Engineering (MECH)</option><option value="Civil Engineering (CIVIL)">Civil Engineering (CIVIL)</option></select></label>
              <label>Year<select name="year" required defaultValue="III Year"><option>I Year</option><option>II Year</option><option>III Year</option><option>IV Year</option></select></label>
            </div>
            <label>Section<input name="section" required placeholder="e.g. A" /></label>
          </>}
          <label>Password<input name="password" type="password" required minLength={8} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'} /></label>
          {isRegister && <label>Confirm password<input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" placeholder="Re-enter your password" /></label>}
          <button className="button primary full" disabled={busy || !isSupabaseConfigured}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={17} />
          </button>
          {!isSupabaseConfigured && <p className="field-error" role="alert">Supabase credentials are missing. Configure .env.local and restart the app.</p>}
          <div className="auth-notice"><ShieldCheck size={16} /><p>Your password is handled by Supabase Auth and is never stored by this app.</p></div>
          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : role === 'student' ? 'New student?' : 'Need an account?'}{' '}
            <a href={isRegister ? '/student/login' : role === 'student' ? '/student/register' : '/student/login'}>{isRegister ? 'Sign in' : role === 'student' ? 'Register' : 'Student portal'}</a>
          </p>
          <div className="role-switch">
            {(['student', 'mentor', 'hod'] as UserRole[]).map(item => <a key={item} href={`/${item}/login`} className={item === role ? 'selected' : ''}>{item[0].toUpperCase()}{item.slice(1)} portal</a>)}
          </div>
        </form>
      </div>
    </main>
  );
}
