# Zinema OS — admin setup

Everything here is one-time. Variables go in Vercel → Project → Settings → Environment Variables (Production + Preview), then redeploy.

## 1. Core (done)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.

## 2. AI connections (Claude, ChatGPT)
Supabase → Authentication → OAuth Server: enabled, Authorization Path `/oauth/consent`, dynamic client registration on.
Server address people paste into their AI app: `https://dashboard.zinema.music/api/mcp`.
Optional personal tokens: `SUPABASE_JWT_SECRET` (Supabase → Project Settings → JWT Keys → legacy JWT secret).

## 3. Google Drive (as a Google account)
Files are owned by one Google account (e.g. zinema4music@gmail.com) and use its storage.

1. **Google Cloud Console** → pick the project → *APIs & Services → Library* → enable **Google Drive API**.
2. *Google Auth Platform → Data access* → add the scope `https://www.googleapis.com/auth/drive`.
   *Audience* → the app must be **In production** (in Testing, refresh tokens expire after 7 days).
3. *Clients → Create client* → **Web application** → Authorized redirect URI:
   `https://developers.google.com/oauthplayground` → copy **Client ID** and **Client secret**.
4. Open <https://developers.google.com/oauthplayground> → gear icon → tick **Use your own OAuth credentials** → paste both.
   In "Input your own scopes" enter `https://www.googleapis.com/auth/drive` → **Authorize APIs** → sign in **as the account that should own the files**
   → **Exchange authorization code for tokens** → copy the **Refresh token**.
5. In that account's Google Drive create a folder **Zinema OS**, share it with the team, open it and copy the id from the URL
   (`https://drive.google.com/drive/folders/<THIS_PART>`).
6. Vercel variables:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REFRESH_TOKEN`
   - `GOOGLE_DRIVE_ROOT_ID`
7. Redeploy → dashboard → **Connect AI** → the Google Drive card should say **Connected**.

(Alternative: a service account with `GOOGLE_SERVICE_ACCOUNT_KEY`, but only with a Workspace shared drive.)

## 4. Spotify catalog sync
`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_ARTIST_ID=5zUwzGZwhIgnPZPNZyHcaw`, `SPOTIFY_MARKET=IN`.
