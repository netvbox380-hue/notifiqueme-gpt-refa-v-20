// Registro do Service Worker para PWA (sem interceptar /api e sem quebrar POST)
// Base preservada do projeto estável, com melhoria segura para remover SWs antigos
// incompatíveis e garantir o /sw.js como único registro do app.

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  try {
    // Fallback usado apenas quando o registro central de main.tsx ainda não
    // terminou. Não chama update() nem aguarda serviceWorker.ready.
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (error) {
    console.warn("Falha ao registrar Service Worker:", error);
    return null;
  }
}

export async function unregisterServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
}
