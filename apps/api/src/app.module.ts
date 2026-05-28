import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { validate } from './config/env.validation';
import { GameModule } from './game/game.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ScoreModule } from './score/score.module';
import { WsModule } from './ws/ws.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    PrismaModule,
    RedisModule,
    AuthModule,
    ScoreModule,
    WsModule,
    GameModule,
    AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
