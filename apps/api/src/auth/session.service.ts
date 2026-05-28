import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../redis/redis.service';

export interface SessionData {
  userId: string;
  email: string;
  role: 'PLAYER' | 'ADMIN';
  displayName: string;
}

@Injectable()
export class SessionService {
  private readonly ttl: number;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.ttl = this.config.get<number>('SESSION_TTL_SECONDS') ?? 3600;
  }

  async create(data: SessionData): Promise<string> {
    const sessionId = uuidv4();
    await this.redis.client.set(`sess:${sessionId}`, JSON.stringify(data), 'EX', this.ttl);
    return sessionId;
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const raw = await this.redis.client.get(`sess:${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  }

  async destroy(sessionId: string): Promise<void> {
    await this.redis.client.del(`sess:${sessionId}`);
  }
}
