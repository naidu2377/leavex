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
4. Register a student account. Supabase creates a student profile from the registration fields. Roll numbers are stored in uppercase. Sign in with the roll number and password, or with the registered college email and password.
5. To authorize reviewers, first have them register. An administrator then assigns each reviewer's profile role and creates their assignment using the Supabase SQL Editor:

```sql
update public.profiles
set role = 'mentor'
where email = 'mentor@example.edu';

insert into public.reviewer_assignments (user_id, reviewer_role, department, section)
select id, 'mentor', 'Computer Science', 'A'
from public.profiles
where email = 'mentor@example.edu';
```

For an HOD, use `role = 'hod'`, `reviewer_role = 'hod'`, and set `section` to `null` for department-wide assignment. Only use the Supabase SQL Editor/admin access for role provisioning; never allow users to change their own roles. Never expose a service-role key to browser code.

## GitHub

Review the changes and push them to the intended branch when ready. `.env.local` and credentials must not be committed.
