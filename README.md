# LEAVE X

LEAVE X is a college leave request workflow for students, mentors and HODs, built with Next.js and Supabase. It is not an official college service.

## Run locally

Requirements: Node.js 18.17 or later and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Production build: `npm run build`; run it with `npm start`. `npm run typecheck` runs TypeScript. `npm run lint` runs Next.js ESLint checks using the included `.eslintrc.json`.

## Workflows

- **Student:** Register with a college email and student profile, confirm the email if required by Supabase Auth, then sign in. Submit and track leave applications.
- **Mentor:** Assigned mentors can review requests for their configured department/section and approve or decline with a comment.
- **HOD:** Assigned HODs can make a final decision after mentor approval.
- **Verification:** The public verification endpoint reveals limited details only for finally approved requests.

Authentication is handled by Supabase Auth. Application data is persisted in Supabase Postgres and protected with row-level security. Reviewer role assignments must be provisioned by an administrator; users cannot self-assign reviewer privileges.

## Stack and structure

- Next.js 14 App Router, React 18, TypeScript
- Tailwind CSS project configuration and custom CSS design system
- Lucide React icon set
- `app/` route entry points and global styles
- `components/Workspace.tsx` responsive role portals and interactive views
- `lib/applications.ts` typed Supabase application data access
- `supabase/migrations/` database schema, policies, auth trigger and verification function
- `types/index.ts` shared application models

## Supabase setup

1. Copy `.env.example` to `.env.local`, then set the project's URL and publishable key. Add the Supabase service role key as `SUPABASE_SERVICE_ROLE_KEY` for student roll-number sign-in. This key is server-only, must never use a `NEXT_PUBLIC_` prefix, and must never be committed. `.env.local` is ignored by Git.
2. In the Supabase Dashboard, open **SQL Editor**, paste and run [`supabase/migrations/202610230001_initial_schema.sql`](./supabase/migrations/202610230001_initial_schema.sql). It creates the profile, reviewer-assignment and application tables, signup trigger, row-level security policies and public verification RPC.
3. Restart the local app with `npm run dev`.
4. Register a student account. Supabase creates a student profile from the registration fields. If email confirmation is enabled, enter the emailed verification code to complete registration. Roll numbers are stored in uppercase. Sign in with the roll number and password, or with the registered college email and password.
5. To authorize reviewers, first have them register. An administrator then assigns each reviewer's profile role and creates their assignment using the Supabase SQL Editor:

```sql
update public.profiles
set role = 'mentor'
where email = 'mentor@example.edu';

insert into public.reviewer_assignments (user_id, reviewer_role, department, section)
select id, 'mentor', 'Computer Science (CSE)', 'A'
from public.profiles
where email = 'mentor@example.edu';
```

For an HOD, use the same department label and create a department-wide assignment:

```sql
update public.profiles
set role = 'hod'
where email = 'hod@example.edu';

insert into public.reviewer_assignments (user_id, reviewer_role, department, section)
select id, 'hod', 'Computer Science (CSE)', null
from public.profiles
where email = 'hod@example.edu';
```

The department value must exactly match the registration dropdown label (for example, `Computer Science (CSE)`, not `Computer Science`). Assign a mentor to the correct section; use `null` for an HOD to cover the whole department. Run reviewer role and assignment SQL from the Supabase SQL Editor/admin access only; users must not be able to change their own role. Never expose a service-role key to browser code.

### Registration troubleshooting

If registration reports `Database error saving new user` or the app cannot find the `profiles` table, the schema migration has not been installed (or failed). Run the migration from step 2 in the Supabase SQL Editor and retry. The migration also creates profiles for existing email-based Auth accounts using their signup metadata.

To use a numeric email verification code, open **Supabase Dashboard → Authentication → Email Templates → Confirm signup** and update the message to include `{{ .Token }}` (for example, `Your verification code is {{ .Token }}`). Save the template. The app accepts this code on the registration confirmation screen and verifies it with Supabase Auth. If email confirmation is disabled in Supabase, registrations complete without a code. For missing email, check spam or junk mail and use **Resend verification code**; students who left the confirmation screen can choose **Need to verify your email?** on student sign-in to request a new code. If delivery still fails, ask the administrator to review Supabase email delivery settings.

Password recovery is available from the sign-in screen using **Forgot password?**. To receive a numeric recovery code, also open **Supabase Dashboard → Authentication → Email Templates → Reset Password** and include `{{ .Token }}` in that email template. The user enters the code, then chooses a new password; the app verifies the recovery code and updates the password through Supabase Auth.

## GitHub

Review the changes and push them to the intended branch when ready. `.env.local` and credentials must not be committed.
