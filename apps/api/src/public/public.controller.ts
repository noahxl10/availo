import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { PublicService } from "./public.service.js";

@Controller("public")
export class PublicController {
  constructor(@Inject(PublicService) private readonly publicApi: PublicService) {}

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
  quote(@Body() body: unknown) {
    return this.publicApi.quote(body);
  }

  @Post("bookings/checkout")
  checkout(@Body() body: unknown) {
    return this.publicApi.checkout(body);
  }

  @Get("bookings/:id/confirmation")
  confirmation(@Param("id") id: string) {
    return this.publicApi.confirmation(id);
  }
}
