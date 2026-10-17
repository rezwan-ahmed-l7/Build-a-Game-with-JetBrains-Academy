# Leaderboard API (Render Web Service)

This service keeps the JSONBin Master Key on the server. Never add it to frontend JavaScript or a `VITE_*` variable.

## Render setup

Create a **New Web Service** from this repository:
- Root Directory: `leaderboard-api`
- Runtime: Node
- Build Command: leave blank (or `npm install`)
- Start Command: `npm start`

Set these environment variables in the Web Service dashboard:
- `JSONBIN_BIN_ID`: the existing leaderboard bin ID
- `JSONBIN_MASTER_KEY`: a newly generated JSONBin key (never commit it)
- `ALLOWED_ORIGIN`: the exact public origin of the Render Static Site, e.g. `https://your-game.onrender.com` (no trailing slash)

After deployment, verify `https://YOUR-API.onrender.com/health` returns `{"ok":true}`.

Then set the Static Site environment variable `VITE_LEADERBOARD_API_URL` to `https://YOUR-API.onrender.com` (no trailing slash) and trigger a fresh static-site deploy.

## Security notes

- The endpoint validates payload shape, caps entries, restricts browser origins, limits request rates, and never returns the JSONBin key.
- Browser origin checks are not authentication: non-browser clients can spoof requests. Scores are still client-submitted and can be forged. This is suitable for a casual game leaderboard, not a tamper-proof competitive leaderboard.
- JSONBin read-modify-write is not transactional, so simultaneous submissions can overwrite each other.
- Revoke the previously exposed JSONBin key. Do not send the replacement key in chat or commit it to GitHub.
