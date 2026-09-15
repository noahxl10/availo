import { randomBytes } from "node:crypto";

export function prefixedId(prefix: string) {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}
