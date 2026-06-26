import { z } from 'zod';

/**
 * Environment configuration, validated once at startup.
 *
 * Variable names mirror .env.example. Secrets (GOOGLE_CLIENT_SECRET,
 * SESSION_SIGNING_KEY, DATABASE_URL) come from Secret Manager / injected env in
 * cloud per Principle IV — never from source control.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  // Base URL of the SPA; OIDC callback redirects the browser back here.
  APP_BASE_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // Google OIDC client credentials.
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  OAUTH_REDIRECT_URI: z.string().url(),

  // Session cookie signing key (32+ bytes recommended).
  SESSION_SIGNING_KEY: z.string().min(16),

  // Per-user post rate limit. Defaults to the shared constant (10/min).
  RATE_LIMIT_POSTS_PER_MINUTE: z.coerce.number().int().positive().default(10),

  // Session lifetime in seconds (default 7 days).
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),

  // First-page feed cache TTL in seconds (short; SC-005).
  FEED_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(15),
});

export type AppConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate the process environment. Throws a readable error listing
 * every invalid/missing variable so misconfiguration fails fast at boot.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/** Whether the session cookie should be marked Secure (always except plain dev/test). */
export function isProduction(config: AppConfig): boolean {
  return config.NODE_ENV === 'production';
}
