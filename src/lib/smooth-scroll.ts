import type Lenis from "lenis";

let instance: Lenis | null = null;
let locked = false;

/** Loads Lenis after the page is idle so it never competes with first paint or hydration. */
export function initSmoothScroll(): () => void {
  if (typeof window === "undefined") return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  let cancelled = false;
  let created: Lenis | null = null;

  const boot = async () => {
    const { default: LenisCtor } = await import("lenis");
    if (cancelled) return;
    created = new LenisCtor({ lerp: 0.065, wheelMultiplier: 0.8, smoothWheel: true, autoRaf: true });
    instance = created;
    if (locked) created.stop();
  };

  const idle = typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(() => void boot(), { timeout: 1500 })
    : window.setTimeout(() => void boot(), 300);

  return () => {
    cancelled = true;
    if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
    else window.clearTimeout(idle);
    created?.destroy();
    if (instance === created) instance = null;
  };
}

export function setScrollLocked(next: boolean) {
  locked = next;
  if (!instance) return;
  if (next) instance.stop();
  else instance.start();
}

export function smoothScrollTo(target: HTMLElement, duration = 1.8): boolean {
  if (!instance) return false;
  instance.scrollTo(target, { duration, easing: (t) => 1 - Math.pow(1 - t, 4) });
  return true;
}

export function smoothScrollToTop(duration = 2) {
  if (instance) instance.scrollTo(0, { duration, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}
