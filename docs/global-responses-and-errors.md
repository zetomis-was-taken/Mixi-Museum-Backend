# Global Responses & Errors

Every endpoint replies with one of two standard envelopes. The helpers live in
`src/utils/response.ts`, `src/utils/errors.ts`, `src/middleware/error-handler.ts` and
`src/middleware/validate.ts`. Controllers must not call `res.json()` directly.

## Success — `sendSuccess(res, data, status?, message?)`

Any 2xx response is wrapped as:

```json
{ "success": true, "message": "OK", "data": { "id": 1 } }
```

```ts
import { HttpStatus, sendSuccess } from '../utils/response.js';

sendSuccess(res, { id: 1 }); // 200 { success: true, message: 'OK', data: { id: 1 } }
sendSuccess(res, item, HttpStatus.CREATED); // 201, message 'Created'
sendSuccess(res, null, HttpStatus.NO_CONTENT); // 204, empty body
```

- `status` comes from `HttpStatus` (`OK`, `CREATED`, `ACCEPTED`, `NO_CONTENT`, ...).
- `message` defaults to the standard text for the status: 200 → `OK`, 201 → `Created`, etc.
- `204 No Content` is sent without a body.
- Pass an explicit `message` only when the default wording does not fit.

## Errors — `sendError(res, status, { code?, message?, details? })`

Any 4xx/5xx response is wrapped as:

```json
{ "success": false, "message": "Item not found", "error": { "code": "NOT_FOUND" } }
```

```ts
import { HttpStatus, sendError } from '../utils/response.js';

sendError(res, HttpStatus.NOT_FOUND, { code: 'NOT_FOUND', message: 'Item not found' });
```

Prefer throwing and letting the global handler reply — see below.

## Throwing instead of formatting

Controllers and services throw, and `errorHandler` (`src/middleware/error-handler.ts`)
maps the error to the envelope above:

| Thrown value | Response |
| --- | --- |
| `AppError.notFound('Item not found')` — also `badRequest`, `unauthorized`, `forbidden`, `conflict`, or `new AppError(msg, { status, code, details })` | that status, `code` defaulting from it (e.g. `NOT_FOUND`) |
| `ZodError` (from `validate` or a manual `.parse()`) | `400 VALIDATION_ERROR`, `details: [{ path, message, code }]` |
| `SyntaxError` on the request body | `400 INVALID_JSON` |
| anything else | `500 INTERNAL_SERVER_ERROR` — logged with `console.error`, details never sent |

```ts
import { AppError } from '../utils/errors.js';

const item = await itemService.findById(id);

if (!item) {
  throw AppError.notFound('Item not found');
}
```

`errorHandler` and `notFoundHandler` (`404 ROUTE_NOT_FOUND`) are registered last in
`createApp()`; mount new routers before them.

## Request validation — `validate` + `getValidated`

`validate` parses the selected request parts with Zod, stores the result on
`res.locals.validated`, and forwards a `ZodError` to the global handler when parsing fails.

```ts
import { z } from 'zod';
import { validate } from '../middleware/validate.js';

export const createItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int(),
});
```

```ts
import { getValidated } from '../middleware/validate.js';

router.post('/items', validate({ body: createItemSchema }), createItem);

// in the controller:
const input = getValidated<CreateItemInput>(res, 'body');
```

`validate` accepts `body`, `query` and `params` together, and `getValidated` takes the
same source name (`'body'` by default).
