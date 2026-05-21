import { Controller, Get, Inject, Param } from "@nestjs/common";
import { BookingService } from "./booking.service.js";

@Controller("bookings")
export class BookingController {
  constructor(@Inject(BookingService) private readonly bookings: BookingService) {}

  @Get()
  list() {
    return this.bookings.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.bookings.get(id);
  }
}
