import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DEMO_BUSINESS_ID } from "../common/tenant.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class BookingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.booking.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      include: { listing: true, addOns: { include: { addOn: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async get(id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
      include: { listing: true, addOns: { include: { addOn: true } } }
    });
    if (!booking) throw new NotFoundException("Booking not found");
    return booking;
  }
}
