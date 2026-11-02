# CORS

CORS (Cross-Origin Resource Sharing) is the browser rule that decides whether
JavaScript from one origin may read a response from another. It is implemented
by `createCorsMiddleware` in `src/middleware/cors.ts`, registered in `createApp`
before the body parsers and routes, and configured entirely through
`CORS_ORIGINS`.

CORS is **not** authentication. It only controls what browser JavaScript may
read; `curl`, Postman and other servers ignore it. Access control comes from the
Supabase Bearer token you verify in the API.

## Origins

An origin is scheme + host + port. Paths and query strings are irrelevant.

| URL | Same origin as `http://localhost:3000`? |
| --- | --- |
| `http://localhost:3000/health` | yes |
| `http://localhost:3000/anything?x=1` | yes |
| `http://localhost:5173` | no — different port |
| `https://localhost:3000` | no — different scheme |
| `http://127.0.0.1:3000` | no — different host |

`localhost` and `127.0.0.1` are distinct origins.

## Request lifecycle

When the frontend sends `Authorization` or `Content-Type: application/json`, the
request is not "simple", so the browser first sends a preflight:

```
OPTIONS /health
Origin: http://localhost:5173
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization,content-type
```

The middleware answers `204` with:

```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Headers: Authorization, Content-Type, apikey
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
```

If the origin is allowed, the browser then sends the real request, and that
response must carry `Access-Control-Allow-Origin` again or the browser hides the
body from JavaScript. `fetch` issues the preflight automatically — you never
call `OPTIONS` yourself. It is visible in DevTools → Network.

Origins outside the allow-list are still served, but without CORS headers, so
browsers block the response while server-to-server callers (which send no
`Origin` header) keep working.

## Configuration

`CORS_ORIGINS` is a comma-separated list of exact origins. A trailing slash is
stripped for you; everything else must match the browser's `Origin` header
exactly.

| Value | Effect |
| --- | --- |
| `https://museum.example.com` | that origin only |
| `https://museum.example.com,https://www.museum.example.com` | both origins |
| `*` | any origin |
| empty | no cross-origin browser access (default outside development) |

**Development** — `.env.development` already contains:

```env
CORS_ORIGINS=http://localhost:5173
```

Use the origin your dev server actually shows. Vite defaults to `5173`; a
Next.js dev server usually takes `3000`, which collides with the API port, so
move one of them. If you browse via `127.0.0.1`, list that origin too.

**Production** — set the real frontend origin in the host's environment
variables (or use the optional local `.env.production` start command), then
restart/redeploy:

```env
CORS_ORIGINS=https://museum.example.com
```

Cookies are not enabled (`credentials` is off), which is correct for Supabase
access tokens sent as a Bearer header. A cookie-based session would need
`credentials: true` and exact origins — never `*`.

## Frontend usage

Attach the Supabase access token to every API call:

```ts
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch(`${API_URL}/artworks`, {
  headers: {
    'Content-Type': 'application/json',
    ...(session && { Authorization: `Bearer ${session.access_token}` }),
  },
});
```

`API_URL` is `http://localhost:3000` in development and the deployed API host in
production. Login and signup go directly to Supabase and are unaffected by this
configuration.

## Production startup

The default `npm start` command runs `node dist/index.js` and reads configuration
from the host process environment. This is the recommended deployment mode for
containers and hosted services, where secrets and environment variables are
provided by the platform.

For local production-mode testing with the tracked environment-file convention,
run `npm run start:env-file` after building. That command explicitly loads
`.env.production` with Node's `--env-file` option.

## Verifying manually

CORS headers are visible to any client, so `curl` can check a deployment:

```bash
curl -i -X OPTIONS http://localhost:3000/health \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

Expect `204` with `Access-Control-Allow-Origin: http://localhost:5173`. A
missing header means the `Origin` value does not match any entry in
`CORS_ORIGINS`.

## Debugging the usual failures

| Symptom in DevTools | Cause |
| --- | --- |
| "No `Access-Control-Allow-Origin` header" | Origin missing from `CORS_ORIGINS`, or a typo, trailing slash, `http` vs `https`, or `127.0.0.1` vs `localhost` |
| "Request header field authorization is not allowed" | `Authorization` missing from `allowedHeaders` in `src/middleware/cors.ts` |
| Preflight returns `404` | CORS middleware registered after the routes, or a route-level `OPTIONS` handler shadowing it |
| Works in Postman/curl, fails in the browser | Expected — those clients do not enforce CORS; the server side is fine |
| `500` instead of CORS headers | An error thrown before or inside the middleware; check the server logs |
| Production only: preflight fails after deploy | `CORS_ORIGINS` not set in the host's environment, or changed without a restart |
| Browser console shows credentials error | Something sends `credentials: 'include'` while the server has credentials disabled; remove it |

Rule of thumb: if a browser call fails but `curl` with the same origin works,
compare the browser's `Origin` header with `CORS_ORIGINS` character by
character.
