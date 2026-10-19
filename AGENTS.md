# Guidelines & Contexts for Coding Agents

This repository is the backend for a museum management application. It is built with **ExpressJS + TypeScript + DrizzleORM + PostgreSQL**.

## Tech Stack
- **Runtime / Framework:** Node.js, ExpressJS
- **Language:** TypeScript
- **ORM:** DrizzleORM
- **Database:** PostgreSQL

## Project Layout
```
src/
├── config/          # Config-related utilities and helpers used during development
├── db/
│   ├── index.ts     # DrizzleORM client setup
│   └── schemas/     # All database schemas, written in TypeScript using DrizzleORM's API
├── app.ts           # Express app setup
└── index.ts         # Application entry point
```

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
npm install        # install dependencies
npm run dev        # start the dev server
npm test           # run unit tests
npm run build      # compile TypeScript to JS
```