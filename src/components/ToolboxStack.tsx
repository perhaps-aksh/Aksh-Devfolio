import * as React from "react";

import { JpMark } from "@/components/JpMark";
import type { ToolboxGroup } from "@/lib/site-content";

const MAX_DEPTH = 3;

/** The toolbox comes from the database (Personalize -> Toolbox in the admin area). */
export function ToolboxStack({ groups }: { groups: readonly ToolboxGroup[] }) {
  if (groups.length === 0) return <ToolboxEmpty />;
  return <ToolboxRail key={groups.map((g) => g.id).join("|")} groups={groups} />;
}

function ToolboxEmpty() {
  return (
    <section id="toolbox" className="tb tb-empty" aria-labelledby="tb-title">
      <div className="tb-pin">
        <JpMark tone="blue">道具</JpMark>
        <header className="tb-head">
          <span className="section-label" data-jp="道具">
            Chapter 06 / Toolbox
          </span>
          <h2 id="tb-title">THE TOOLBOX</h2>
          <p>Tools, systems, technologies and experiments arranged as a working technical stack.</p>
        </header>
        <p className="section-empty">The stack is being assembled.</p>
      </div>
    </section>
  );
}

function ToolboxRail({ groups }: { groups: readonly ToolboxGroup[] }) {
  const sectionRef = React.useRef<HTMLElement>(null);
  const stackRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLElement | null)[]>([]);

  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    let target = 0;
    let current = 0;
    let stackH = 300;

    let inView = false;
    const measure = () => {
      stackH = stackRef.current?.offsetHeight ?? 300;
    };

    const readTarget = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const span = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -rect.top / span));
      const raw = progress * (groups.length - 1);
      const base = Math.floor(raw);
      const hold = Math.max(0, Math.min(1, (raw - base - 0.3) / 0.4));
      target = base + hold * hold * (3 - 2 * hold);
    };

    const apply = (position: number) => {
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const d = index - position;
        let y = 0;
        let scale = 1;
        let blur = 0;
        let bright = 1;
        let opacity = 1;
        if (d > 0) {
          y = Math.min(d, 1.2) * (stackH + 28);
        } else if (d < 0) {
          const depth = Math.min(-d, MAX_DEPTH);
          y = -depth * 28;
          scale = 1 - depth * 0.035;
          blur = depth * 1.0;
          bright = 1 - depth * 0.04;
          opacity = Math.max(0.55, 1 - depth * 0.16);
        }
        card.style.setProperty("--stack-y", `${y.toFixed(2)}px`);
        card.style.setProperty("--stack-scale", scale.toFixed(4));
        card.style.setProperty("--stack-blur", `${blur.toFixed(2)}px`);
        card.style.setProperty("--stack-bright", bright.toFixed(3));
        card.style.setProperty("--stack-opacity", opacity.toFixed(3));
        card.classList.toggle("is-current", Math.abs(d) < 0.5);
        card.classList.toggle("is-behind", d < -0.02);
      });
    };

    const tick = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      current += (target - current) * (1 - Math.exp(-dt / 130));
      if (Math.abs(target - current) < 0.0005) current = target;
      apply(current);
      if (current !== target) raf = requestAnimationFrame(tick);
      else last = 0;
    };

    const update = () => {
      if (!inView) return;
      readTarget();
      if (reduced) {
        current = target;
        apply(current);
        return;
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = !!entry?.isIntersecting;
        if (inView) {
          measure();
          readTarget();
          current = target;
          apply(current);
        }
      },
      { rootMargin: "50% 0px" },
    );
    if (sectionRef.current) io.observe(sectionRef.current);
    const ro = new ResizeObserver(() => {
      measure();
      update();
    });
    if (stackRef.current) ro.observe(stackRef.current);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
    };
  }, [groups]);

  return (
    <section id="toolbox" className="tb" ref={sectionRef} aria-labelledby="tb-title">
      <div className="tb-pin">
        <JpMark tone="blue">道具</JpMark>
        <header className="tb-head">
          <span className="section-label" data-jp="道具">
            Chapter 06 / Toolbox
          </span>
          <h2 id="tb-title">THE TOOLBOX</h2>
          <p>Tools, systems, technologies and experiments arranged as a working technical stack.</p>
        </header>
        <div className="tb-stack" ref={stackRef}>
          {groups.map((group, index) => (
            <article
              key={group.id}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              className="tb-card"
            >
              {group.jp ? (
                <span className="jp tb-jp" aria-hidden="true">
                  {group.jp}
                </span>
              ) : null}
              <span className="mono tb-n">
                {String(index + 1).padStart(2, "0")} / {String(groups.length).padStart(2, "0")}
              </span>
              <h3>{group.title}</h3>
              <div className="tb-tools">
                {group.tools.map((tool, toolIndex) => (
                  <span key={tool}>
                    <i className="mono">{String(toolIndex + 1).padStart(2, "0")}</i>
                    {tool}
                  </span>
                ))}
              </div>
              <span className="mono tb-status">SYSTEM / READY</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
