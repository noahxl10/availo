import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ListingService } from "./listing.service.js";

@Controller("listings")
export class ListingController {
  constructor(@Inject(ListingService) private readonly listings: ListingService) {}

  @Get()
  list() {
    return this.listings.list();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.listings.create(body);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.listings.get(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.listings.update(id, body);
  }

  @Delete(":id")
  archive(@Param("id") id: string) {
    return this.listings.archive(id);
  }
}
