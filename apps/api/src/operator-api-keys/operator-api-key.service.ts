import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prefixedId } from "../common/ids.js";
import type { AuthenticatedActor } from "../auth/auth-context.js";
import { PrismaService } from "../prisma/prisma.service.js";

const API_KEY_PREFIX = "avlo";
const apiKeyNameInput = z
  .object({
    name: z.string().trim().min(1).max(80)
  })
  .strict();

@Injectable()
export class OperatorApiKeyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  isOperatorApiKeyCredential(credential: string) {
    return credential.startsWith(`${API_KEY_PREFIX}_`);
  }

  async authenticate(credential: string): Promise<AuthenticatedActor> {
    const parsed = parseApiKeyCredential(credential);
    const apiKey = await this.prisma.operatorApiKey.findUnique({
      where: { prefix: parsed.prefix },
      select: {
        id: true,
        businessId: true,
        secretHash: true,
        revokedAt: true,
        createdByUserId: true,
        business: { select: { status: true } },
        createdByUser: { select: { businessId: true, status: true } }
      }
    });

    if (
      !apiKey ||
      apiKey.revokedAt ||
      apiKey.business.status !== "active" ||
      apiKey.createdByUser.status !== "active" ||
      apiKey.createdByUser.businessId !== apiKey.businessId ||
      !constantTimeEqual(hashApiKey(credential), apiKey.secretHash)
    ) {
      throw new UnauthorizedException("Invalid operator API key");
    }

    await this.prisma.operatorApiKey.updateMany({ where: { id: apiKey.id, revokedAt: null }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    return {
      userId: apiKey.createdByUserId,
      businessId: apiKey.businessId,
      role: "viewer",
      sessionId: apiKey.id,
      authMethod: "api_key",
      apiKeyId: apiKey.id
    };
  }

  list(actor: AuthenticatedActor) {
    return this.prisma.operatorApiKey.findMany({
      where: { businessId: actor.businessId },
      select: apiKeySelect,
      orderBy: { createdAt: "desc" }
    });
  }

  async create(actor: AuthenticatedActor, body: unknown) {
    const parsed = apiKeyNameInput.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const token = generateApiKey();
    const apiKey = await this.prisma.$transaction(async (tx) => {
      const created = await tx.operatorApiKey.create({
        data: {
          id: prefixedId("oak"),
          businessId: actor.businessId,
          createdByUserId: actor.userId,
          name: parsed.data.name,
          prefix: token.prefix,
          secretHash: hashApiKey(token.credential)
        },
        select: apiKeySelect
      });
      await tx.auditLog.create({
        data: {
          id: prefixedId("aud"),
          businessId: actor.businessId,
          userId: actor.userId,
          action: "operator_api_key.created",
          entityType: "operator_api_key",
          entityId: created.id,
          metadataJson: JSON.stringify({ prefix: created.prefix, name: created.name })
        }
      });
      return created;
    });

    return { ...apiKey, key: token.credential };
  }

  async revoke(actor: AuthenticatedActor, id: string) {
    const now = new Date();
    const apiKey = await this.prisma.$transaction(async (tx) => {
      const current = await tx.operatorApiKey.findFirst({ where: { id, businessId: actor.businessId }, select: { id: true, revokedAt: true, prefix: true, name: true } });
      if (!current) throw new NotFoundException("Operator API key not found");
      const revoked = await tx.operatorApiKey.update({ where: { id: current.id }, data: { revokedAt: current.revokedAt ?? now }, select: apiKeySelect });
      if (!current.revokedAt) {
        await tx.auditLog.create({
          data: {
            id: prefixedId("aud"),
            businessId: actor.businessId,
            userId: actor.userId,
            action: "operator_api_key.revoked",
            entityType: "operator_api_key",
            entityId: current.id,
            metadataJson: JSON.stringify({ prefix: current.prefix, name: current.name })
          }
        });
      }
      return revoked;
    });
    return apiKey;
  }
}

const apiKeySelect = {
  id: true,
  name: true,
  prefix: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true
} as const;

function generateApiKey() {
  const prefix = randomBytes(6).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  return { prefix, credential: `${API_KEY_PREFIX}_${prefix}_${secret}` };
}

function parseApiKeyCredential(credential: string) {
  const match = /^avlo_([A-Za-z0-9_-]{8})_([A-Za-z0-9_-]{43})$/.exec(credential);
  if (!match) throw new UnauthorizedException("Invalid operator API key");
  return { prefix: match[1]! };
}

function hashApiKey(credential: string) {
  return createHash("sha256").update(credential, "utf8").digest("base64url");
}

function constantTimeEqual(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
