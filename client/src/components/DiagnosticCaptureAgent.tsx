import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  readDiagnosticLogs,
  runSystemDiagnostics,
  setRemoteDiagnosticCaptureActive,
  subscribeDiagnosticLogs,
  writeDiagnosticLog,
} from "@/lib/diagnostics";
import { trpc } from "@/lib/trpc";

const INSTALLATION_KEY = "notifique-me:installation-id:v1";

function getInstallationId(): string {
  try {
    const existing = localStorage.getItem(INSTALLATION_KEY);
    if (existing) return existing;
    const created = typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(INSTALLATION_KEY, created);
    return created;
  } catch {
    return `volatile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export default function DiagnosticCaptureAgent() {
  const { userData, isAuthenticated } = useAuth();
  const [revision, setRevision] = useState(0);
  const sentIdsRef = useRef(new Set<string>());
  const captureIdRef = useRef<number | null>(null);
  const flushingRef = useRef(false);

  const activeQuery = trpc.diagnosticCaptures.active.useQuery(undefined, {
    enabled: isAuthenticated && userData?.role === "user",
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const uploadMutation = trpc.diagnosticCaptures.upload.useMutation();
  const active = isAuthenticated && userData?.role === "user" ? activeQuery.data : null;

  useEffect(() => subscribeDiagnosticLogs(() => setRevision((value) => value + 1)), []);

  useEffect(() => {
    const nextCaptureId = active?.id ?? null;
    if (captureIdRef.current === nextCaptureId) return;
    captureIdRef.current = nextCaptureId;
    sentIdsRef.current.clear();
    setRemoteDiagnosticCaptureActive(Boolean(active));
    if (active) {
      writeDiagnosticLog("info", "remote-diagnostics", "Gravação de diagnóstico iniciada pelo administrador", {
        captureId: active.id,
        startedAt: active.startedAt,
      });
      void runSystemDiagnostics();
    }
  }, [active?.id, active?.startedAt]);

  const flush = useCallback(async () => {
    if (!active || flushingRef.current) return;
    flushingRef.current = true;
    try {
      const startedAtMs = new Date(active.startedAt).getTime();
      const entries = readDiagnosticLogs()
        .filter((entry) => new Date(entry.at).getTime() >= startedAtMs && !sentIdsRef.current.has(entry.id))
        .slice(0, 100);
      if (!entries.length) return;
      await uploadMutation.mutateAsync({
        captureId: active.id,
        installationId: getInstallationId(),
        entries,
      });
      for (const entry of entries) sentIdsRef.current.add(entry.id);
    } catch {
      // A captura remota nunca pode interferir no uso normal do aplicativo.
    } finally {
      flushingRef.current = false;
    }
  }, [active?.id, active?.startedAt, uploadMutation]);

  useEffect(() => {
    if (!active) return;
    void flush();
  }, [active?.id, revision, flush]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void flush(), 5_000);
    return () => window.clearInterval(timer);
  }, [active?.id, flush]);

  return null;
}