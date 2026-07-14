import { describe, expect, it } from "vitest";
import {
  assertAttachmentPolicy,
  assertAudiencePolicy,
  normalizePositiveIds,
} from "./notificationPolicy";

describe("notificationPolicy", () => {
  it("permite owner enviar para administradores", () => {
    expect(() =>
      assertAudiencePolicy({ actorRole: "owner", audience: "admins", targetType: "users" }),
    ).not.toThrow();
  });

  it("impede admin de enviar para administradores", () => {
    expect(() =>
      assertAudiencePolicy({ actorRole: "admin", audience: "admins", targetType: "users" }),
    ).toThrow(/Apenas o owner/);
  });

  it("impede grupos no canal administrativo", () => {
    expect(() =>
      assertAudiencePolicy({ actorRole: "owner", audience: "admins", targetType: "groups" }),
    ).toThrow(/Grupos não são permitidos/);
  });

  it("normaliza, remove duplicados e rejeita ids inválidos", () => {
    expect(normalizePositiveIds([1, "2", 2, 0, -1, NaN, 3.5, null])).toEqual([1, 2]);
  });

  it("impede anexo de outro tenant", () => {
    expect(() =>
      assertAttachmentPolicy({
        actorRole: "admin",
        actorId: 10,
        messageTenantId: 1,
        fileTenantId: 2,
        uploadedBy: 10,
      }),
    ).toThrow(/fora do tenant/);
  });

  it("impede admin de usar anexo enviado por outro admin", () => {
    expect(() =>
      assertAttachmentPolicy({
        actorRole: "admin",
        actorId: 10,
        messageTenantId: 1,
        fileTenantId: 1,
        uploadedBy: 11,
      }),
    ).toThrow(/própria conta/);
  });

  it("permite owner usar anexo do tenant selecionado", () => {
    expect(() =>
      assertAttachmentPolicy({
        actorRole: "owner",
        actorId: 1,
        messageTenantId: 7,
        fileTenantId: 7,
        uploadedBy: 99,
      }),
    ).not.toThrow();
  });

  it("impede reutilizar anexo já vinculado", () => {
    expect(() =>
      assertAttachmentPolicy({
        actorRole: "owner",
        actorId: 1,
        messageTenantId: 7,
        fileTenantId: 7,
        uploadedBy: 99,
        relatedNotificationId: 123,
      }),
    ).toThrow(/já está vinculado/);
  });
});
