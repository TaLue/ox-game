import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Difficulty, LeaderboardEntry, ScoreDto } from '@ox/shared';
import { Public } from '../common/public.decorator';
import { RequestUser } from '../common/request-user.interface';
import { ScoreService } from './score.service';

@Controller()
export class ScoreController {
  constructor(private readonly score: ScoreService) {}

  @Get('scores/me')
  getMyScore(@Req() req: Request): Promise<ScoreDto> {
    const user = req.user as RequestUser;
    return this.score.getScore(user.id);
  }

  @Public()
  @Get('leaderboard')
  getLeaderboard(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('difficulty') difficulty: Difficulty = 'HARD',
  ): Promise<LeaderboardEntry[]> {
    const diff: Difficulty = difficulty === 'EASY' ? 'EASY' : 'HARD';
    return this.score.getLeaderboard(limit, diff);
  }
}
