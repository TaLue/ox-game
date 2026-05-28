import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AdminScoreEntry,
  Difficulty,
  GameStatus,
  Paginated,
  PlayerDetailDto,
  Role,
} from '@ox/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** AUTH-06: returns paginated user list with scores for admin consumption. */
  async getScores(page = 1, pageSize = 10, sort = 'hardBestStreak'): Promise<Paginated<AdminScoreEntry>> {
    const skip = (page - 1) * pageSize;
    const orderBy =
      sort === 'displayName'
        ? ({ displayName: 'asc' } as const)
        : sort === 'easyBestStreak'
        ? ({ score: { easyBestStreak: 'desc' } } as const)
        : ({ score: { hardBestStreak: 'desc' } } as const);

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ skip, take: pageSize, include: { score: true }, orderBy }),
      this.prisma.user.count(),
    ]);

    const data: AdminScoreEntry[] = users.map((u) => ({
      userId: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role as Role,
      easyCurrentStreak: u.score?.easyCurrentStreak ?? 0,
      easyBestStreak:    u.score?.easyBestStreak    ?? 0,
      hardCurrentStreak: u.score?.hardCurrentStreak ?? 0,
      hardBestStreak:    u.score?.hardBestStreak    ?? 0,
    }));

    return { data, total, page, pageSize };
  }

  /** AUTH-06: returns full player detail (score + last 10 games). */
  async getPlayerDetail(playerId: string): Promise<PlayerDetailDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: playerId },
      include: {
        score: true,
        games: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            difficulty: true,
            createdAt: true,
            finishedAt: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException();

    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role as Role,
      score: {
        easyCurrentStreak: user.score?.easyCurrentStreak ?? 0,
        easyBestStreak:    user.score?.easyBestStreak    ?? 0,
        hardCurrentStreak: user.score?.hardCurrentStreak ?? 0,
        hardBestStreak:    user.score?.hardBestStreak    ?? 0,
      },
      recentGames: user.games.map((g) => ({
        id: g.id,
        status: g.status as GameStatus,
        difficulty: g.difficulty as Difficulty,
        createdAt: g.createdAt.toISOString(),
        finishedAt: g.finishedAt?.toISOString() ?? null,
      })),
    };
  }
}
