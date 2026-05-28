import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { ScoreModule } from '../score/score.module';
import { BotService } from './bot.service';
import { GameController } from './game.controller';
import { GameService } from './game.service';

@Module({
  imports: [ScoreModule],
  providers: [GameService, BotService, RateLimitGuard],
  controllers: [GameController],
})
export class GameModule {}
