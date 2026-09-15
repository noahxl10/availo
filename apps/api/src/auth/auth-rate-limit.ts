import { Injectable } from "@nestjs/common";

const DEFAULT_LOGIN_IP_LIMIT = 30;
const DEFAULT_LOGIN_IDENTITY_LIMIT = 8;
const DEFAULT_REFRESH_IP_LIMIT = 60;
const DEFAULT_REFRESH_SESSION_LIMIT = 12;
const DEFAULT_AUTH_WINDOW_SECONDS = 15 * 60;
const DEFAULT_MAX_BUCKETS = 10_000;

type Bucket = {
  count: number;
  resetAt: number;
};

export type AuthRateLimitDecision = {
  allowed: boolean;
  disabled: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

class AuthRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxBuckets: number
  ) {}

  consume(input: { key: string; now?: Date }): AuthRateLimitDecision {
    const now = input.now?.getTime() ?? Date.now();
    if (this.limit === 0) return this.decision(true, Number.POSITIVE_INFINITY, now, true);
    this.cleanup(now);

    const key = normalizeKeyPart(input.key);
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (!bucket && this.buckets.size >= this.maxBuckets) return this.decision(false, now + this.windowMs, now, false);
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }

    if (bucket.count >= this.limit) return this.decision(false, bucket.resetAt, now, false);
    bucket.count += 1;
    return { ...this.decision(true, bucket.resetAt, now, false), remaining: this.limit - bucket.count };
  }

  resetForTests() {
    this.buckets.clear();
  }

  private cleanup(now: number) {
    if (this.buckets.size < this.maxBuckets) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  private decision(allowed: boolean, resetAt: number, now: number, disabled: boolean): AuthRateLimitDecision {
    return {
      allowed,
      disabled,
      limit: this.limit,
      remaining: allowed ? this.limit : 0,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000))
    };
  }
}

@Injectable()
export class AuthLoginIpRateLimiter extends AuthRateLimiter {
  constructor() {
    super(nonNegativeInt("AUTH_LOGIN_IP_RATE_LIMIT", DEFAULT_LOGIN_IP_LIMIT), authWindowMs(), authMaxBuckets());
  }
}

@Injectable()
export class AuthLoginIdentityRateLimiter extends AuthRateLimiter {
  constructor() {
    super(nonNegativeInt("AUTH_LOGIN_IDENTITY_RATE_LIMIT", DEFAULT_LOGIN_IDENTITY_LIMIT), authWindowMs(), authMaxBuckets());
  }
}

@Injectable()
export class AuthRefreshIpRateLimiter extends AuthRateLimiter {
  constructor() {
    super(nonNegativeInt("AUTH_REFRESH_IP_RATE_LIMIT", DEFAULT_REFRESH_IP_LIMIT), authWindowMs(), authMaxBuckets());
  }
}

@Injectable()
export class AuthRefreshSessionRateLimiter extends AuthRateLimiter {
  constructor() {
    super(nonNegativeInt("AUTH_REFRESH_SESSION_RATE_LIMIT", DEFAULT_REFRESH_SESSION_LIMIT), authWindowMs(), authMaxBuckets());
  }
}

function authWindowMs() {
  return positiveInt("AUTH_RATE_LIMIT_WINDOW_SECONDS", DEFAULT_AUTH_WINDOW_SECONDS) * 1000;
}

function authMaxBuckets() {
  return positiveInt("AUTH_RATE_LIMIT_MAX_KEYS", DEFAULT_MAX_BUCKETS);
}

function positiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function nonNegativeInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer.`);
  return value;
}

function normalizeKeyPart(value: string) {
  return value.trim().toLowerCase().slice(0, 180) || "unknown";
}
