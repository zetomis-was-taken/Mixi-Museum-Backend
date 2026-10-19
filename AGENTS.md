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
│   │   └── env.ts       # Loads .env.<NODE_ENV> and validates variables with Zod
│   ├── controllers/     # Request handlers: read input, call services, send responses
│   ├── db/
│   │   ├── index.ts     # DrizzleORM client + pg Pool setup, closeDb() helper
│   │   └── schemas/
│   │       └── index.ts # Barrel re-exporting every table definition
│   ├── middleware/      # Express middleware (auth, error handling, etc.)
│   ├── routes/          # Express routers mapping endpoints to controllers
│   ├── services/        # Business logic, kept independent of Express
│   ├── utils/           # Shared helpers
│   ├── validators/      # Zod schemas for request/response validation
│   ├── app.ts           # Express app factory (createApp), middleware and routes
│   └── index.ts         # Application entry point: starts server, graceful shutdown
├── docker-compose.yml   # Local PostgreSQL service for development
├── drizzle.config.ts    # drizzle-kit config (schema path, migrations, credentials)
├── .env.development     # Local dev environment (tracked; matches docker-compose.yml)
├── .env.production      # Production environment (gitignored)
├── package.json
└── tsconfig.json
```

Each table (or group of related tables) lives in its own file under `src/db/schemas/`
and is re-exported from the barrel file so Drizzle sees the full schema.

`controllers/`, `middleware/`, `routes/`, `services/`, `utils/` and `validators/` are
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

## Commands
> Verify these against `package.json` before running — adjust as needed.

```bash
npm install          # install dependencies
docker compose up -d # start the local PostgreSQL server
npm run dev          # start the dev server (tsx watch)
npm run typecheck    # type-check without emitting
npm run build        # compile TypeScript to dist/
npm start            # run the compiled app with .env.production

npm run db:generate  # generate SQL migrations from the schema
npm run db:migrate   # apply migrations
npm run db:push      # push the schema directly to the database
npm run db:studio    # open Drizzle Studio
```

There is no test runner configured yet (`package.json` has no `test` script).