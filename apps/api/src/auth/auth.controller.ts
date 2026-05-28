import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { MeDto } from '@ox/shared';
import { Public } from '../common/public.decorator';
import { RequestUser } from '../common/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** AUTH-07: public route — starts OAuth2 + PKCE flow */
  @Public()
  @Get('auth/login')
  async login(@Res() res: Response) {
    const url = await this.auth.buildLoginUrl();
    res.redirect(url);
  }

  /** AUTH-07: public route — OAuth2 callback */
  @Public()
  @Get('auth/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) throw new UnauthorizedException('Missing code or state');

    const sessionId = await this.auth.handleCallback(code, state);
    const ttl = this.config.get<number>('SESSION_TTL_SECONDS') ?? 3600;
    const isProd = this.config.get('NODE_ENV') === 'production';

    // AUTH-03: httpOnly, Secure (in prod), SameSite=Lax
    res.cookie('sid', sessionId, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: ttl * 1000,
    });

    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
    res.redirect(`${webOrigin}/play`);
  }

  /** Requires auth (AuthGuard applies globally) */
  @Post('auth/logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.cookies?.['sid'] as string | undefined;
    if (sessionId) await this.auth.destroySession(sessionId);
    res.clearCookie('sid');
  }

  /** GET /api/me — returns current user with score */
  @Get('me')
  async me(@Req() req: Request): Promise<MeDto> {
    const user = req.user as RequestUser;
    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { score: true },
    });

    return {
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.displayName,
      role: dbUser.role as 'PLAYER' | 'ADMIN',
      score: {
        easyCurrentStreak: dbUser.score?.easyCurrentStreak ?? 0,
        easyBestStreak:    dbUser.score?.easyBestStreak    ?? 0,
        hardCurrentStreak: dbUser.score?.hardCurrentStreak ?? 0,
        hardBestStreak:    dbUser.score?.hardBestStreak    ?? 0,
      },
    };
  }
}
