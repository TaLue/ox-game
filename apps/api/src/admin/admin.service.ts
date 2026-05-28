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
  async getScores(page = 1, pageSize = 10, sort = 'hardScore'): Promise<Paginated<AdminScoreEntry>> {
    const skip = (page - 1) * pageSize;
    const orderBy =
      sort === 'displayName'
        ? ({ displayName: 'asc' } as const)
        : sort === 'easyScore'
        ? ({ score: { easyScore: 'desc' } } as const)
        : ({ score: { hardScore: 'desc' } } as const);

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ skip, take: pageSize, include: { score: true }, orderBy }),
      this.prisma.user.count(),
    ]);

    const data: AdminScoreEntry[] = users.map((u) => ({
      userId: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role as Role,
      easyScore:           u.score?.easyScore           ?? 0,
      easyConsecutiveWins: u.score?.easyConsecutiveWins ?? 0,
      hardScore:           u.score?.hardScore           ?? 0,
      hardConsecutiveWins: u.score?.hardConsecutiveWins ?? 0,
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
        easyScore:           user.score?.easyScore           ?? 0,
        easyConsecutiveWins: user.score?.easyConsecutiveWins ?? 0,
        hardScore:           user.score?.hardScore           ?? 0,
        hardConsecutiveWins: user.score?.hardConsecutiveWins ?? 0,
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
