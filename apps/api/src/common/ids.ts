import { randomBytes } from "node:crypto";

export function prefixedId(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function secureToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}
