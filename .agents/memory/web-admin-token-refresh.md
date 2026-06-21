---
name: web-admin token auto-refresh
description: Why/how the web client auto-refreshes expired access tokens; the bug that happens if it doesn't
---

# Auto-refresh of expired access tokens (web-admin)

Access tokens (JWT) expire after 15 min and `requireAuth` verifies them statelessly
(returns 401 on expiry). If the client does not exchange the stored refresh token
for a new access token, then ~15 min after login EVERY request 401s and the UI shows
generic failures (e.g. "Erro ao criar operação") or silently breaks — even though
the user is "logged in".

**Where the auto-refresh lives:** the shared fetch client
`lib/api-client-react/src/custom-fetch.ts`. It exposes `setAuthRefreshHandler(handler)`.
On a 401 where an Authorization header was attached, a handler is registered, and the
URL is NOT an auth endpoint (login/refresh — guarded to avoid recursion), it calls the
handler to get a new access token and retries the request once. Concurrent 401s are
deduped via a single in-flight refresh promise.

The handler itself is registered in `artifacts/web-admin/src/contexts/AuthContext.tsx`
on mount: it POSTs the stored refresh token to `/api/auth/refresh`, persists the new
tokens, and returns the new access token; on failure it clears storage and logs out.

**Why:** the server rotates refresh tokens (revokes old, issues new on each refresh),
and login alone is not enough — the client must actively refresh.

**How to apply:** any new client (e.g. a second web app) that talks to this API with
bearer tokens must register both `setAuthTokenGetter` AND `setAuthRefreshHandler`, or
sessions will appear to "expire" after 15 minutes. Never let the refresh path itself
trigger the interceptor (keep the auth-endpoint guard).
