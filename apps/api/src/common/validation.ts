import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}
