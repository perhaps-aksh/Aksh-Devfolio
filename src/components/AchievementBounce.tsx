import * as React from "react";

import { JpMark } from "@/components/JpMark";
import type { AchievementItem } from "@/lib/site-content";

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

/**
 * Fan positions for N cards, generated instead of hand-placed: a gentle arc across the row (the
 * original 4-card layout was hand-tuned to the same shape). Works for any count; visually best at
 * 3-6, and still functions — just denser — beyond that.
 */
function fanVars(index: number, count: number, active: number | null): Vars {
  const t = count > 1 ? index / (count - 1) - 0.5 : 0;
  const spread = count <= 4 ? 230 : Math.max(150, 900 / count);
  const base = { x: t * spread * 2, y: Math.sin(t * Math.PI) * -18, r: t * -13 };
  if (active === null) {
    return {
      "--x": `${base.x}px`,
      "--y": `${base.y}px`,
      "--r": `${base.r}deg`,
      "--s": 1,
      "--o": 1,
      "--f": "blur(0px) brightness(1)",
      "--z": count - index,
    };
  }
  if (active === index) {
    return {
      "--x": "0px",
      "--y": "0px",
      "--r": "0deg",
      "--s": 1.08,
      "--o": 1,
      "--f": "blur(0px) brightness(1)",
      "--z": 20,
    };
  }
  const push = Math.sign(index - active) * (spread / 3);
  return {
    "--x": `${base.x + push}px`,
    "--y": `${base.y}px`,
    "--r": `${base.r}deg`,
    "--s": 0.9,
    "--o": 0.3,
    "--f": "blur(1.4px) brightness(0.5)",
    "--z": count - Math.abs(index - active),
  };
}

function AchievementMedia({ item }: { item: AchievementItem }) {
  if (!item.media_url) return null;
  return (
    <div className="ab-media">
      {item.media_kind === "video" ? (
        <video src={item.media_url} muted playsInline loop preload="metadata" />
      ) : (
        <img src={item.media_url} alt="" loading="lazy" />
      )}
    </div>
  );
}

/** Achievements come from the database (Personalize -> Achievements in the admin area). */
export function AchievementBounce({ items }: { items: readonly AchievementItem[] }) {
  const [active, setActive] = React.useState<number | null>(null);

  React.useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement | null)?.closest(".ab-card")) setActive(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <section id="achievements" className="ab section" aria-labelledby="ab-title">
      <JpMark tone="blue">実績</JpMark>
      <header className="ab-head">
        <span className="section-label" data-jp="実績">
          Chapter 07 / Achievements
        </span>
        <h2 id="ab-title">ACHIEVEMENTS</h2>
        <p>Signals from the work so far — part record, part unfinished archive.</p>
      </header>
      {items.length === 0 ? (
        <p className="section-empty">The archive is still being filled.</p>
      ) : (
        <div
          className={`ab-stage ${active !== null ? "has-active" : ""}`}
          style={{ ["--ab-n" as string]: items.length }}
        >
          {items.map((item, index) => {
            const focused = active === index;
            return (
              <article
                key={item.id}
                className={`ab-card ${focused ? "is-active" : ""}`}
                style={fanVars(index, items.length, active)}
              >
                <button
                  type="button"
                  className="ab-hit"
                  aria-expanded={focused}
                  aria-label={`${item.title} — ${focused ? "close" : "show"} details`}
                  onClick={() => setActive(focused ? null : index)}
                  onFocus={(event) => {
                    if (event.currentTarget.matches(":focus-visible")) setActive(index);
                  }}
                />
                <span className="mono ab-n">{String(index + 1).padStart(2, "0")} / ARCHIVE</span>
                {item.jp ? (
                  <span className="jp ab-jp" aria-hidden="true">
                    {item.jp}
                  </span>
                ) : null}
                {item.value ? <strong className="ab-value">{item.value}</strong> : null}
                <h3>{item.title}</h3>
                <AchievementMedia item={item} />
                <div className="ab-detail">
                  <div>
                    <span className="mono">
                      {item.year}
                      {item.year && item.organization ? <br /> : null}
                      {item.organization}
                    </span>
                    {item.detail ? <p>{item.detail}</p> : null}
                  </div>
                </div>
              </article>
            );
          })}
          {/* Static hover zones: they never move, so the animated cards cannot slide out from under the pointer. */}
          <div
            className="ab-slots"
            aria-hidden="true"
            style={{ ["--ab-n" as string]: items.length }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setActive(null);
            }}
          >
            {items.map((item, index) => (
              <span
                key={item.id}
                className="ab-slot"
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setActive(index);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
