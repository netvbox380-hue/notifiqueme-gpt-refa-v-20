import { TRPCError } from "@trpc/server";

export type NotificationAudience = "users" | "admins";
export type NotificationTargetType = "all" | "users" | "groups";

export function assertAudiencePolicy(params: {
  actorRole: string | null | undefined;
  audience: NotificationAudience;
  targetType: NotificationTargetType;
}): void {
  const isOwner = params.actorRole === "owner";
  if (params.audience === "admins" && !isOwner) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas o owner pode enviar avisos administrativos",
    });
  }
  if (params.audience === "admins" && params.targetType === "groups") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Grupos não são permitidos para avisos aos administradores",
    });
  }
}

export function normalizePositiveIds(ids: unknown[]): number[] {
  return Array.from(
    new Set(
      ids
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
}

export function assertAttachmentPolicy(params: {
  actorRole: string | null | undefined;
  actorId: number;
  messageTenantId: number;
  fileTenantId: number;
  uploadedBy: number;
  relatedNotificationId?: number | null;
}): void {
  if (params.fileTenantId !== params.messageTenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Anexo fora do tenant da mensagem",
    });
  }
  if (params.actorRole !== "owner" && params.uploadedBy !== params.actorId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você só pode enviar anexos carregados pela sua própria conta",
    });
  }
  if (params.relatedNotificationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Um dos anexos já está vinculado a outra mensagem",
    });
  }
}
