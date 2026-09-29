import * as React from "react";

import { JpMark } from "@/components/JpMark";
import { ServiceGlyph } from "@/components/ServiceGlyph";
import type { ServiceItem } from "@/lib/site-content";

/** "What I can build" — cards come from the database (Personalize -> What I build in the admin area). */
export function ServiceBounce({ services }: { services: readonly ServiceItem[] }) {
  const [active, setActive] = React.useState<number | null>(null);
  const [coarse, setCoarse] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".sb-card")) setActive(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  return (
    <section id="services" className="sb section" aria-labelledby="sb-title">
      <JpMark tone="red">制作</JpMark>
      <div className="sb-copy">
        <span className="section-label" data-jp="制作">
          Chapter 03 / Services
        </span>
        <h2 id="sb-title">
          WHAT I<br />
          CAN BUILD.
        </h2>
        <p>I design, develop and experiment with digital experiences that feel different.</p>
        {services.length ? (
          <span className="mono sb-hint">
            {coarse ? "TAP A CARD TO FOCUS" : "HOVER A CARD TO FOCUS"}
          </span>
        ) : null}
      </div>
      {services.length === 0 ? (
        <p className="section-empty">More capabilities are on the way.</p>
      ) : (
        <div className={`sb-stage ${active !== null ? "has-active" : ""}`}>
          {services.map((service, index) => {
            const focused = active === index;
            return (
              <article
                key={service.id}
                className={`sb-card ${focused ? "is-active" : ""}`}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setActive(index);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === "mouse") setActive(null);
                }}
              >
                <button
                  type="button"
                  className="sb-hit"
                  aria-pressed={focused}
                  aria-label={`Focus ${service.title}`}
                  onClick={() => setActive(focused ? null : index)}
                  onFocus={(event) => {
                    if (event.currentTarget.matches(":focus-visible")) setActive(index);
                  }}
                />
                <div className="sb-top">
                  <ServiceGlyph kind={service.kind} className="sb-glyph" />
                  <span className="mono sb-number">{String(index + 1).padStart(2, "0")}</span>
                </div>
                {service.jp ? (
                  <span className="jp sb-jp" aria-hidden="true">
                    {service.jp}
                  </span>
                ) : null}
                <h3>{service.title}</h3>
                <p className="sb-tag">{service.tagline}</p>
                {service.capabilities.length ? (
                  <ul className="mono sb-caps">
                    {service.capabilities.map((cap) => (
                      <li key={cap}>{cap}</li>
                    ))}
                  </ul>
                ) : null}
                <a href="#contact" className="mono sb-cta">
                  START A PROJECT ↗
                </a>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
