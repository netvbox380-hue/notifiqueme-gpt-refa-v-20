import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import {
  diagnosticCaptureEvents,
  diagnosticCaptures,
  deliveries,
  logs,
  notifications,
  pushSubscriptions,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EVENTS_PER_UPLOAD = 100;
const MAX_REPORT_EVENTS = 2500;

function requireTenantAdmin(ctx: any): number {
  if (ctx.user?.role !== "admin" || !ctx.user?.tenantId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o admin do tenant pode gerenciar capturas" });
  }
  return Number(ctx.user.tenantId);
}

async function cleanupExpired(db: any): Promise<void> {
  await db.delete(diagnosticCaptures).where(lt(diagnosticCaptures.expiresAt, new Date())).catch(() => undefined);
}

async function assertTenantUser(db: any, tenantId: number, userId: number) {
  const [user] = await db
    .select({ id: users.id, openId: users.openId, name: users.name, tenantId: users.tenantId })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId), eq(users.role, "user")))
    .limit(1);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado neste tenant" });
  return user;
}

const diagnosticEntrySchema = z.object({
  id: z.string().min(1).max(100),
  at: z.string().datetime(),
  level: z.enum(["info", "warn", "error"]),
  source: z.string().min(1).max(100),
  message: z.string().min(1).max(1000),
  details: z.unknown().optional(),
  path: z.string().max(2000).optional(),
});

export const diagnosticCapturesRouter = router({
  active: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    await cleanupExpired(db);
    const [capture] = await db
      .select({ id: diagnosticCaptures.id, startedAt: diagnosticCaptures.startedAt, expiresAt: diagnosticCaptures.expiresAt })
      .from(diagnosticCaptures)
      .where(and(
        eq(diagnosticCaptures.userId, ctx.user.id),
        eq(diagnosticCaptures.status, "recording"),
        gt(diagnosticCaptures.expiresAt, new Date()),
      ))
      .orderBy(desc(diagnosticCaptures.id))
      .limit(1);
    return capture ?? null;
  }),

  upload: protectedProcedure
    .input(z.object({
      captureId: z.number().int().positive(),
      installationId: z.string().min(8).max(100),
      entries: z.array(diagnosticEntrySchema).min(1).max(MAX_EVENTS_PER_UPLOAD),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      await cleanupExpired(db);
      const [capture] = await db
        .select({ id: diagnosticCaptures.id, tenantId: diagnosticCaptures.tenantId })
        .from(diagnosticCaptures)
        .where(and(
          eq(diagnosticCaptures.id, input.captureId),
          eq(diagnosticCaptures.userId, ctx.user.id),
          eq(diagnosticCaptures.status, "recording"),
          gt(diagnosticCaptures.expiresAt, new Date()),
        ))
        .limit(1);
      if (!capture) throw new TRPCError({ code: "NOT_FOUND", message: "Gravação não está ativa" });

      await db.insert(diagnosticCaptureEvents).values(input.entries.map((entry) => ({
        captureId: capture.id,
        tenantId: capture.tenantId,
        userId: ctx.user.id,
        installationId: input.installationId,
        clientEventId: entry.id,
        eventAt: new Date(entry.at),
        level: entry.level,
        source: entry.source,
        message: entry.message,
        details: entry.details ?? null,
        path: entry.path ?? null,
      }))).onConflictDoNothing();
      return { accepted: input.entries.length };
    }),

  start: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      const tenantId = requireTenantAdmin(ctx);
      const user = await assertTenantUser(db, tenantId, input.userId);
      await cleanupExpired(db);
      const now = new Date();
      await db.update(diagnosticCaptures).set({ status: "stopped", stoppedAt: now, expiresAt: new Date(now.getTime() + RETENTION_MS) })
        .where(and(eq(diagnosticCaptures.tenantId, tenantId), eq(diagnosticCaptures.userId, input.userId), eq(diagnosticCaptures.status, "recording")));
      const [capture] = await db.insert(diagnosticCaptures).values({
        tenantId,
        userId: input.userId,
        requestedByUserId: ctx.user.id,
        status: "recording",
        startedAt: now,
        expiresAt: new Date(now.getTime() + RETENTION_MS),
      }).returning();
      return { capture, user };
    }),

  stop: adminProcedure
    .input(z.object({ captureId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      const tenantId = requireTenantAdmin(ctx);
      const now = new Date();
      const [capture] = await db.update(diagnosticCaptures).set({
        status: "stopped",
        stoppedAt: now,
        expiresAt: new Date(now.getTime() + RETENTION_MS),
      }).where(and(eq(diagnosticCaptures.id, input.captureId), eq(diagnosticCaptures.tenantId, tenantId), eq(diagnosticCaptures.status, "recording"))).returning();
      if (!capture) throw new TRPCError({ code: "NOT_FOUND", message: "Gravação ativa não encontrada" });
      return capture;
    }),

  list: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = requireTenantAdmin(ctx);
      await assertTenantUser(db, tenantId, input.userId);
      await cleanupExpired(db);
      return db.select({
        id: diagnosticCaptures.id,
        status: diagnosticCaptures.status,
        startedAt: diagnosticCaptures.startedAt,
        stoppedAt: diagnosticCaptures.stoppedAt,
        expiresAt: diagnosticCaptures.expiresAt,
        eventCount: sql<number>`count(${diagnosticCaptureEvents.id})::int`,
      }).from(diagnosticCaptures)
        .leftJoin(diagnosticCaptureEvents, eq(diagnosticCaptureEvents.captureId, diagnosticCaptures.id))
        .where(and(eq(diagnosticCaptures.tenantId, tenantId), eq(diagnosticCaptures.userId, input.userId)))
        .groupBy(diagnosticCaptures.id)
        .orderBy(desc(diagnosticCaptures.id));
    }),

  report: adminProcedure
    .input(z.object({ captureId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
      const tenantId = requireTenantAdmin(ctx);
      await cleanupExpired(db);
      const [capture] = await db.select().from(diagnosticCaptures)
        .where(and(eq(diagnosticCaptures.id, input.captureId), eq(diagnosticCaptures.tenantId, tenantId), gt(diagnosticCaptures.expiresAt, new Date())))
        .limit(1);
      if (!capture) throw new TRPCError({ code: "NOT_FOUND", message: "Relatório não encontrado ou expirado" });
      const user = await assertTenantUser(db, tenantId, capture.userId);
      const events = await db.select().from(diagnosticCaptureEvents)
        .where(eq(diagnosticCaptureEvents.captureId, capture.id))
        .orderBy(diagnosticCaptureEvents.eventAt)
        .limit(MAX_REPORT_EVENTS);
      const subscriptions = await db.select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, userAgent: pushSubscriptions.userAgent, updatedAt: pushSubscriptions.updatedAt })
        .from(pushSubscriptions).where(eq(pushSubscriptions.userId, capture.userId));
      const deliveryRows = await db.select({
        id: deliveries.id,
        notificationId: deliveries.notificationId,
        status: deliveries.status,
        isRead: deliveries.isRead,
        readAt: deliveries.readAt,
        deliveredAt: deliveries.deliveredAt,
        title: notifications.title,
      }).from(deliveries)
        .leftJoin(notifications, eq(notifications.id, deliveries.notificationId))
        .where(and(eq(deliveries.tenantId, tenantId), eq(deliveries.userId, capture.userId), gt(notifications.createdAt, capture.startedAt)))
        .orderBy(desc(deliveries.id)).limit(200);
      const auditRows = await db.select().from(logs)
        .where(and(eq(logs.tenantId, tenantId), eq(logs.userId, capture.userId), gt(logs.createdAt, capture.startedAt)))
        .orderBy(desc(logs.id)).limit(200);
      return {
        capture,
        user,
        events,
        subscriptions: subscriptions.map((item) => ({ ...item, endpoint: item.endpoint.replace(/(.{28}).+(.{12})$/, "$1…$2") })),
        deliveries: deliveryRows,
        audit: auditRows,
      };
    }),
});