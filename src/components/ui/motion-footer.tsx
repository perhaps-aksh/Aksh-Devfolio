"use client";

import * as React from "react";
import { ArrowUp, ArrowUpRight, Mail } from "lucide-react";

import { cn } from "@/lib/utils";
import { smoothScrollToTop } from "@/lib/smooth-scroll";
import { SocialIcon } from "@/components/SocialIcon";
import type { SocialIconName } from "@/lib/social-icon-paths";
import "@/styles-footer.css";

/**
 * Curtain-reveal footer. The footer is `position: fixed` under a clipped, in-flow wrapper, so the page
 * "lifts" to uncover it. Kept deliberately light:
 *  - one IntersectionObserver toggles a class; all motion is CSS (transform / opacity only)
 *  - animations only run while the footer is on screen
 *  - no backdrop-filter, no blur filters, no scroll-scrubbed JS
 */

type FooterLink = { label: string; href: string; icon?: SocialIconName };

type CinematicFooterProps = {
  email?: string;
  socials?: readonly FooterLink[];
  onStartProject?: () => void;
  className?: string;
};

const MARQUEE = [
  "CREATIVE DEVELOPMENT",
  "CYBERSECURITY",
  "創造 ・ 技術 ・ 物語",
  "EXPRESSIVE INTERFACES",
  "OPEN FOR PROJECTS",
] as const;

function MarqueeGroup({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="cf-marquee-group" aria-hidden={hidden || undefined}>
      {MARQUEE.map((item, i) => (
        <React.Fragment key={item}>
          <span className={i === 2 ? "jp" : undefined}>{item}</span>
          <span className={i % 2 === 0 ? "cf-spark cf-spark-blue" : "cf-spark cf-spark-red"}>✦</span>
        </React.Fragment>
      ))}
    </div>
  );
}

/** Subtle magnetic pull for fine pointers. One rAF per pointermove, transform only. */
function useMagnetic<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      raf = 0;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x = (e.clientX - r.left - r.width / 2) * 0.22;
      y = (e.clientY - r.top - r.height / 2) * 0.28;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      x = 0;
      y = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return ref;
}

function Pill({
  href,
  onClick,
  external,
  tone = "blue",
  size = "md",
  label,
  children,
  className,
}: {
  href?: string;
  onClick?: () => void;
  external?: boolean;
  tone?: "blue" | "red";
  size?: "md" | "sm" | "icon";
  /** Accessible name for icon-only pills. */
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useMagnetic<HTMLAnchorElement & HTMLButtonElement>();
  const cls = cn("cf-pill mono", `cf-pill-${tone}`, size === "sm" && "cf-pill-sm", size === "icon" && "cf-pill-icon", className);
  if (href) {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        className={cls}
        {...(label ? { "aria-label": label, title: label } : {})}
        /* `external` here is only ever used for this person's own profile links. */
        {...(external ? { target: "_blank", rel: "me noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function CinematicFooter({
  email = "hello@aksh.dev",
  socials = [],
  onStartProject,
  className,
}: CinematicFooterProps) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = React.useState(false);
  const [live, setLive] = React.useState(false);

  React.useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    // "live" starts a little before the footer scrolls in, so it is rendered (and animating) only when needed.
    const liveIo = new IntersectionObserver(([entry]) => setLive(!!entry?.isIntersecting), { rootMargin: "30% 0px" });
    const revealIo = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setRevealed(true);
      },
      { threshold: 0.12 },
    );
    liveIo.observe(el);
    revealIo.observe(el);
    return () => {
      liveIo.disconnect();
      revealIo.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={cn("cf", revealed && "is-in", live && "is-live", className)}
      style={{ clipPath: "polygon(0% 0, 100% 0%, 100% 100%, 0 100%)" }}
    >
      <footer className="cf-footer" aria-label="Site footer">
        <div className="cf-aurora" aria-hidden="true" />
        <div className="cf-grid" aria-hidden="true" />
        <div className="cf-giant" aria-hidden="true">
          AKSH
        </div>

        <div className="cf-marquee" aria-hidden="true">
          <div className="cf-marquee-track">
            <MarqueeGroup />
            <MarqueeGroup hidden />
          </div>
        </div>

        <div className="cf-main">
          <span className="cf-kicker mono jp-kicker">
            <b className="jp">連絡</b> / CONTACT
          </span>
          <h2 className="cf-heading">
            READY TO BUILD
            <br />
            SOMETHING?
          </h2>
          <p className="cf-jp jp">一緒に、つくろう。</p>

          <div className="cf-links">
            <div className="cf-row">
              <Pill href={`mailto:${email}`} tone="blue">
                <Mail size={18} strokeWidth={1.6} aria-hidden="true" />
                {email}
              </Pill>
              {onStartProject ? (
                <Pill onClick={onStartProject} tone="red">
                  START A PROJECT
                  <ArrowUpRight size={18} strokeWidth={1.6} aria-hidden="true" />
                </Pill>
              ) : null}
            </div>
            <div className="cf-row cf-row-sm">
              {socials.map((s, i) => (
                <Pill
                  key={s.label}
                  href={s.href}
                  external
                  size={s.icon ? "icon" : "sm"}
                  label={s.label}
                  tone={i % 2 === 0 ? "red" : "blue"}
                >
                  {s.icon ? (
                    <SocialIcon name={s.icon} size={18} />
                  ) : (
                    <>
                      {s.label}
                      <ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" />
                    </>
                  )}
                </Pill>
              ))}
            </div>
          </div>
        </div>

        <div className="cf-bottom">
          <span className="cf-copy mono">© 2026 AKSH. ALL RIGHTS RESERVED.</span>
          <span className="cf-badge mono">
            CRAFTED WITH <i className="cf-heart" aria-hidden="true">❤</i> BY <b>AKSH</b>
            <span className="jp cf-badge-jp" aria-hidden="true">有難う</span>
            <i className="hanko hanko-sm jp" aria-hidden="true">暁</i>
          </span>
          <button type="button" className="cf-top" onClick={() => smoothScrollToTop()} aria-label="Back to top">
            <ArrowUp size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  );
}
