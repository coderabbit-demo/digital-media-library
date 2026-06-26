import type { PrismaClient, UserProfile } from '@prisma/client';
import type { ProfileDTO } from '@dml/shared';
import type { OidcClaims } from './oidc.js';

/** Fallback display name when Google provides none (edge case in spec). */
const DEFAULT_DISPLAY_NAME = 'Anonymous Reader';

/** Profile creation/refresh keyed by Google `sub` (FR-002/FR-003). */
export class ProfileService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Upsert by google_sub: create on first sign-in, otherwise refresh the
   * display name / avatar / email from the latest Google claims. The UNIQUE
   * constraint on google_sub guarantees no duplicate profiles (FR-003).
   */
  async upsertFromClaims(claims: OidcClaims): Promise<UserProfile> {
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
    });
  }

  async findById(id: string): Promise<UserProfile | null> {
    return this.prisma.userProfile.findUnique({ where: { id } });
  }
}

/** Map a stored profile to the public DTO (never exposes google_sub/email). */
export function toProfileDTO(profile: Pick<UserProfile, 'id' | 'displayName' | 'avatarUrl'>): ProfileDTO {
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? null,
  };
}
