import type { OidcAuthRequest, OidcClaims, OidcService } from '../../src/services/oidc.js';

/**
 * Stub OIDC service for tests — never contacts Google. `createAuthRequest`
 * returns deterministic values; `handleCallback` returns the preconfigured
 * claims (or throws to simulate declined/failed consent).
 */
export class StubOidcService implements OidcService {
  public lastAuthRequest: OidcAuthRequest = {
    url: 'https://accounts.google.com/o/oauth2/v2/auth?stub=1',
    state: 'test-state',
    codeVerifier: 'test-verifier',
    nonce: 'test-nonce',
  };

  constructor(
    private claims: OidcClaims = {
      sub: 'google-sub-123',
      email: 'reader@example.com',
      name: 'Test Reader',
      picture: 'https://example.com/avatar.png',
    },
    private shouldFail = false,
  ) {}

  setClaims(claims: OidcClaims): void {
    this.claims = claims;
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  async createAuthRequest(): Promise<OidcAuthRequest> {
    return this.lastAuthRequest;
  }

  async handleCallback(): Promise<OidcClaims> {
    if (this.shouldFail) throw new Error('stub: consent failed');
    return this.claims;
  }
}
