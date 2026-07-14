import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import {
  confirmPushActive,
  getOrCreatePushSubscription,
  refreshPushStatus,
} from "@/lib/push";
import { writeDiagnosticLog } from "@/lib/diagnostics";

const RETRY_DELAYS_MS = [0, 3_000, 10_000, 30_000];
const PERIODIC_RECHECK_MS = 5 * 60_000;
const PROMPT_DISMISS_KEY = "nm_push_permission_prompt_dismissed_at";
const PROMPT_RETRY_AFTER_MS = 7 * 24 * 60 * 60_000;

/**
 * Infraestrutura global de push.
 *
 * Não depende de telas específicas. Depois que a
 * permissão existe, garante que a subscription do navegador esteja válida e
 * sincronizada com o backend em boot, login, foco, retorno do background,
 * reconexão e troca do Service Worker.
 *
 * Na primeira autorização, o navegador exige um gesto do usuário. O componente
 * mostra uma explicação contextual e só abre o prompt nativo após o usuário
 * escolher explicitamente continuar. O aviso pode ser adiado por sete dias.
 */
export default function PushSubscriptionManager() {
  const { loading, isAuthenticated, userData } = useAuth();
  const userId = userData?.id ?? null;
  const enabled = !loading && isAuthenticated && Boolean(userId);

  const publicKeyQuery = trpc.push.publicKey.useQuery(undefined, {
    enabled,
    staleTime: 10 * 60_000,
    retry: 3,
  });
  const { mutateAsync: saveSubscription } = trpc.push.subscribe.useMutation();

  const runningRef = useRef<Promise<boolean> | null>(null);
  const generationRef = useRef(0);
  const permissionPromptedRef = useRef(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  const synchronize = useCallback(
    async (reason: string, allowPermissionPrompt = false): Promise<boolean> => {
      if (!enabled || !userId) return false;
      if (runningRef.current) return runningRef.current;

      const generation = generationRef.current;
      const task = (async () => {
        if (
          typeof window === "undefined" ||
          typeof Notification === "undefined" ||
          !("serviceWorker" in navigator) ||
          !("PushManager" in window)
        ) {
          writeDiagnosticLog("warn", "push-manager", `Push indisponível (${reason})`);
          return false;
        }

        if (Notification.permission === "denied") {
          writeDiagnosticLog("warn", "push-manager", `Permissão bloqueada (${reason})`);
          refreshPushStatus();
          return false;
        }

        if (Notification.permission === "default" && !allowPermissionPrompt) {
          refreshPushStatus();
          return false;
        }

        const publicKey = publicKeyQuery.data?.publicKey?.trim();
        if (!publicKey) {
          writeDiagnosticLog("warn", "push-manager", `VAPID ainda indisponível (${reason})`);
          return false;
        }

        try {
          writeDiagnosticLog("info", "push-manager", `Sincronização iniciada: ${reason}`);
          const subscription = await getOrCreatePushSubscription(publicKey);
          const json = subscription.toJSON();
          const endpoint = String(json.endpoint || subscription.endpoint || "");
          const p256dh = String(json.keys?.p256dh || "");
          const auth = String(json.keys?.auth || "");

          if (!endpoint || !p256dh || !auth) {
            throw new Error("Subscription retornada sem endpoint ou chaves completas");
          }

          if (generation !== generationRef.current) return false;

          await saveSubscription({
            endpoint,
            keys: { p256dh, auth },
            userAgent: navigator.userAgent,
          });

          if (generation !== generationRef.current) return false;
          confirmPushActive();
          try {
            localStorage.setItem("nm_push_activated_once", "1");
          } catch {}
          writeDiagnosticLog("info", "push-manager", `Subscription sincronizada: ${reason}`);
          return true;
        } catch (error) {
          writeDiagnosticLog(
            "error",
            "push-manager",
            `Sincronização falhou (${reason}): ${String((error as Error)?.message || error)}`,
            error,
          );
          refreshPushStatus();
          return false;
        }
      })().finally(() => {
        if (runningRef.current === task) runningRef.current = null;
      });

      runningRef.current = task;
      return task;
    },
    [enabled, publicKeyQuery.data?.publicKey, saveSubscription, userId],
  );

  const synchronizeWithRetry = useCallback(
    async (reason: string) => {
      for (let index = 0; index < RETRY_DELAYS_MS.length; index += 1) {
        const delay = RETRY_DELAYS_MS[index];
        if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
        if (!enabled || document.visibilityState === "hidden") return;
        if (await synchronize(`${reason}:tentativa-${index + 1}`)) return;
        if (Notification.permission !== "granted") return;
      }
    },
    [enabled, synchronize],
  );

  useEffect(() => {
    generationRef.current += 1;
    permissionPromptedRef.current = false;
    setShowPermissionPrompt(false);
    if (!enabled || !publicKeyQuery.data?.publicKey) return;

    if (Notification.permission === "granted") {
      void synchronizeWithRetry("boot-autenticado");
    } else {
      refreshPushStatus();
      if (Notification.permission === "default") {
        let dismissedAt = 0;
        try {
          dismissedAt = Number(localStorage.getItem(PROMPT_DISMISS_KEY) || 0);
        } catch {}
        setShowPermissionPrompt(!dismissedAt || Date.now() - dismissedAt >= PROMPT_RETRY_AFTER_MS);
      }
    }
  }, [enabled, publicKeyQuery.data?.publicKey, userId, synchronizeWithRetry]);

  useEffect(() => {
    if (!enabled || !publicKeyQuery.data?.publicKey) return;

    const repair = () => {
      if (document.visibilityState !== "hidden" && Notification.permission === "granted") {
        void synchronizeWithRetry("evento-de-recuperacao");
      }
    };
    const onVisibility = () => {
      if (!document.hidden) repair();
    };

    window.addEventListener("pageshow", repair);
    window.addEventListener("focus", repair);
    window.addEventListener("online", repair);
    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.addEventListener?.("controllerchange", repair);
    const interval = window.setInterval(repair, PERIODIC_RECHECK_MS);

    return () => {
      window.removeEventListener("pageshow", repair);
      window.removeEventListener("focus", repair);
      window.removeEventListener("online", repair);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker?.removeEventListener?.("controllerchange", repair);
      window.clearInterval(interval);
    };
  }, [enabled, publicKeyQuery.data?.publicKey, synchronizeWithRetry]);

  const requestPermission = useCallback(async () => {
    if (permissionPromptedRef.current) return;
    permissionPromptedRef.current = true;
    setShowPermissionPrompt(false);
    await synchronize("consentimento-contextual", true);
  }, [synchronize]);

  const dismissPermissionPrompt = useCallback(() => {
    setShowPermissionPrompt(false);
    try {
      localStorage.setItem(PROMPT_DISMISS_KEY, String(Date.now()));
    } catch {}
  }, []);

  useEffect(() => {
    if (enabled) return;
    generationRef.current += 1;
    runningRef.current = null;
    refreshPushStatus();
  }, [enabled]);

  if (!showPermissionPrompt) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Ativar notificações"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-md rounded-2xl border bg-background p-4 shadow-2xl"
    >
      <div className="text-sm font-semibold">Receba mensagens importantes</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Ative os alertas para receber mensagens mesmo quando o aplicativo estiver fechado.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={dismissPermissionPrompt}
          className="rounded-lg border px-3 py-2 text-xs hover:bg-muted"
        >
          Agora não
        </button>
        <button
          type="button"
          onClick={() => void requestPermission()}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
