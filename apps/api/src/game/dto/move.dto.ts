import { IsInt, Max, Min } from 'class-validator';

export class MoveDto {
  // RULE-GAME-04: position must be integer 0..8; ValidationPipe returns 400 on violation
  @IsInt({ message: 'position must be an integer' })
  @Min(0, { message: 'position must be >= 0' })
  @Max(8, { message: 'position must be <= 8' })
  position!: number;
}
