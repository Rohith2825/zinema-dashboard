# Zinema OS — dashboard

Song pipeline, approvals, release & content calendars for Zinema Music.
Next.js 16 (App Router) + Supabase (Postgres, Auth with Google only) + Google Drive for files.

- Design: [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md)
- Mix-audit targets: [`docs/MASTERING_SPEC.md`](docs/MASTERING_SPEC.md)
- Database: [`supabase/migrations/`](supabase/migrations)

## Run locally

```bash
cp .env.example .env.local   # fill in the Supabase URL + publishable key
npm install
npm run dev                  # http://localhost:3000
```

## One-time Supabase setup

1. **Database:** run `supabase/migrations/0001_core.sql`, then `0002_auth_and_rls.sql` (SQL editor, or `supabase db push`).
2. **Google sign-in** (the only sign-in method):
   - Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* (Web application).
     Authorised redirect URI: `https://<project>.supabase.co/auth/v1/callback`.
   - Supabase → Authentication → Sign In / Providers → **Google**: enable, paste client ID + secret.
   - Supabase → Authentication → Providers → **Email**: disable.
   - Supabase → Authentication → URL Configuration: Site URL = production URL; add
     `http://localhost:3000/auth/callback` and `https://<prod-domain>/auth/callback` to Redirect URLs.
3. **First admin** (after that account has signed in once):
   ```sql
   update profiles set is_org_admin = true where email = 'zinema4music@gmail.com';
   ```
4. **Rights owners** (can see royalty splits & contract terms; admins cannot). Each owner signs in once, then:
   ```sql
   insert into rights_owners(user_id) select id from profiles where email in ('owner@…');
   ```

## Access model (short)

- Everyone signs in with Google. A new account sees nothing until an admin adds them to a page with a role
  (`page_admin`, `approver`, `checker`, `maker`, `viewer`).
- Row-level security is on for every table; the same rules apply on the web and through the Claude MCP bridge.
- Song credits are visible to everyone on the page. Royalty splits and contract terms are visible to rights owners only.
