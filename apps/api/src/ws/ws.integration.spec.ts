/**
 * Integration tests for WsGateway — requires Docker redis.
 * Uses a real Socket.IO client to verify handshake auth and event delivery.
 */
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { validate } from '../config/env.validation';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { WsModule } from './ws.module';

const TEST_SID = 'ws-integration-test-sid';
const TEST_USER = { userId: 'ws-test-user', email: 'ws@int.test', role: 'PLAYER' };

describe('WsGateway (integration)', () => {
  let app: INestApplication;
  let redis: RedisService;
  let port: number;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate }),
        PrismaModule,
        RedisModule,
        WsModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0);
    port = (app.getHttpServer().address() as { port: number }).port;
    redis = module.get(RedisService);

    await redis.client.set(
      `sess:${TEST_SID}`,
      JSON.stringify(TEST_USER),
      'EX', 3600,
    );
  });

  afterAll(async () => {
    await redis.client.del(`sess:${TEST_SID}`);
    await app.close();
  });

  function connectWithCookie(cookie?: string): ClientSocket {
    return io(`http://localhost:${port}/ws`, {
      extraHeaders: cookie ? { cookie } : {},
      reconnection: false,
      timeout: 4000,
      transports: ['websocket'],
    });
  }

  function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout waiting for '${event}'`)), timeoutMs);
      socket.once(event, (data: T) => { clearTimeout(t); resolve(data); });
    });
  }

  it('WS-01: rejects connection without a session cookie', async () => {
    const socket = connectWithCookie(undefined);
    await new Promise<void>((resolve) => {
      socket.on('disconnect', () => resolve());
      socket.on('connect_error', () => resolve());
    });
    expect(socket.connected).toBe(false);
    socket.close();
  });

  it('WS-01: rejects connection with an invalid session id', async () => {
    const socket = connectWithCookie('sid=no-such-session');
    await new Promise<void>((resolve) => {
      socket.on('disconnect', () => resolve());
      socket.on('connect_error', () => resolve());
    });
    expect(socket.connected).toBe(false);
    socket.close();
  });

  it('WS-01, WS-02: authenticates and receives connection:ack', async () => {
    const socket = connectWithCookie(`sid=${TEST_SID}`);
    const ack = await waitFor<{ userId: string }>(socket, 'connection:ack');
    expect(ack.userId).toBe(TEST_USER.userId);
    socket.close();
  });

  it('emitScoreUpdate: score:update is received in the user room (RULE-SCORE-08)', async () => {
    const socket = connectWithCookie(`sid=${TEST_SID}`);
    await waitFor(socket, 'connection:ack');

    const { WsGateway } = await import('./ws.gateway');
    const gateway = app.get(WsGateway);
    const scorePayload = { easyScore: 3, easyConsecutiveWins: 1, hardScore: 5, hardConsecutiveWins: 2 };
    gateway.emitScoreUpdate(TEST_USER.userId, scorePayload);

    const received = await waitFor<typeof scorePayload>(socket, 'score:update');
    expect(received).toEqual(scorePayload);
    socket.close();
  });

  it('emitLeaderboardUpdate: leaderboard:update is broadcast (RULE-SCORE-08)', async () => {
    const socket = connectWithCookie(`sid=${TEST_SID}`);
    await waitFor(socket, 'connection:ack');

    const { WsGateway } = await import('./ws.gateway');
    const gateway = app.get(WsGateway);
    const entries = [{ rank: 1, userId: 'u1', displayName: 'Alice', score: 10 }];
    gateway.emitLeaderboardUpdate('HARD', entries);

    const received = await waitFor<{ difficulty: string; entries: typeof entries }>(socket, 'leaderboard:update');
    expect(received).toEqual({ difficulty: 'HARD', entries });
    socket.close();
  });
});
