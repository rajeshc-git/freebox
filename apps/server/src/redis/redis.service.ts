import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private memoryCache = new Map<string, { value: string; expiresAt?: number }>();

  async onModuleInit() {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    try {
      this.client = new Redis({
        host,
        port,
        retryStrategy: () => null, // Don't crash if Redis is not running locally
        lazyConnect: true,
        connectTimeout: 2000,
      });

      await this.client.connect();
      this.logger.log(`Connected to Redis at ${host}:${port}`);
    } catch (err) {
      this.logger.warn(`Redis not available (${err.message}). Using high-performance in-memory cache.`);
      this.client = null;
    }
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.client) {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return;
    }

    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.memoryCache.set(key, { value, expiresAt });
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      return await this.client.get(key);
    }

    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value;
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      await this.client.del(key);
      return;
    }
    this.memoryCache.delete(key);
  }
}
