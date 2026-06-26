import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../config/index.js';

export const SESSION_COOKIE_NAME = 'dml_session';

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
}

/**
 * Server-side session management referenced by a signed, httpOnly, Secure,
 * SameSite=Lax cookie (research §2). The cookie carries only the opaque
 * Session.id; all authoritative state lives in PostgreSQL so any Cloud Run
 * instance can validate it (Principle V).
 */
export class SessionManager {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
  ) {}

  /** Create a Session row for a user and return it. */
  async create(userId: string): Promise<SessionRecord> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.SESSION_TTL_SECONDS * 1000);
    const session = await this.prisma.session.create({
      data: { userId, expiresAt, lastSeenAt: now },
      select: { id: true, userId: true, expiresAt: true },
    });
    return session;
  }

  /** Set the signed session cookie on the reply. */
  setCookie(reply: FastifyReply, sessionId: string): void {
    reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
      path: '/',
      httpOnly: true,
      // SameSite=Lax: first-party cookie under a single origin; allows the
      // top-level redirect back from Google to carry the cookie.
      sameSite: 'lax',
      secure: this.config.NODE_ENV !== 'development',
      signed: true,
      maxAge: this.config.SESSION_TTL_SECONDS,
    });
  }

  /** Clear the session cookie (sign-out / revocation). */
  clearCookie(reply: FastifyReply): void {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }

  /**
   * Resolve the current valid (non-expired) session from the request cookie.
   * Returns null when the cookie is missing, fails signature verification, or
   * references an expired/absent session. Touches last_seen_at on a hit.
   */
  async current(request: FastifyRequest): Promise<SessionRecord | null> {
    const raw = request.cookies[SESSION_COOKIE_NAME];
    if (!raw) return null;

    const unsigned = request.unsignCookie(raw);
    if (!unsigned.valid || unsigned.value === null) return null;
    const sessionId = unsigned.value;

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, expiresAt: true },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;

    // Best-effort idle-timeout bookkeeping; never block the request on it.
    void this.prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);

    return session;
  }

  /** Delete a session row (sign-out). */
  async destroy(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }
}
