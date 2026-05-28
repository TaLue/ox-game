import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { GameDto, MoveResultDto } from '@ox/shared';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { RequestUser } from '../common/request-user.interface';
import { CreateGameDto } from './dto/create-game.dto';
import { MoveDto } from './dto/move.dto';
import { GameService } from './game.service';

@Controller('games')
export class GameController {
  constructor(private readonly games: GameService) {}

  @Post()
  @HttpCode(201)
  createGame(@Req() req: Request, @Body() dto: CreateGameDto): Promise<GameDto> {
    const user = req.user as RequestUser;
    return this.games.createGame(user.id, dto.difficulty ?? 'EASY');
  }

  @Get(':id')
  getGame(@Req() req: Request, @Param('id') id: string): Promise<GameDto> {
    const user = req.user as RequestUser;
    return this.games.getGame(id, user.id);
  }

  @Post(':id/move')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  makeMove(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: MoveDto,
  ): Promise<MoveResultDto> {
    const user = req.user as RequestUser;
    return this.games.makeMove(id, user.id, dto.position);
  }
}
