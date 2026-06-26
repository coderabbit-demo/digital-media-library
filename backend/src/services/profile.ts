import type { PrismaClient, UserProfile } from '@prisma/client';
import type { ProfileDTO } from '@dml/shared';
import type { OidcClaims } from './oidc.js';

/** Fallback display name when Google provides none (edge case in spec). */
const DEFAULT_DISPLAY_NAME = 'Anonymous Reader';

/**
 * The only profile fields that may leave the data layer for application use.
 * Excludes `googleSub` and `email` (PII) — data minimization (GDPR / Principle IV):
 * queries fetch and return only these fields.
 */
export type PublicProfile = Pick<UserProfile, 'id' | 'displayName' | 'avatarUrl'>;

/** Profile creation/refresh keyed by Google `sub` (FR-002/FR-003). */
export class ProfileService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Upsert by google_sub: create on first sign-in, otherwise refresh the
   * display name / avatar / email from the latest Google claims. The UNIQUE
   * constraint on google_sub guarantees no duplicate profiles (FR-003).
   *
   * `email` is written (stored per FR-007) but NOT read back: sign-in only needs
   * the profile id to create a session, so we `select` just that.
   */
  async upsertFromClaims(claims: OidcClaims): Promise<{ id: string }> {
    const displayName = claims.name?.trim() || DEFAULT_DISPLAY_NAME;
    return this.prisma.userProfile.upsert({
      where: { googleSub: claims.sub },
      create: {
        googleSub: claims.sub,
        email: claims.email,
        displayName,
        avatarUrl: claims.picture,
      },
      update: {
        email: claims.email,
        displayName,
        avatarUrl: claims.picture,
      },
      select: { id: true },
    });
  }

  /**
   * Fetch a profile by id, returning only the public (non-PII) fields. Used by
   * the auth guard and `/api/me`; never pulls `email`/`googleSub`.
   */
  async findById(id: string): Promise<PublicProfile | null> {
    return this.prisma.userProfile.findUnique({
      where: { id },
      select: { id: true, displayName: true, avatarUrl: true },
    });
  }
}

/** Map a public profile to the API DTO (never exposes google_sub/email). */
export function toProfileDTO(profile: PublicProfile): ProfileDTO {
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? null,
  };
}
