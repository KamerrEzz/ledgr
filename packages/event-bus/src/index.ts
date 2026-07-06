import { Redis } from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
});

export function createPublisher() {
  return redis;
}

export function createSubscriber() {
  return redis.duplicate();
}

export { redis };
