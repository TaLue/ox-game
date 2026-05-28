import { IsEnum, IsOptional } from 'class-validator';
import { Difficulty } from '@ox/shared';

export class CreateGameDto {
  @IsOptional()
  @IsEnum(['EASY', 'HARD'], { message: 'difficulty must be EASY or HARD' })
  difficulty?: Difficulty;
}
