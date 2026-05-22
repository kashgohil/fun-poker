import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { chipRepo, db, schema } from '@fun-poker/db';

// OAuth providers are only registered when their credentials are present, so
// the server runs with email/password alone until the keys are configured.
const socialProviders = {
  ...(process.env.GOOGLE_CLIENT_ID
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        },
      }
    : {}),
  ...(process.env.APPLE_CLIENT_ID
    ? {
        apple: {
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET ?? '',
        },
      }
    : {}),
};

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:8080',
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me',
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
  socialProviders,
  // The bearer plugin lets non-browser clients (the mobile app) authenticate
  // with an Authorization: Bearer <token> header instead of a cookie.
  plugins: [bearer()],
  databaseHooks: {
    user: {
      create: {
        // Grant every new play-money account its starting chip balance.
        after: async (createdUser) => {
          await chipRepo.ensureWallet(createdUser.id);
        },
      },
    },
  },
});

export type Auth = typeof auth;

// Resolves a WebSocket connection to a user id, or null if unauthenticated.
// Web clients carry the Better Auth session cookie automatically; the mobile
// app passes its session token as ?token= on the socket URL.
export async function userIdFromConnection(
  cookie: string | undefined,
  token: string | undefined,
): Promise<string | null> {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (token) headers.set('authorization', `Bearer ${token}`);
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}
