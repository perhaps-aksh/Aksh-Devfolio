import * as React from "react";

import { JpMark } from "@/components/JpMark";
import type { JourneyEntry } from "@/lib/site-content";

const LEAD = 0.75;

/** The journey comes from the database (Personalize -> Journey in the admin area). */
export function JourneyTrain({ entries }: { entries: readonly JourneyEntry[] }) {
  if (entries.length === 0) return <JourneyEmpty />;
  return <JourneyRail key={entries.map((e) => e.id).join("|")} entries={entries} />;
}

function JourneyEmpty() {
  return (
    <section id="journey" className="jt jt-empty">
      <div className="jt-pin">
        <JpMark tone="red">旅路</JpMark>
        <div className="jt-head">
          <span className="mono">Chapter 03 — Journey</span>
          <h2 className="jt-heading">THE JOURNEY TRAIN</h2>
        </div>
        <p className="section-empty">The timeline hasn't been written yet.</p>
      </div>
    </section>
  );
}

function JourneyRail({ entries }: { entries: readonly JourneyEntry[] }) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const trainRef = React.useRef<HTMLDivElement>(null);
  const carRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const layerRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = React.useState(0);
  const progressRef = React.useRef<HTMLElement>(null);
  const continuesRef = React.useRef<HTMLSpanElement>(null);
  const [vertical, setVertical] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const sync = () => setVertical(mq.matches);
    sync();
    setReady(true);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    let frame = 0;

    const render = () => {
      frame = 0;
      const wrap = wrapRef.current;
      const train = trainRef.current;
      if (!wrap || !train) return;

      const rect = wrap.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;

      const count = entries.length;
      const t = p * (count - 1 + LEAD * 2) - LEAD;

      const first = carRefs.current[0];
      const second = carRefs.current[1];

      if (vertical) {
        const carH = first ? first.offsetHeight : 420;
        const step = first && second ? second.offsetTop - first.offsetTop : carH + 48;
        // Train travels bottom → top: the active car meets the centre line.
        const y = window.innerHeight * 0.52 - carH / 2 - t * step;
        train.style.transform = `translate3d(0,${y}px,0)`;
        layerRefs.current.forEach((el, i) => {
          if (!el) return;
          const speed = [0.06, 0.16, 0.4][i] ?? 0.16;
          el.style.transform = `translate3d(0,${t * step * speed}px,0)`;
        });
      } else {
        const carW = first ? first.offsetWidth : 420;
        const step = first && second ? second.offsetLeft - first.offsetLeft : carW + 48;
        const x = window.innerWidth / 2 - carW / 2 - t * step;
        train.style.transform = `translate3d(${x}px,0,0)`;
        layerRefs.current.forEach((el, i) => {
          if (!el) return;
          const speed = [0.08, 0.22, 0.55][i] ?? 0.2;
          el.style.transform = `translate3d(${-t * step * speed}px,0,0)`;
        });
      }

      let nearest = 0;
      carRefs.current.forEach((el, i) => {
        if (!el) return;
        const d = Math.abs(t - i);
        if (d < Math.abs(t - nearest)) nearest = i;
        const focus = Math.max(0, 1 - d / 0.85);
        el.style.setProperty("--focus", focus.toFixed(3));
        el.dataset["zone"] = t - i > 0.5 ? "past" : t - i < -0.5 ? "future" : "now";
        el.classList.toggle("is-active", d < 0.5);
      });

      setActive(nearest);
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
      if (continuesRef.current)
        continuesRef.current.style.opacity = p > 0.9 ? String((p - 0.9) * 10) : "0";
    };

    // Only do scroll work while the pinned section is near the viewport.
    let inView = false;
    const onScroll = () => {
      if (inView && !frame) frame = window.requestAnimationFrame(render);
    };
    const wrapEl = wrapRef.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = !!entry?.isIntersecting;
        if (inView) onScroll();
      },
      { rootMargin: "50% 0px" },
    );
    if (wrapEl) io.observe(wrapEl);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [vertical, ready, entries]);

  const chapter = entries[active] ?? entries[0]!;

  return (
    <section id="journey" className={`jt ${vertical ? "jt-v" : "jt-h"}`} ref={wrapRef}>
      <div className="jt-pin">
        <JpMark tone="red">旅路</JpMark>
        <div className="jt-vignette" />

        <div
          className="jt-layer jt-sky"
          ref={(el) => {
            layerRefs.current[0] = el;
          }}
        >
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="jt-far" style={{ left: `${i * 9}%` }} />
          ))}
        </div>

        <div className="jt-head">
          <span className="mono">Chapter 03 — Journey</span>
          <h2 className="jt-heading">THE JOURNEY TRAIN</h2>
        </div>

        <div className="jt-story" key={chapter.id}>
          <span className="mono jt-story-index">
            {String(active + 1).padStart(2, "0")} / {chapter.year}
            {chapter.place ? ` · ${chapter.place}` : ""}
          </span>
          <h3 className="jt-story-title">{chapter.title}</h3>
          <p className="jt-story-desc">{chapter.description}</p>
          <div className="jt-story-tags mono">
            {chapter.tags.map((t) => (
              <span key={t}>+ {t}</span>
            ))}
          </div>
        </div>

        <div
          className="jt-rail-wrap"
          ref={(el) => {
            layerRefs.current[2] = el;
          }}
        >
          <span className="jt-rail" />
          <span className="jt-ties" />
        </div>

        <div className="jt-station">
          <span className="jt-station-line" />
          <span className="mono jt-station-label">STATION / NOW</span>
        </div>

        <div className="jt-train" ref={trainRef}>
          {entries.map((c, i) => (
            <div
              key={c.id}
              className="jt-car"
              ref={(el) => {
                carRefs.current[i] = el;
              }}
            >
              <span className="jt-coupler" />
              <div className="jt-car-body">
                <div className="jt-car-top mono">
                  <span>
                    {String(i + 1).padStart(2, "0")} / {String(entries.length).padStart(2, "0")}
                  </span>
                  <span>{c.place}</span>
                </div>
                <span className="mono jt-car-year">{c.year}</span>
                <div className="jt-car-copy">
                  <h3 className="jt-car-title">{c.title}</h3>
                  <p className="jt-car-desc">{c.description}</p>
                  <div className="jt-car-tags mono">
                    {c.tags.map((t) => (
                      <span key={t}>+ {t}</span>
                    ))}
                  </div>
                </div>
                <div className="jt-car-marks mono">
                  <span>AKSH — LINE {String(i + 1).padStart(2, "0")}</span>
                  <span>{c.stage}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="jt-foot mono">
          <span>PAST</span>
          <span className="jt-progress">
            <i ref={progressRef} style={{ transform: "scaleX(0)" }} />
          </span>
          <span>FUTURE</span>
        </div>

        <span className="jt-continues" ref={continuesRef} style={{ opacity: 0 }}>
          THE JOURNEY CONTINUES.
        </span>
      </div>
    </section>
  );
}
