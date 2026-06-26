import * as client from 'openid-client';
import type { AppConfig } from '../config/index.js';

/** Claims we consume from Google's ID token / userinfo. */
export interface OidcClaims {
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/** Data the caller must persist between /login and /callback (in the session/state store). */
export interface OidcAuthRequest {
  url: string;
  state: string;
  /** PKCE code_verifier; must be replayed at the callback to exchange the code. */
  codeVerifier: string;
  nonce: string;
}

/**
 * Google OIDC boundary (Authorization Code + PKCE). Defined as an interface so
 * tests can inject a stub instead of hitting Google's discovery/token
 * endpoints.
 */
export interface OidcService {
  /** Build the authorization URL plus the state/PKCE/nonce to stash. */
  createAuthRequest(): Promise<OidcAuthRequest>;
  /**
   * Exchange the callback for verified claims. `currentUrl` is the full callback
   * URL (with code & state); the stashed values guard against CSRF/replay.
   */
  handleCallback(
    currentUrl: URL,
    expected: { state: string; codeVerifier: string; nonce: string },
  ): Promise<OidcClaims>;
}

/** Production implementation backed by openid-client v6 against Google. */
export class GoogleOidcService implements OidcService {
  private configPromise: Promise<client.Configuration> | undefined;

  constructor(private readonly appConfig: AppConfig) {}

  /** Lazily discover Google's OIDC metadata and cache the configuration. */
  private getConfig(): Promise<client.Configuration> {
    if (!this.configPromise) {
      this.configPromise = client.discovery(
        new URL('https://accounts.google.com/.well-known/openid-configuration'),
        this.appConfig.GOOGLE_CLIENT_ID,
        this.appConfig.GOOGLE_CLIENT_SECRET,
      );
    }
    return this.configPromise;
  }

  async createAuthRequest(): Promise<OidcAuthRequest> {
    const config = await this.getConfig();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: this.appConfig.OAUTH_REDIRECT_URI,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    return { url: url.href, state, codeVerifier, nonce };
  }

  async handleCallback(
    currentUrl: URL,
    expected: { state: string; codeVerifier: string; nonce: string },
  ): Promise<OidcClaims> {
    const config = await this.getConfig();
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: expected.codeVerifier,
      expectedState: expected.state,
      expectedNonce: expected.nonce,
      idTokenExpected: true,
    });

    const claims = tokens.claims();
    if (!claims?.sub) {
      throw new Error('OIDC callback returned no subject claim');
    }

    return {
      sub: String(claims.sub),
      email: typeof claims.email === 'string' ? claims.email : null,
      name: typeof claims.name === 'string' ? claims.name : null,
      picture: typeof claims.picture === 'string' ? claims.picture : null,
    };
  }
}
