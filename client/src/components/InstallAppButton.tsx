import { useEffect, useState } from "react";
import { Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isStandaloneMode } from "@/lib/push";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Apenas instalação do PWA. Push é gerenciado globalmente. */
export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalled(isStandaloneMode());
    setDeferred(
      ((window as any).__nmBeforeInstallPrompt as BeforeInstallPromptEvent | undefined) || null,
    );

    if (typeof (navigator as any).getInstalledRelatedApps === "function") {
      void (navigator as any).getInstalledRelatedApps().then((apps: Array<{ platform: string; id?: string }>) => {
        if (apps.some((app) => app.platform === "play" && app.id === "work.notifique_me.twa")) {
          setInstalled(true);
        }
      }).catch(() => {});
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      (window as any).__nmBeforeInstallPrompt = event;
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      try { delete (window as any).__nmBeforeInstallPrompt; } catch {}
    };
    const media = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayMode = () => setInstalled(isStandaloneMode());

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    media?.addEventListener?.("change", onDisplayMode);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      media?.removeEventListener?.("change", onDisplayMode);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setDeferred(null);
      return;
    }
    if (isIos) setShowIosHelp(true);
  };

  if (!deferred && !isIos) return null;

  return (
    <>
      <Button type="button" variant="outline" className="w-full gap-2" onClick={install}>
        {isIos ? <Info className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        Instalar aplicativo
      </Button>
      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instalar no iPhone ou iPad</DialogTitle>
            <DialogDescription>
              No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setShowIosHelp(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
