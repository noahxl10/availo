import { Injectable } from "@nestjs/common";

const DEFAULT_QUOTE_LIMIT = 6;
const DEFAULT_QUOTE_WINDOW_SECONDS = 15 * 60;
const DEFAULT_CHECKOUT_LIMIT = 12;
const DEFAULT_CHECKOUT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_MAX_BUCKETS = 10_000;

type Bucket = {
  count: number;
  resetAt: number;
};

export type PublicRateLimitDecision = {
  allowed: boolean;
  disabled: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: Date;
};

class PublicRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxBuckets: number
  ) {}

  consume(input: { source: string; now?: Date }): PublicRateLimitDecision {
    const now = input.now?.getTime() ?? Date.now();
    if (this.limit === 0) return this.decision(true, now + this.windowMs, Number.POSITIVE_INFINITY, now, true);
    this.cleanup(now);

    const key = normalizeKeyPart(input.source);
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (!bucket && this.buckets.size >= this.maxBuckets) {
        return this.decision(false, now + this.windowMs, 0, now, false);
      }
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }

    if (bucket.count >= this.limit) {
      return this.decision(false, bucket.resetAt, 0, now, false);
    }

    bucket.count += 1;
    return this.decision(true, bucket.resetAt, this.limit - bucket.count, now, false);
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

  private decision(allowed: boolean, resetAt: number, remaining: number, now: number, disabled: boolean): PublicRateLimitDecision {
    return {
      allowed,
      disabled,
      limit: this.limit,
      remaining,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      resetAt: new Date(resetAt)
    };
  }
}

@Injectable()
export class PublicQuoteRateLimiter extends PublicRateLimiter {
  constructor() {
    super(
      nonNegativeInt("PUBLIC_QUOTE_RATE_LIMIT", DEFAULT_QUOTE_LIMIT),
      positiveInt("PUBLIC_QUOTE_RATE_WINDOW_SECONDS", DEFAULT_QUOTE_WINDOW_SECONDS) * 1000,
      positiveInt("PUBLIC_RATE_LIMIT_MAX_KEYS", DEFAULT_MAX_BUCKETS)
    );
  }
}

@Injectable()
export class PublicCheckoutRateLimiter extends PublicRateLimiter {
  constructor() {
    super(
      nonNegativeInt("PUBLIC_CHECKOUT_RATE_LIMIT", DEFAULT_CHECKOUT_LIMIT),
      positiveInt("PUBLIC_CHECKOUT_RATE_WINDOW_SECONDS", DEFAULT_CHECKOUT_WINDOW_SECONDS) * 1000,
      positiveInt("PUBLIC_RATE_LIMIT_MAX_KEYS", DEFAULT_MAX_BUCKETS)
    );
  }
}

function positiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function nonNegativeInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value;
}

function normalizeKeyPart(value: string) {
  return value.trim().toLowerCase().slice(0, 160) || "unknown";
}
