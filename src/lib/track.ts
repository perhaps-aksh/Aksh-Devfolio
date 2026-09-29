/**
 * Anonymous page-view beacon. Sent once the browser is idle, never blocks rendering, and is skipped
 * for visitors who send "Do Not Track" / Global Privacy Control and for the admin area.
 */
export function trackPageView(path: string, firstView: boolean): void {
  if (typeof window === "undefined" || path === "/admin" || path.startsWith("/admin/")) return;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return;

  const body = JSON.stringify({ p: path, r: firstView ? document.referrer : "" });
  const send = () => {
    try {
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/track", {
          method: "POST",
          body,
          keepalive: true,
          headers: { "content-type": "application/json" },
        });
      }
    } catch {
      /* analytics must never break the page */
    }
  };
  if (typeof window.requestIdleCallback === "function")
    window.requestIdleCallback(send, { timeout: 4000 });
  else window.setTimeout(send, 1500);
}
