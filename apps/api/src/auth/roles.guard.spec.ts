import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

function setup(requiredRoles?: string[]) {
  const reflector = {
    getAllAndOverride: jest.fn().mockImplementation((key: string) =>
      key === ROLES_KEY ? (requiredRoles ?? null) : null,
    ),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

function makeCtx(role: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1', role } }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no @Roles() decorator (AUTH-06)', () => {
    // AUTH-06: routes without @Roles are accessible to all authenticated users
    const guard = setup(undefined);
    expect(guard.canActivate(makeCtx('PLAYER'))).toBe(true);
  });

  it('allows ADMIN to access an ADMIN-only route (AUTH-06)', () => {
    // AUTH-06
    const guard = setup(['ADMIN']);
    expect(guard.canActivate(makeCtx('ADMIN'))).toBe(true);
  });

  it('throws 403 when PLAYER accesses an ADMIN-only route (AUTH-06)', () => {
    // AUTH-06
    const guard = setup(['ADMIN']);
    expect(() => guard.canActivate(makeCtx('PLAYER'))).toThrow(ForbiddenException);
  });
});
