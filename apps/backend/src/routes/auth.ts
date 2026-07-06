import type { FastifyPluginAsync } from "fastify";
import { db, schema } from "@ledgr/db";
import { eq, and, sql } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashPassword,
  verifyPassword,
} from "../lib/auth.js";
import { authenticate } from "../lib/authenticate.js";
import { requireRole } from "../lib/require-role.js";
import { validate } from "../lib/validate.js";
import { registerSchema, loginSchema } from "../schemas/index.js";

const REFRESH_COOKIE = "refresh_token";

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const pair of header.split(";")) {
    const [key, ...rest] = pair.split("=");
    if (key) {
      cookies[key.trim()] = rest.join("=").trim();
    }
  }
  return cookies;
}

function setRefreshCookie(reply: any, value: string, maxAge: number): void {
  const parts = [
    `${REFRESH_COOKIE}=${value}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/api/auth",
    `Max-Age=${maxAge}`,
  ];
  reply.header("Set-Cookie", parts.join("; "));
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/register",
    {
      preHandler: [authenticate, requireRole("admin")],
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const body = validate(registerSchema, request.body, reply);
      if (!body) return;

      const [existing] = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.email, body.email),
            eq(schema.users.tenantId, body.tenant_id),
          ),
        );

      if (existing) {
        reply.code(409);
        return { error: "User already exists" };
      }

      const [user] = await db
        .insert(schema.users)
        .values({
          email: body.email,
          passwordHash: hashPassword(body.password),
          tenantId: body.tenant_id,
          role: body.role ?? "member",
        })
        .returning();

      reply.code(201);
      return {
        id: user.id,
        email: user.email,
        tenant_id: user.tenantId,
        role: user.role,
      };
    },
  );

  fastify.post(
    "/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const body = validate(loginSchema, request.body, reply);
    if (!body) return;

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, body.email))
      .limit(1);

    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      reply.code(401);
      return { error: "Invalid email or password" };
    }

    const [tenant] = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_tenant_id', ${user.tenantId}, true)`,
      );
      return tx
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, user.tenantId));
    });

    const accessToken = await generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenantId,
      tenant_slug: tenant?.slug ?? "",
    });

    const refreshToken = await generateRefreshToken(user.id);

    setRefreshCookie(reply, refreshToken, 60 * 60 * 24 * 7);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant_id: user.tenantId,
      },
    };
  });

  fastify.post(
    "/refresh",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const cookies = parseCookies(request.headers.cookie);
    const token = cookies[REFRESH_COOKIE];

    if (!token) {
      reply.code(401);
      return { error: "Missing refresh token" };
    }

    try {
      const { sub: userId } = await verifyRefreshToken(token);

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));

      if (!user) {
        reply.code(401);
        return { error: "User not found" };
      }

      const [tenant] = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, user.tenantId));

      const accessToken = await generateAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        tenant_id: user.tenantId,
        tenant_slug: tenant?.slug ?? "",
      });

      return { access_token: accessToken };
    } catch {
      reply.code(401);
      return { error: "Invalid refresh token" };
    }
  });

  fastify.post(
    "/logout",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (_request, reply) => {
    setRefreshCookie(reply, "", 0);
    return { success: true };
  });

  fastify.get(
    "/me",
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request) => {
    return { user: request.user };
  });
};

export default authRoutes;
