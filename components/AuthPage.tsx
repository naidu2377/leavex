'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { isSupabaseConfigured, supabase, UserRole } from '../lib/supabase';

type Props = { pathname: string };

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Authentication failed. Please try again.';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('database error saving new user')
    || normalized.includes('could not find the table')
    || normalized.includes('schema cache')
    || normalized.includes('relation "public.profiles" does not exist')
  ) {
    return 'Supabase database setup is incomplete. In your Supabase Dashboard, open SQL Editor and run supabase/migrations/202610230001_initial_schema.sql, then try again.';
  }
  if (normalized.includes('profiles_roll_number_key') || normalized.includes('duplicate key') && normalized.includes('roll')) {
    return 'That roll number is already registered. Sign in with it, or use a different roll number.';
  }
  if (normalized.includes('user already registered') || normalized.includes('already been registered')) {
    return 'That email is already registered. Sign in instead, or use password recovery.';
  }

  return message;
}

export default function AuthPage({ pathname }: Props) {
  const router = useRouter();
  const isRegister = pathname.endsWith('/register');
  const role = (pathname.split('/')[1] || 'student') as UserRole;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [rollNumber, setRollNumber] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [verificationEmailInput, setVerificationEmailInput] = useState('');
  const [verificationRequestMode, setVerificationRequestMode] = useState(false);
  const [accountJustCreated, setAccountJustCreated] = useState(false);
  const [passwordResetStep, setPasswordResetStep] = useState<'request' | 'verify' | 'new-password' | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');

  async function sendVerificationCode(email: string) {
    if (!supabase) {
      setResendError('Supabase is not configured. Add the project URL and publishable key to .env.local, then restart the app.');
      return;
    }

    setBusy(true);
    setResendMessage('');
    setResendError('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      setConfirmationEmail(email);
      setConfirmationCode('');
      setVerificationRequestMode(false);
      setResendMessage('A new verification code was requested. Check your inbox and spam folder.');
    } catch (error) {
      setResendError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    await sendVerificationCode(confirmationEmail);
  }

  async function resendPasswordResetCode() {
    if (!supabase) {
      setResetError('Supabase is not configured. Add the project URL and publishable key to .env.local, then restart the app.');
      return;
    }

    setBusy(true);
    setResetError('');
    setResetMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
      if (error) throw error;
      setResetMessage('A new password reset code was requested. Check your inbox and spam folder.');
    } catch (error) {
      setResetError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

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

    if (verificationRequestMode) {
      await sendVerificationCode(verificationEmailInput.trim());
      return;
    }

    if (passwordResetStep) {
      setBusy(true);
      setResetError('');
      setResetMessage('');
      try {
        if (passwordResetStep === 'request') {
          const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
          if (error) throw error;
          setPasswordResetStep('verify');
          setResetMessage('A password reset code was sent. Check your inbox and spam folder.');
        } else if (passwordResetStep === 'verify') {
          const { error } = await supabase.auth.verifyOtp({
            email: resetEmail.trim(),
            token: resetCode.trim(),
            type: 'recovery',
          });
          if (error) throw error;
          setPasswordResetStep('new-password');
          setResetCode('');
          setResetMessage('');
        } else {
          if (newPassword !== confirmNewPassword) {
            setResetError('Passwords do not match.');
            return;
          }
          const { data, error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          if (!data.user) throw new Error('Password was updated but no user was returned.');
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();
          if (profileError) throw profileError;
          router.replace(`/${profile.role}/dashboard`);
          return;
        }
      } catch (error) {
        setResetError(authErrorMessage(error));
      } finally {
        setBusy(false);
      }
      return;
    }

    const values = new FormData(event.currentTarget);
    const identifier = String(values.get('identifier') ?? '').trim();
    const email = String(values.get('email') ?? '').trim();
    const password = String(values.get('password') ?? '');
    const code = String(values.get('confirmationCode') ?? '').trim();
    setBusy(true);

    try {
      if (confirmationEmail) {
        const { data, error } = await supabase.auth.verifyOtp({
          email: confirmationEmail,
          token: code,
          type: 'signup',
        });
        if (error) throw error;
        if (!data.user) throw new Error('Email verification succeeded but no user was returned.');
        router.replace('/student/dashboard');
        return;
      }

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
          setConfirmationEmail(email);
          setConfirmationCode('');
          setAccountJustCreated(true);
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
      setMessage(authErrorMessage(error));
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
          {confirmationEmail ? (
            <div className="auth-confirmation">
              <div className="success-note"><Check size={20} /><b>{accountJustCreated ? 'Account created successfully' : 'Verify your email'}</b></div>
              <p>Enter the verification code sent to <b>{confirmationEmail}</b> to complete registration.</p>
              {message && <p className="field-error" role="alert">{message}</p>}
              <label htmlFor="confirmation-code">Email verification code</label>
              <input
                id="confirmation-code"
                name="confirmationCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                required
                value={confirmationCode}
                onChange={event => setConfirmationCode(event.currentTarget.value.replace(/\D/g, ''))}
                placeholder="Enter the code from your email"
                aria-label="Email verification code"
              />
              {resendMessage && <p role="status">{resendMessage}</p>}
              {resendError && <p className="field-error" role="alert">{resendError}</p>}
              <button type="submit" className="button primary full" disabled={busy || confirmationCode.length === 0}>
                {busy ? 'Please wait…' : 'Verify email and complete registration'} <ArrowRight size={17} />
              </button>
              <button type="button" className="button secondary full" onClick={resendConfirmation} disabled={busy}>
                {busy ? 'Please wait…' : 'Resend verification code'}
              </button>
              <p className="fineprint">Check spam or junk mail if the code does not arrive. If the email only contains a link, ask the site administrator to set the Supabase Confirm signup template to use {'{{ .Token }}'}.</p>
            </div>
          ) : passwordResetStep ? (
            <div className="auth-confirmation">
              <div className="success-note"><ShieldCheck size={20} /><b>Reset your password</b></div>
              {passwordResetStep === 'request' ? (
                <>
                  <p>Enter the email address on your account. Supabase will send a password reset code.</p>
                  <label>Email address<input name="resetEmail" type="email" required autoComplete="email" value={resetEmail} onChange={event => setResetEmail(event.currentTarget.value)} placeholder="name@example.edu" /></label>
                  <button type="submit" className="button primary full" disabled={busy || !resetEmail.trim()}>
                    {busy ? 'Please wait…' : 'Send password reset code'} <ArrowRight size={17} />
                  </button>
                </>
              ) : passwordResetStep === 'verify' ? (
                <>
                  <p>Enter the password reset code sent to <b>{resetEmail}</b>.</p>
                  <label htmlFor="reset-code">Password reset code</label>
                  <input id="reset-code" name="resetCode" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required value={resetCode} onChange={event => setResetCode(event.currentTarget.value.replace(/\D/g, ''))} placeholder="Enter the code from your email" />
                  <button type="submit" className="button primary full" disabled={busy || !resetCode}>
                    {busy ? 'Please wait…' : 'Verify code'} <ArrowRight size={17} />
                  </button>
                  <button type="button" className="button secondary full" onClick={resendPasswordResetCode} disabled={busy}>
                    {busy ? 'Please wait…' : 'Resend password reset code'}
                  </button>
                </>
              ) : (
                <>
                  <p>Choose a new password for your account.</p>
                  <label>New password<input name="newPassword" type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.currentTarget.value)} placeholder="At least 8 characters" /></label>
                  <label>Confirm new password<input name="confirmNewPassword" type="password" required minLength={8} autoComplete="new-password" value={confirmNewPassword} onChange={event => setConfirmNewPassword(event.currentTarget.value)} placeholder="Re-enter your new password" /></label>
                  <button type="submit" className="button primary full" disabled={busy || !newPassword || !confirmNewPassword}>
                    {busy ? 'Please wait…' : 'Update password'} <ArrowRight size={17} />
                  </button>
                </>
              )}
              {resetMessage && <p role="status">{resetMessage}</p>}
              {resetError && <p className="field-error" role="alert">{resetError}</p>}
              <button type="button" className="button secondary full" onClick={() => { setPasswordResetStep(null); setResetError(''); setResetMessage(''); }}>
                Back to sign in
              </button>
              <p className="fineprint">If the email contains a link instead of a code, ask the site administrator to set the Supabase Reset Password template to use {'{{ .Token }}'}.</p>
            </div>
          ) : verificationRequestMode ? (
            <div className="auth-confirmation">
              <div className="success-note"><ShieldCheck size={20} /><b>Verify your registration email</b></div>
              <p>Enter the email address you registered with. We will send a new verification code if the account is awaiting confirmation.</p>
              {resendError && <p className="field-error" role="alert">{resendError}</p>}
              <label>Email address<input name="verificationEmail" type="email" required autoComplete="email" value={verificationEmailInput} onChange={event => setVerificationEmailInput(event.currentTarget.value)} placeholder="name@example.edu" /></label>
              <button type="submit" className="button primary full" disabled={busy || !verificationEmailInput.trim()}>
                {busy ? 'Please wait…' : 'Send verification code'} <ArrowRight size={17} />
              </button>
              <button type="button" className="button secondary full" onClick={() => { setVerificationRequestMode(false); setResendError(''); }}>
                Back to sign in
              </button>
            </div>
          ) : <>
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
          {!isRegister && role === 'student' && <button type="button" className="button secondary full" onClick={() => setVerificationRequestMode(true)}>Need to verify your email?</button>}
          {!isRegister && <button type="button" className="button secondary full" onClick={() => { setPasswordResetStep('request'); setResetError(''); setResetMessage(''); }}>Forgot password?</button>}
          <div className="role-switch">
            {(['student', 'mentor', 'hod'] as UserRole[]).map(item => <a key={item} href={`/${item}/login`} className={item === role ? 'selected' : ''}>{item[0].toUpperCase()}{item.slice(1)} portal</a>)}
          </div>
          </>}
        </form>
      </div>
    </main>
  );
}
