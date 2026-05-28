import { createHash } from 'crypto';
import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce.util';

describe('PKCE utilities', () => {
  it('generates a code verifier that is a non-empty base64url string (AUTH-02)', () => {
    // AUTH-02: PKCE code_verifier must be random and base64url-safe
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('code challenge is SHA-256 of verifier encoded as base64url (AUTH-02)', () => {
    // AUTH-02: code_challenge = BASE64URL(SHA256(code_verifier))
    const verifier = generateCodeVerifier();
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(generateCodeChallenge(verifier)).toBe(expected);
  });

  it('generates unique verifiers on each call (AUTH-02)', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('generates a hex state string (AUTH-02)', () => {
    // AUTH-02: state used for CSRF protection in OAuth flow
    const state = generateState();
    expect(state).toMatch(/^[0-9a-f]+$/);
    expect(state.length).toBeGreaterThanOrEqual(16);
  });

  it('generates unique states on each call (AUTH-02)', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});
