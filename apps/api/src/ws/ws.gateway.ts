import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LeaderboardEntry, ScoreDto } from '@ox/shared';
import { RedisService } from '../redis/redis.service';

interface SessionData {
  userId: string;
  email: string;
  role: string;
}

function parseSid(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name.trim() === 'sid') return decodeURIComponent(rest.join('='));
  }
  return null;
}

@WebSocketGateway({ namespace: '/ws', cors: { origin: '*', credentials: true } })
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(WsGateway.name);

  constructor(private readonly redis: RedisService) {}

  /** WS-01: authenticate via session cookie; WS-02: join room, send ack. */
  async handleConnection(client: Socket): Promise<void> {
    const sid = parseSid(client.handshake.headers.cookie as string | undefined);
    if (!sid) {
      client.disconnect();
      return;
    }

    const raw = await this.redis.client.get(`sess:${sid}`);
    if (!raw) {
      client.disconnect();
      return;
    }

    const session = JSON.parse(raw) as SessionData;
    client.data.userId = session.userId;
    await client.join(`user:${session.userId}`);
    client.emit('connection:ack', { userId: session.userId });
    this.logger.debug(`connected: ${session.userId}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`disconnected: ${client.id}`);
  }

  /** Pushes updated score to the player's private room (RULE-SCORE-08). */
  emitScoreUpdate(userId: string, score: ScoreDto): void {
    this.server?.to(`user:${userId}`).emit('score:update', score);
  }

  /** Broadcasts new leaderboard snapshot (with difficulty) to all connected clients (RULE-SCORE-08). */
  emitLeaderboardUpdate(difficulty: import('@ox/shared').Difficulty, entries: LeaderboardEntry[]): void {
    this.server?.emit('leaderboard:update', { difficulty, entries });
  }
}
