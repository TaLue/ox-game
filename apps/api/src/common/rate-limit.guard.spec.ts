import { ExecutionContext, HttpException } from '@nestjs/common';
import { RateLimitGuard, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS } from './rate-limit.guard';

function makeCtx(userId = 'user-1') {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: userId } }),
    }),
  } as unknown as ExecutionContext;
}

function makeRedis(initial = 0) {
  let counter = initial;
  return {
    client: {
      incr: jest.fn().mockImplementation(async () => ++counter),
      expire: jest.fn().mockResolvedValue(1),
    },
  } as unknown as import('../redis/redis.service').RedisService;
}

describe('RateLimitGuard', () => {
  it('allows requests below the limit (SEC-07)', async () => {
    const redis = makeRedis(0);
    const guard = new RateLimitGuard(redis);
    await expect(guard.canActivate(makeCtx())).resolves.toBe(true);
    expect(redis.client.incr).toHaveBeenCalledWith('rl:user-1');
  });

  it('sets TTL on the first request (SEC-07)', async () => {
    const redis = makeRedis(0); // first incr returns 1
    const guard = new RateLimitGuard(redis);
    await guard.canActivate(makeCtx());
    expect(redis.client.expire).toHaveBeenCalledWith('rl:user-1', RATE_LIMIT_WINDOW_SECONDS);
  });

  it('does not reset TTL on subsequent requests (SEC-07)', async () => {
    const redis = makeRedis(1); // first incr returns 2
    const guard = new RateLimitGuard(redis);
    await guard.canActivate(makeCtx());
    expect(redis.client.expire).not.toHaveBeenCalled();
  });

  it(`throws 429 when count exceeds ${RATE_LIMIT_MAX} (SEC-07)`, async () => {
    const redis = makeRedis(RATE_LIMIT_MAX); // next incr returns MAX+1
    const guard = new RateLimitGuard(redis);
    await expect(guard.canActivate(makeCtx())).rejects.toThrow(HttpException);
    const err = await guard.canActivate(makeCtx()).catch((e) => e);
    expect(err.getStatus()).toBe(429);
  });

  it('passes through when user is not set (unauthenticated) (SEC-07)', async () => {
    const redis = makeRedis(0);
    const guard = new RateLimitGuard(redis);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(redis.client.incr).not.toHaveBeenCalled();
  });
});
