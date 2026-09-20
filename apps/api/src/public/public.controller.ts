import { Body, Controller, Get, HttpException, HttpStatus, Inject, Param, Post, Query, Req, Res } from "@nestjs/common";
import { PublicCheckoutRateLimiter, PublicQuoteRateLimiter, type PublicRateLimitDecision } from "./public-rate-limit.js";
import { PublicService } from "./public.service.js";

@Controller("public")
export class PublicController {
  constructor(
    @Inject(PublicService) private readonly publicApi: PublicService,
    @Inject(PublicQuoteRateLimiter) private readonly quoteRateLimiter: PublicQuoteRateLimiter,
    @Inject(PublicCheckoutRateLimiter) private readonly checkoutRateLimiter: PublicCheckoutRateLimiter
  ) {}

  @Get("businesses/:slug/listings")
  businessListings(@Param("slug") slug: string) {
    return this.publicApi.businessListings(slug);
  }

  @Get("listings/:id")
  listing(@Param("id") id: string) {
    return this.publicApi.listing(id);
  }

  @Get("listings/:id/availability")
  availability(@Param("id") id: string, @Query("date") date = new Date().toISOString().slice(0, 10)) {
    return this.publicApi.availability(id, date);
  }

  @Post("bookings/quote")
  quote(@Body() body: unknown, @Req() request: RequestLike, @Res({ passthrough: true }) response: ResponseLike) {
    const rateLimit = this.quoteRateLimiter.consume({
      source: clientSource(request)
    });
    setRateLimitHeaders(response, rateLimit);
    if (!rateLimit.allowed) {
      throw new HttpException({
        message: "Too many quote requests. Please try again later."
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.publicApi.quote(body);
  }

  @Post("bookings/checkout")
  checkout(@Body() body: unknown, @Req() request: RequestLike, @Res({ passthrough: true }) response: ResponseLike) {
    const rateLimit = this.checkoutRateLimiter.consume({
      source: clientSource(request)
    });
    setRateLimitHeaders(response, rateLimit);
    if (!rateLimit.allowed) {
      throw new HttpException({
        message: "Too many checkout requests. Please try again later."
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.publicApi.checkout(body);
  }

  @Get("bookings/:id/confirmation")
  confirmation(@Param("id") id: string, @Query("receiptToken") receiptToken: unknown) {
    return this.publicApi.confirmation(id, receiptToken);
  }
}

type RequestLike = {
  ip?: string;
  socket?: { remoteAddress?: string };
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
};

function clientSource(request: RequestLike) {
  return request.ip ?? request.socket?.remoteAddress ?? "unknown";
}

function setRateLimitHeaders(response: ResponseLike, rateLimit: PublicRateLimitDecision) {
  if (rateLimit.disabled) return;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("RateLimit-Limit", String(rateLimit.limit));
  response.setHeader("RateLimit-Remaining", String(Math.max(rateLimit.remaining, 0)));
  response.setHeader("RateLimit-Reset", String(rateLimit.retryAfterSeconds));
  if (!rateLimit.allowed) response.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
}
