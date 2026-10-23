import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectUrl || !publishableKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Roll-number sign-in is not configured. Add the server-only Supabase service role key.' },
      { status: 503 },
    );
  }

  let input: { rollNumber?: unknown; password?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid sign-in request.' }, { status: 400 });
  }

  const rollNumber = typeof input.rollNumber === 'string' ? input.rollNumber.trim().toUpperCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (!rollNumber || !password || rollNumber.length > 64 || password.length > 256) {
    return NextResponse.json({ error: 'Enter a valid roll number and password.' }, { status: 400 });
  }

  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authClient = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: lookupError } = await adminClient
    .from('profiles')
    .select('email')
    .eq('roll_number', rollNumber)
    .eq('role', 'student')
    .maybeSingle();

  if (lookupError) {
    console.error('Roll-number sign-in lookup failed:', lookupError.message);
    return NextResponse.json({ error: 'Unable to sign in right now. Please try again.' }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: 'Invalid roll number or password.' }, { status: 401 });
  }

  const { data, error: signInError } = await authClient.auth.signInWithPassword({
    email: profile.email,
    password,
  });
  if (signInError || !data.session) {
    return NextResponse.json({ error: 'Invalid roll number or password.' }, { status: 401 });
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
