import { Test } from '@nestjs/testing';
import { Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { WsGateway } from './ws.gateway';

function makeSocket(cookie?: string): jest.Mocked<Pick<Socket, 'id' | 'handshake' | 'data' | 'disconnect' | 'join' | 'emit'>> {
  return {
    id: 'socket-1',
    handshake: { headers: { cookie } } as Socket['handshake'],
    data: {} as Socket['data'],
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
  } as unknown as jest.Mocked<Pick<Socket, 'id' | 'handshake' | 'data' | 'disconnect' | 'join' | 'emit'>>;
}

async function buildGateway(sessionJson: string | null = null) {
  const redisGet = jest.fn().mockResolvedValue(sessionJson);
  const module = await Test.createTestingModule({
    providers: [
      WsGateway,
      {
        provide: RedisService,
        useValue: { client: { get: redisGet } },
      },
    ],
  }).compile();
  return { gateway: module.get(WsGateway), redisGet };
}

// ── handleConnection ──────────────────────────────────────────────────────────

describe('WsGateway.handleConnection', () => {
  it('WS-01: disconnects when no cookie is present', async () => {
    const { gateway } = await buildGateway();
    const socket = makeSocket(undefined);
    await gateway.handleConnection(socket as unknown as Socket);
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('WS-01: disconnects when sid cookie is missing from header', async () => {
    const { gateway } = await buildGateway();
    const socket = makeSocket('other=value; unrelated=123');
    await gateway.handleConnection(socket as unknown as Socket);
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('WS-01: disconnects when session not found in Redis', async () => {
    const { gateway } = await buildGateway(null); // Redis returns null
    const socket = makeSocket('sid=bad-session-id');
    await gateway.handleConnection(socket as unknown as Socket);
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('WS-02: joins user room and emits connection:ack on valid session', async () => {
    const session = { userId: 'user-1', email: 'a@test.com', role: 'PLAYER' };
    const { gateway } = await buildGateway(JSON.stringify(session));
    const socket = makeSocket('sid=valid-sid');
    await gateway.handleConnection(socket as unknown as Socket);
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(socket.emit).toHaveBeenCalledWith('connection:ack', { userId: 'user-1' });
  });

  it('WS-02: sets socket.data.userId for the session', async () => {
    const { gateway } = await buildGateway(JSON.stringify({ userId: 'user-42', email: 'x@y.com', role: 'PLAYER' }));
    const socket = makeSocket('sid=s1');
    await gateway.handleConnection(socket as unknown as Socket);
    expect((socket as unknown as Socket).data.userId).toBe('user-42');
  });

  it('WS-01: correctly parses sid when multiple cookies are present', async () => {
    const session = { userId: 'user-2', email: 'b@test.com', role: 'PLAYER' };
    const { gateway, redisGet } = await buildGateway(JSON.stringify(session));
    const socket = makeSocket('locale=en; sid=my-session-id; theme=dark');
    await gateway.handleConnection(socket as unknown as Socket);
    expect(redisGet).toHaveBeenCalledWith('sess:my-session-id');
    expect(socket.emit).toHaveBeenCalledWith('connection:ack', { userId: 'user-2' });
  });
});

// ── emitScoreUpdate / emitLeaderboardUpdate ───────────────────────────────────

describe('WsGateway.emit*', () => {
  it('emitScoreUpdate sends score:update to user room (RULE-SCORE-08)', async () => {
    const { gateway } = await buildGateway();
    const mockEmit = jest.fn();
    const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
    gateway.server = { to: mockTo } as unknown as WsGateway['server'];
    const score = { easyCurrentStreak: 3, easyBestStreak: 5, hardCurrentStreak: 1, hardBestStreak: 2 };
    gateway.emitScoreUpdate('user-1', score);
    expect(mockTo).toHaveBeenCalledWith('user:user-1');
    expect(mockEmit).toHaveBeenCalledWith('score:update', score);
  });

  it('emitLeaderboardUpdate broadcasts leaderboard:update with difficulty (RULE-SCORE-08)', async () => {
    const { gateway } = await buildGateway();
    const mockEmit = jest.fn();
    gateway.server = { emit: mockEmit } as unknown as WsGateway['server'];
    const entries = [{ rank: 1, userId: 'u1', displayName: 'Alice', bestStreak: 10 }];
    gateway.emitLeaderboardUpdate('HARD', entries);
    expect(mockEmit).toHaveBeenCalledWith('leaderboard:update', { difficulty: 'HARD', entries });
  });

  it('emitScoreUpdate is a no-op when server is not yet initialised', async () => {
    const { gateway } = await buildGateway();
    gateway.server = null as unknown as WsGateway['server'];
    const score = { easyCurrentStreak: 0, easyBestStreak: 0, hardCurrentStreak: 0, hardBestStreak: 0 };
    expect(() => gateway.emitScoreUpdate('u', score)).not.toThrow();
  });
});
