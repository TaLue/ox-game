import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import { SessionService } from './session.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{ cookies: Record<string, string>; user?: unknown }>();
    const sessionId = req.cookies?.['sid'];
    if (!sessionId) throw new UnauthorizedException('No session cookie');

    const session = await this.sessions.get(sessionId);
    if (!session) throw new UnauthorizedException('Session expired or not found');

    req.user = { id: session.userId, email: session.email, role: session.role };
    return true;
  }
}
