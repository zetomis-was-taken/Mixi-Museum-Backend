# Guidelines & Contexts for Coding Agents

This repository is the backend for a museum management application. It is built with **ExpressJS + TypeScript + DrizzleORM + PostgreSQL**.

## Tech Stack
- **Runtime / Framework:** Node.js, ExpressJS
- **Language:** TypeScript
- **ORM:** DrizzleORM
- **Database:** PostgreSQL

## Project Layout
```
.
├── src/
│   ├── config/
│   │   └── env.ts       # Loads required root .env and validates variables with Zod
│   ├── controllers/     # Request handlers: read input, call services, send responses
│   ├── db/
│   │   ├── index.ts     # DrizzleORM client + pg Pool setup, closeDb() helper
│   │   └── schemas/
│   │       └── index.ts # Barrel re-exporting every table definition
│   ├── middleware/      # error-handler.ts (global errors + 404), validate.ts (Zod), cors.ts (CORS)
│   ├── routes/          # Express routers mapping endpoints to controllers
│   ├── services/        # Business logic, kept independent of Express
│   ├── utils/           # response.ts (sendSuccess/sendError), errors.ts (AppError)
│   ├── validators/      # Zod schemas for request/response validation
│   ├── app.ts           # Express app factory (createApp), middleware and routes
│   └── index.ts         # Application entry point: starts server, graceful shutdown
├── tests/
│   └── migrations/      # Migration tests, run against the dedicated test database
├── docs/                # Contributor docs (CORS, global responses & errors)
├── drizzle/             # Generated SQL migrations + drizzle-kit metadata
├── drizzle.config.ts    # drizzle-kit config (schema path, migrations, credentials)
├── vitest.config.ts     # Vitest config for unit tests (src/**/*.test.ts)
├── vitest.migration.config.ts # Vitest config for migration tests (tests/migrations)
├── .env                 # Required local/production environment configuration (gitignored)
├── package.json
└── tsconfig.json
```

Each table (or group of related tables) lives in its own file under `src/db/schemas/`
and is re-exported from the barrel file so Drizzle sees the full schema.

`controllers/`, `routes/`, `services/` and `validators/` are
currently empty scaffolds; add files there following the conventions above.

## Code Style & Conventions
- Use **named exports** instead of default exports.
- Match the coding style of the surrounding code.
- Prefer small, focused, and readable functions.

## Critical Rules

### DO NOT
- Do **not** modify files inside `.github/workflows/` unless explicitly requested.
- Do **not** hardcode secrets or environment variables — read them from the environment/config layer.
- Do **not** delete existing unit tests.

### DO
- Keep changes **minimal and focused** on the requested task — avoid unrelated refactors.
- Follow the existing conventions of the codebase you are editing.
- Before creating a new function or method, **search the codebase** to check whether an equivalent implementation already exists.

## Testing Guidelines
- Unit test files must live **next to** the file they test.  
  Example: `user.service.ts` → `user.service.test.ts`
- When adding a new service or helper function, **write the corresponding unit test first** (test-first / TDD approach).

## Global Responses & Errors

Every endpoint replies with one of two standard envelopes, and controllers must not
call `res.json()` directly. The full contract — success/error shapes, per-status
messages, `AppError`/`ZodError` handling and the `validate` middleware — is documented
in [docs/global-responses-and-errors.md](docs/global-responses-and-errors.md).

## CORS

`createCorsMiddleware` in `src/middleware/cors.ts` is registered in `createApp`
before the routes. It only reads `CORS_ORIGINS`: comma-separated exact browser
origins (empty means no cross-origin access, `*` allows any). Development
defaults to `http://localhost:5173`. Unknown origins get no CORS headers, and
Supabase Bearer-token auth needs no cookie credentials. The full guide,
including frontend usage and debugging, is in [docs/cors.md](docs/cors.md).

## Commands
> Verify these against `package.json` before running — adjust as needed.

```bash
npm install          # install dependencies
# Configure PostgreSQL externally; see DATABASE_URL in the root .env
npm run dev          # start the dev server (tsx watch)
npm run typecheck    # type-check without emitting
npm test             # run unit tests (vitest)
npm run test:migration # run migration tests (needs the test database)
npm run build        # compile TypeScript to dist/
npm start            # run the compiled app with the root .env

npm run db:generate  # generate SQL migrations from the schema
npm run db:migrate   # apply migrations
npm run db:studio    # open Drizzle Studio
```

Unit tests (`*.test.ts`) live next to the code they test and run without a database.
Migration tests live in `tests/migrations/` and use the PostgreSQL database configured
by `DATABASE_URL` in the root `.env`. The database must be provisioned externally.