"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** "Install the app" help, with a one-tap install where the browser supports it. */
export function InstallGuide() {
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [tab, setTab] = useState<"iphone" | "android" | "desktop">("iphone");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read display mode after mount
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
    if (/Android/.test(navigator.userAgent)) setTab("android");
    else if (!/iPhone|iPad|iPod/.test(navigator.userAgent) && navigator.maxTouchPoints < 2) setTab("desktop");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="text-[15px] text-muted">You&apos;re using the installed app. Nice!</p>;

  return (
    <div className="space-y-4">
      {prompt && (
        <Button
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") setInstalled(true);
            setPrompt(null);
          }}
        >
          Install Speak Ready
        </Button>
      )}
      <div role="tablist" aria-label="Your device" className="flex flex-wrap gap-1.5">
        {(
          [
            ["iphone", "iPhone / iPad"],
            ["android", "Android"],
            ["desktop", "Computer"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-9 rounded-full border px-3 text-sm ${tab === id ? "border-pine bg-pine-soft text-pine-strong" : "border-line text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed">
          {tab === "iphone" && (
            <>
              <li>Open Speak Ready in <strong>Safari</strong> (other apps&apos; built-in browsers can&apos;t install it).</li>
              <li>Tap the <strong>Share</strong> button (the square with an arrow).</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
              <li>Open Speak Ready from your Home Screen. On iOS 16.4 or later you can then turn on notifications on this page.</li>
            </>
          )}
          {tab === "android" && (
            <>
              <li>Open Speak Ready in <strong>Chrome</strong>.</li>
              <li>Tap the <strong>⋮</strong> menu, then <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</li>
              <li>Confirm with <strong>Install</strong>. Speak Ready opens like a regular app, and notifications work.</li>
            </>
          )}
          {tab === "desktop" && (
            <>
              <li>In Chrome or Edge, click the <strong>install</strong> icon at the right end of the address bar (or the menu → Install Speak Ready).</li>
              <li>In Safari on a Mac (Sonoma or later), choose <strong>File → Add to Dock</strong>.</li>
            </>
          )}
        </ol>
      </div>
    </div>
  );
}
