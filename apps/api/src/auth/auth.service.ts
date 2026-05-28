import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SessionData, SessionService } from './session.service';
import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce.util';

const OAUTH_STATE_TTL = 600; // 10 minutes

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
}

interface IdTokenClaims {
  sub: string;
  email: string;
  name?: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private oidc: OidcDiscovery | null = null;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
  ) {}

  async onModuleInit() {
    const issuerUrl = this.config.get<string>('OAUTH_ISSUER_URL');
    if (!issuerUrl) {
      this.logger.warn('OAUTH_ISSUER_URL not set — OAuth login will not work');
      return;
    }
    try {
      const res = await fetch(`${issuerUrl}/.well-known/openid-configuration`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.oidc = (await res.json()) as OidcDiscovery;
      this.jwks = createRemoteJWKSet(new URL(this.oidc.jwks_uri));
      this.logger.log(`OIDC discovery OK: issuer=${this.oidc.issuer}`);
    } catch (err) {
      this.logger.error(`OIDC discovery failed: ${(err as Error).message}`);
    }
  }

  /** Step 1: generate state + PKCE params and store in Redis, return redirect URL */
  async buildLoginUrl(): Promise<string> {
    this.assertOidcReady();
    const state = generateState();
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);

    // AUTH-02: store state→verifier with short TTL in Redis
    await this.redis.client.set(`oauth:${state}`, verifier, 'EX', OAUTH_STATE_TTL);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.getOrThrow('OAUTH_CLIENT_ID'),
      redirect_uri: this.config.getOrThrow('OAUTH_REDIRECT_URI'),
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return `${this.oidc!.authorization_endpoint}?${params}`;
  }

  /** Step 2: validate state, exchange code, verify ID token, upsert user, create session */
  async handleCallback(code: string, state: string): Promise<string> {
    this.assertOidcReady();

    // AUTH-02: validate state from Redis
    const verifier = await this.redis.client.get(`oauth:${state}`);
    if (!verifier) throw new UnauthorizedException('Invalid or expired OAuth state');
    await this.redis.client.del(`oauth:${state}`);

    // AUTH-02: exchange code + verifier for tokens
    const tokens = await this.exchangeCode(code, verifier);

    // AUTH-02: verify ID token signature, issuer, audience, expiry
    const claims = await this.verifyIdToken(tokens.id_token);

    // AUTH-06: resolve role from ADMIN_EMAILS env
    const adminEmails = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const role = adminEmails.includes(claims.email) ? 'ADMIN' : 'PLAYER';

    // AUTH-02: upsert user in DB
    const provider = this.config.get<string>('OAUTH_PROVIDER') ?? 'oidc';
    const user = await this.prisma.user.upsert({
      where: { provider_providerId: { provider, providerId: claims.sub } },
      update: { email: claims.email, displayName: claims.name ?? claims.email, role },
      create: {
        provider,
        providerId: claims.sub,
        email: claims.email,
        displayName: claims.name ?? claims.email,
        role,
      },
    });

    // AUTH-03: create server-side session (BFF — browser never sees IdP tokens)
    const sessionData: SessionData = {
      userId: user.id,
      email: user.email,
      role: user.role as 'PLAYER' | 'ADMIN',
      displayName: user.displayName,
    };
    return this.sessions.create(sessionData);
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.sessions.destroy(sessionId);
  }

  private async exchangeCode(code: string, verifier: string) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.getOrThrow('OAUTH_CLIENT_ID'),
      client_secret: this.config.getOrThrow('OAUTH_CLIENT_SECRET'),
      code,
      redirect_uri: this.config.getOrThrow('OAUTH_REDIRECT_URI'),
      code_verifier: verifier,
    });

    const res = await fetch(this.oidc!.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new UnauthorizedException(`Token exchange failed: ${text}`);
    }
    return res.json() as Promise<{ id_token: string; access_token: string; refresh_token?: string }>;
  }

  private async verifyIdToken(idToken: string): Promise<IdTokenClaims> {
    const { payload } = await jwtVerify(idToken, this.jwks!, {
      issuer: this.oidc!.issuer,
      audience: this.config.getOrThrow('OAUTH_CLIENT_ID'),
    });
    if (!payload.sub || !payload['email']) {
      throw new UnauthorizedException('ID token missing required claims');
    }
    return {
      sub: payload.sub,
      email: payload['email'] as string,
      name: payload['name'] as string | undefined,
    };
  }

  private assertOidcReady() {
    if (!this.oidc || !this.jwks) {
      throw new UnauthorizedException('OAuth provider not configured');
    }
  }
}
