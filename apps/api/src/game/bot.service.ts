import { Injectable } from '@nestjs/common';
import { Cell, Difficulty } from '@ox/shared';
import { getBotMove } from './bot';

/** Thin injectable wrapper around the pure getBotMove function.
 *  Injecting via NestJS DI lets integration tests swap in a deterministic mock. */
@Injectable()
export class BotService {
  move(board: Cell[], difficulty: Difficulty): number {
    return getBotMove(board, difficulty);
  }
}
