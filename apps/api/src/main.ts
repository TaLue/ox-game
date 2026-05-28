import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { RedisIoAdapter } from './ws/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // SEC-05: security headers via helmet; SEC-02: strict CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'wss:', 'ws:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  // SEC-05, SEC-08: global error filter — standard error shape + correlationId
  app.useGlobalFilters(new HttpExceptionFilter());

  // D7: Swagger at /docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('OX Game API')
    .setDescription('Tic-Tac-Toe REST API with OAuth2, scoring, and leaderboard')
    .setVersion('1.0')
    .addCookieAuth('sid')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // WS-04: Redis-backed Socket.IO adapter for multi-instance deployments
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on http://0.0.0.0:${port}/api`);
  console.log(`Swagger docs at http://0.0.0.0:${port}/docs`);
}

bootstrap();
