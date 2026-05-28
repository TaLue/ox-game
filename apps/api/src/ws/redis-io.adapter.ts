import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

/**
 * Socket.IO adapter backed by Redis pub/sub so broadcasts reach all API
 * instances when running horizontally (WS-04).
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  constructor(app: INestApplication) {
    super(app);
  }

  async connectToRedis(url: string): Promise<void> {
    const pub = new Redis(url);
    const sub = pub.duplicate();
    await Promise.all([
      new Promise<void>((res, rej) => { pub.once('ready', res); pub.once('error', rej); }),
      new Promise<void>((res, rej) => { sub.once('ready', res); sub.once('error', rej); }),
    ]);
    this.adapterConstructor = createAdapter(pub, sub);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
