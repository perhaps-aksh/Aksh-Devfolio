import * as React from "react";

import { JpMark } from "@/components/JpMark";
import type { Project } from "@/lib/content-types";

const TILT = [-2.6, 1.8, -1.4, 2.2, -2, 1.2];
const COPIES = 3;

const orderOf = (projects: readonly Project[], key: string) => {
  const [copy, ...rest] = key.split("-");
  const index = projects.findIndex((p) => p.id === rest.join("-"));
  return Number(copy) * projects.length + index;
};

type Motion = {
  y: number;
  vel: number;
  base: number;
  paused: boolean;
  dragging: boolean;
  lastY: number;
  moved: number;
  inView: boolean;
  reduced: boolean;
  setH: number;
  raf: number;
  lastFrame: number;
  focusY: number | null;
  focusEl: HTMLElement | null;
};

/**
 * The project list comes from the database (Projects in the admin area) or, when Supabase is not
 * configured, from src/lib/projects.ts. The rail is re-mounted whenever the list changes so its
 * measurements always match the rendered cards.
 */
export function WorkArchive({ projects }: { projects: readonly Project[] }) {
  if (projects.length === 0) return <WorkArchiveEmpty />;
  return <WorkArchiveRail key={projects.map((p) => p.id).join("|")} projects={projects} />;
}

function WorkArchiveEmpty() {
  return (
    <section id="projects" className="wa section" aria-labelledby="wa-title">
      <JpMark tone="blue">作品</JpMark>
      <div className="wa-head">
        <div className="wa-head-left">
          <div className="wa-label mono">
            <span>CHAPTER 05 / SELECTED WORK</span>
            <span>00 PROJECTS</span>
          </div>
          <h2 id="wa-title" className="wa-title">
            New work
            <br />
            is on the way.
          </h2>
        </div>
      </div>
    </section>
  );
}

function WorkArchiveRail({ projects }: { projects: readonly Project[] }) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const setRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = React.useState<string | null>(null);
  const [coarse, setCoarse] = React.useState(false);
  const activeRef = React.useRef<string | null>(null);

  const m = React.useRef<Motion>({
    y: 0,
    vel: 0,
    base: -0.5,
    paused: false,
    dragging: false,
    lastY: 0,
    moved: 0,
    inView: false,
    reduced: false,
    setH: 0,
    raf: 0,
    lastFrame: 0,
    focusY: null,
    focusEl: null,
  });

  // Pause and glide the focused card into the inspection zone.
  React.useEffect(() => {
    const s = m.current;
    activeRef.current = active;
    s.paused = active !== null;
    const viewport = viewportRef.current;
    if (!active || !viewport) {
      s.focusY = null;
      s.focusEl = null;
      return;
    }
    const card = viewport.querySelector<HTMLElement>(`[data-card="${active}"]`);
    if (!card) return;
    s.focusEl = card;
    const trackTop = trackRef.current?.offsetTop ?? 0;
    s.focusY = viewport.clientHeight / 2 - (trackTop + card.offsetTop + card.offsetHeight / 2);
  }, [active]);

  React.useEffect(() => {
    const s = m.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const coarseMq = window.matchMedia("(pointer: coarse)");
    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMq = () => {
      setCoarse(coarseMq.matches);
      s.reduced = reducedMq.matches;
      s.base = window.innerWidth < 768 ? -0.34 : -0.5;
    };
    syncMq();
    coarseMq.addEventListener("change", syncMq);
    reducedMq.addEventListener("change", syncMq);

    const measure = () => {
      const a = setRefs.current[0];
      const b = setRefs.current[1];
      s.setH = a && b ? b.offsetTop - a.offsetTop : track.scrollHeight / COPIES;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);

    const wrap = () => {
      if (s.setH <= 0) return;
      while (s.y <= -s.setH) s.y += s.setH;
      while (s.y > 0) s.y -= s.setH;
    };

    const tick = (now: number) => {
      const dt = s.lastFrame ? Math.min(48, now - s.lastFrame) : 16.67;
      s.lastFrame = now;
      const k = dt / 16.67;

      if (s.focusEl)
        s.focusY =
          viewport.clientHeight / 2 -
          (track.offsetTop + s.focusEl.offsetTop + s.focusEl.offsetHeight / 2);
      if (s.focusY !== null && !s.dragging) {
        // Ease to a complete stop with the active card centred.
        s.vel += (0 - s.vel) * 0.18 * k;
        s.y += (s.focusY - s.y) * 0.07 * k;
        if (Math.abs(s.focusY - s.y) < 0.4) s.y = s.focusY;
      } else if (!s.dragging) {
        const target = s.paused || s.reduced ? 0 : s.base;
        s.vel += (target - s.vel) * 0.045 * k;
        s.y += s.vel * k;
        wrap();
      }

      track.style.transform = `translate3d(0,${s.y.toFixed(2)}px,0)`;
      s.raf = s.inView ? window.requestAnimationFrame(tick) : 0;
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        s.inView = !!entry?.isIntersecting;
        if (s.inView && !s.raf) {
          s.lastFrame = 0;
          s.raf = window.requestAnimationFrame(tick);
        }
      },
      { rootMargin: "160px 0px" },
    );
    io.observe(viewport);

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      s.dragging = true;
      s.lastY = e.clientY;
      s.moved = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!s.dragging) return;
      const dy = e.clientY - s.lastY;
      s.lastY = e.clientY;
      s.moved += Math.abs(dy);
      if (s.moved > 10) {
        s.y += dy;
        s.focusY = null;
        wrap();
        viewport.dataset["swiped"] = "1";
      }
    };
    const onUp = () => {
      if (!s.dragging) return;
      s.dragging = false;
      window.setTimeout(() => {
        delete viewport.dataset["swiped"];
      }, 0);
    };
    viewport.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    // Hover is tracked on the viewport, not per card: the focused card glides to the centre,
    // so per-card enter/leave events would cancel their own hover mid-glide. Once a card is
    // active it stays until the pointer leaves the archive; switching needs a short dwell.
    let timer = 0;
    let leaveTimer = 0;
    let overKey: string | null = null;
    let lastX = -1;
    let lastY = -1;
    const onHoverMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      // Chrome re-fires pointermove at the same coordinates when content slides under a still cursor.
      if (Math.hypot(e.clientX - lastX, e.clientY - lastY) < 3) return;
      lastX = e.clientX;
      lastY = e.clientY;
      const card = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-card]");
      overKey = card?.dataset["card"] ?? null;
      if (!overKey || timer) return;
      const current = activeRef.current;
      if (overKey === current) return;
      const gliding = s.focusY !== null && Math.abs(s.focusY - s.y) > 4;
      if (gliding) return;
      timer = window.setTimeout(
        () => {
          timer = 0;
          if (overKey && overKey !== activeRef.current) setActive(overKey);
        },
        current === null ? 130 : 280,
      );
    };
    const onHoverEnter = () => {
      if (leaveTimer) window.clearTimeout(leaveTimer);
      leaveTimer = 0;
    };
    const onHoverLeave = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      overKey = null;
      if (timer) window.clearTimeout(timer);
      timer = 0;
      leaveTimer = window.setTimeout(() => {
        leaveTimer = 0;
        setActive(null);
      }, 240);
    };
    viewport.addEventListener("pointermove", onHoverMove);
    viewport.addEventListener("pointerenter", onHoverEnter);
    viewport.addEventListener("pointerleave", onHoverLeave);

    const onDocDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest(".wa-card")) setActive(null);
    };
    document.addEventListener("pointerdown", onDocDown);

    return () => {
      coarseMq.removeEventListener("change", syncMq);
      reducedMq.removeEventListener("change", syncMq);
      ro.disconnect();
      io.disconnect();
      if (s.raf) window.cancelAnimationFrame(s.raf);
      s.raf = 0;
      if (timer) window.clearTimeout(timer);
      if (leaveTimer) window.clearTimeout(leaveTimer);
      viewport.removeEventListener("pointermove", onHoverMove);
      viewport.removeEventListener("pointerenter", onHoverEnter);
      viewport.removeEventListener("pointerleave", onHoverLeave);
      viewport.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("pointerdown", onDocDown);
    };
  }, []);

  const total = String(projects.length).padStart(2, "0");
  const activeOrder = active ? orderOf(projects, active) : -1;

  return (
    <section id="projects" className="wa section" aria-labelledby="wa-title">
      <JpMark tone="blue">作品</JpMark>
      <div className="wa-head">
        <div className="wa-head-left">
          <div className="wa-label mono">
            <span>CHAPTER 05 / SELECTED WORK</span>
            <span>{total} PROJECTS</span>
          </div>
          <h2 id="wa-title" className="wa-title">
            Things I&apos;ve built
            <br />
            while figuring things out.
          </h2>
        </div>
        <div className="wa-head-right">
          <p>
            A moving archive — not a grid. Each sheet is a collected project;
            {coarse
              ? " tap one to stop the archive and inspect it."
              : " hover one to stop the archive and inspect it."}
          </p>
          <a href="#contact" className="wa-cta mono">
            START A PROJECT <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>

      <div className="wa-viewport" ref={viewportRef}>
        <span className="wa-zone" aria-hidden="true" />
        <div className={`wa-track ${active ? "has-active" : ""}`} ref={trackRef}>
          {Array.from({ length: COPIES }).map((_, c) => (
            <div
              key={c}
              className="wa-set"
              aria-hidden={c > 0 || undefined}
              ref={(el) => {
                setRefs.current[c] = el;
              }}
            >
              {projects.map((p, i) => {
                const key = `${c}-${p.id}`;
                const isActive = active === key;
                const n = String(i + 1).padStart(2, "0");
                const inert = c > 0;
                const rel =
                  activeOrder < 0 || isActive
                    ? ""
                    : c * projects.length + i < activeOrder
                      ? "is-before"
                      : "is-after";
                return (
                  <article
                    key={key}
                    data-card={key}
                    className={`wa-card ${isActive ? "is-active" : ""} ${rel}`}
                    style={{ "--rot": `${TILT[i % TILT.length]}deg` } as React.CSSProperties}
                  >
                    <button
                      type="button"
                      className="wa-card-hit"
                      aria-expanded={isActive}
                      aria-label={`${p.title} — ${isActive ? "hide" : "show"} details`}
                      tabIndex={inert ? -1 : 0}
                      onClick={(e) => {
                        if (
                          (e.currentTarget.closest(".wa-viewport") as HTMLElement | null)?.dataset[
                            "swiped"
                          ]
                        )
                          return;
                        setActive(isActive ? null : key);
                      }}
                      onFocus={(event) => {
                        if (event.currentTarget.matches(":focus-visible")) setActive(key);
                      }}
                    />
                    <div className="wa-card-top mono">
                      <span>
                        {n} / {p.category.toUpperCase()}
                      </span>
                      <span>{p.year}</span>
                    </div>
                    <div className="wa-card-body">
                      <div className="wa-card-img">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={inert ? "" : `${p.title} — ${p.category}`}
                            loading="lazy"
                            decoding="async"
                            sizes="(max-width: 768px) 80vw, 34vw"
                            draggable={false}
                          />
                        ) : (
                          <span className="wa-card-img-empty jp" aria-hidden="true">
                            作
                          </span>
                        )}
                      </div>
                      <div className="wa-card-copy">
                        <h3 className="wa-card-name">{p.title}</h3>
                        <div className="wa-card-details">
                          <div>
                            <p>{p.description}</p>
                            <span className="wa-tech mono">{p.technologies.join(" / ")}</span>
                            {(p.githubUrl || p.liveUrl) && (
                              <div className="wa-links mono">
                                {p.githubUrl && (
                                  <a
                                    href={p.githubUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    tabIndex={inert || !isActive ? -1 : 0}
                                  >
                                    GITHUB <span aria-hidden="true">↗</span>
                                  </a>
                                )}
                                {p.liveUrl && (
                                  <a
                                    href={p.liveUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    tabIndex={inert || !isActive ? -1 : 0}
                                  >
                                    LIVE DEMO <span aria-hidden="true">↗</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
        <span className="wa-edge wa-edge-t" aria-hidden="true" />
        <span className="wa-edge wa-edge-b" aria-hidden="true" />
      </div>

      <div className="wa-foot mono">
        <span>ARCHIVE / CONTINUOUS</span>
        <span>
          {coarse ? "TAP TO INSPECT · TAP OUTSIDE TO RESUME" : "HOVER TO STOP THE ARCHIVE"}
        </span>
      </div>
    </section>
  );
}
