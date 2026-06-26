import type { FastifyInstance, FastifyReply } from 'fastify';

/**
 * OIDC transaction state (state + PKCE verifier + nonce) is stashed in a
 * short-lived, signed, httpOnly cookie between /login and /callback. This keeps
 * the API stateless (no server-side pending-login store) while still binding the
 * callback to the request that started it (CSRF/replay protection).
 */
const OIDC_TX_COOKIE = 'dml_oidc_tx';
const OIDC_TX_TTL_SECONDS = 600; // 10 minutes to complete consent

interface OidcTx {
  state: string;
  codeVerifier: string;
  nonce: string;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const { config, oidc, profiles, session } = app.ctx;

  const setTxCookie = (reply: FastifyReply, tx: OidcTx): void => {
    reply.setCookie(OIDC_TX_COOKIE, JSON.stringify(tx), {
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV !== 'development',
      signed: true,
      maxAge: OIDC_TX_TTL_SECONDS,
    });
  };

  const clearTxCookie = (reply: FastifyReply): void => {
    reply.clearCookie(OIDC_TX_COOKIE, { path: '/api/auth' });
  };

  // GET /api/auth/google/login — begin Authorization Code + PKCE; 302 to Google.
  app.get('/auth/google/login', async (_request, reply) => {
    const authRequest = await oidc.createAuthRequest();
    setTxCookie(reply, {
      state: authRequest.state,
      codeVerifier: authRequest.codeVerifier,
      nonce: authRequest.nonce,
    });
    return reply.redirect(authRequest.url, 302);
  });

  // GET /api/auth/google/callback — validate, upsert profile, create session.
  app.get('/auth/google/callback', async (request, reply) => {
    const appUrl = new URL(config.APP_BASE_URL);

    // Declined/failed consent: Google appends ?error=...; redirect back
    // unauthenticated with an error indicator (FR-006).
    const query = request.query as Record<string, string | undefined>;
    if (query.error) {
      clearTxCookie(reply);
      appUrl.pathname = '/signin';
      appUrl.searchParams.set('error', query.error);
      return reply.redirect(appUrl.href, 302);
    }

    // Recover the OIDC transaction from the signed cookie.
    const raw = request.cookies[OIDC_TX_COOKIE];
    const unsigned = raw ? request.unsignCookie(raw) : { valid: false, value: null };
    if (!unsigned.valid || unsigned.value === null) {
      clearTxCookie(reply);
      appUrl.pathname = '/signin';
      appUrl.searchParams.set('error', 'invalid_state');
      return reply.redirect(appUrl.href, 302);
    }

    let tx: OidcTx;
    try {
      tx = JSON.parse(unsigned.value) as OidcTx;
    } catch {
      clearTxCookie(reply);
      appUrl.pathname = '/signin';
      appUrl.searchParams.set('error', 'invalid_state');
      return reply.redirect(appUrl.href, 302);
    }

    try {
      // Reconstruct the full callback URL for openid-client validation.
      const callbackUrl = new URL(config.OAUTH_REDIRECT_URI);
      for (const [k, v] of Object.entries(query)) {
        if (typeof v === 'string') callbackUrl.searchParams.set(k, v);
      }

      const claims = await oidc.handleCallback(callbackUrl, {
        state: tx.state,
        codeVerifier: tx.codeVerifier,
        nonce: tx.nonce,
      });

      const profile = await profiles.upsertFromClaims(claims);
      const created = await session.create(profile.id);

      clearTxCookie(reply);
      session.setCookie(reply, created.id);
      return reply.redirect(appUrl.href, 302);
    } catch (err) {
      request.log.warn({ err }, 'OIDC callback failed');
      clearTxCookie(reply);
      appUrl.pathname = '/signin';
      appUrl.searchParams.set('error', 'sign_in_failed');
      return reply.redirect(appUrl.href, 302);
    }
  });

  // POST /api/auth/logout — delete the session row + clear cookie; 204.
  app.post('/auth/logout', async (request, reply) => {
    const current = await session.current(request);
    if (current) {
      await session.destroy(current.id);
    }
    session.clearCookie(reply);
    return reply.code(204).send();
  });
}
