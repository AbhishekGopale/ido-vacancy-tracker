import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.js';

export const redisConnectionOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      return null;
    }
    return 1000;
  },
};

export const redis = new Redis(env.REDIS_URL, {
  ...redisConnectionOptions,
  lazyConnect: true,
});

redis.on('connect', () => {
  console.log('🔗 Redis connected successfully.');
});

redis.on('error', () => {
  // Silent catch to prevent unhandled error event crash when Redis is offline in dev
});
