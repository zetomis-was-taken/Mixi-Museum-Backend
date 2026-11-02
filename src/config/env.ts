import dotenv from 'dotenv';
import { z } from 'zod';

const nodeEnv = process.env.NODE_ENV ?? 'development';

// Load the file that matches the current environment. Variables already set in
// the process (e.g. by the hosting platform) take precedence, because dotenv
// does not override existing values.
dotenv.config({ path: `.env.${nodeEnv}`, quiet: true });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().trim().default(''),
    S3_ENDPOINT: z.string().trim().default(''),
    S3_ACCESS_KEY_ID: z.string().trim().default(''),
    S3_SECRET_ACCESS_KEY: z.string().trim().default(''),
    S3_BUCKET: z.string().trim().default(''),
    S3_REGION: z.string().trim().default(''),
    // Comma-separated list of exact browser origins allowed to call the API.
    // Empty means "no cross-origin access"; `*` allows any origin.
    CORS_ORIGINS: z
      .string()
      .trim()
      .default(nodeEnv === 'development' ? 'http://localhost:5173' : ''),
  })
  .superRefine((value, ctx) => {
    if (value.DATABASE_URL && !/^postgres(ql)?:\/\//.test(value.DATABASE_URL)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'must be a valid postgres:// or postgresql:// connection string',
      });
    }

    if (value.NODE_ENV === 'production' && !value.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'is required in production',
      });
    }

    if (value.NODE_ENV === 'production') {
      const storageFields = [
        'S3_ENDPOINT',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
        'S3_BUCKET',
        'S3_REGION',
      ] as const;

      for (const field of storageFields) {
        if (!value[field]) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'is required in production',
          });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment variables:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;
