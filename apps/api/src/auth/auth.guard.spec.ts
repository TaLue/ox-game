import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { SessionService } from './session.service';
import { IS_PUBLIC_KEY } from '../common/public.decorator';

type SessionData = { userId: string; email: string; role: string; displayName: string } | null;

function setup(sessionData: SessionData, isPublic = false) {
  const sessionService = {
    get: jest.fn().mockResolvedValue(sessionData),
  } as unknown as SessionService;

  const reflector = {
    getAllAndOverride: jest.fn().mockImplementation((key: string) =>
      key === IS_PUBLIC_KEY ? isPublic : null,
    ),
  } as unknown as Reflector;

  const guard = new AuthGuard(sessionService, reflector);
  return { guard, sessionService };
}

function makeCtx(cookies: Record<string, string>): { ctx: ExecutionContext; req: Record<string, unknown> } {
  const req: Record<string, unknown> = { cookies };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('AuthGuard', () => {
  it('bypasses validation for @Public() routes (AUTH-05)', async () => {
    // AUTH-05: AuthGuard must skip session check on public routes
    const { guard } = setup(null, true);
    const { ctx } = makeCtx({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws 401 when sid cookie is absent (AUTH-05)', async () => {
    // AUTH-05
    const { guard } = setup(null);
    const { ctx } = makeCtx({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when session is not in Redis (AUTH-05)', async () => {
    // AUTH-05: expired / unknown session ID
    const { guard } = setup(null);
    const { ctx } = makeCtx({ sid: 'unknown' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches req.user and returns true for a valid session (AUTH-05)', async () => {
    // AUTH-05: guard must attach { id, email, role } to request
    const sessionData = { userId: 'u1', email: 'a@b.com', role: 'PLAYER', displayName: 'Alice' };
    const { guard } = setup(sessionData);
    const { ctx, req } = makeCtx({ sid: 'valid-sid' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req['user']).toEqual({ id: 'u1', email: 'a@b.com', role: 'PLAYER' });
  });
});
