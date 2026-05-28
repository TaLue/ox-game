import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

  @IsString()
  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV: string = 'development';

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  @IsOptional()
  WEB_ORIGIN: string = 'http://localhost:3000';

  @IsString()
  SESSION_SECRET!: string;

  @IsNumber()
  @IsOptional()
  SESSION_TTL_SECONDS: number = 3600;

  @IsString()
  @IsOptional()
  OAUTH_PROVIDER?: string;

  @IsString()
  @IsOptional()
  OAUTH_ISSUER_URL?: string;

  @IsString()
  @IsOptional()
  OAUTH_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  OAUTH_REDIRECT_URI?: string;

  @IsString()
  @IsOptional()
  ADMIN_EMAILS?: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n');
    throw new Error(`Environment validation failed:\n${messages}`);
  }

  return validated;
}
