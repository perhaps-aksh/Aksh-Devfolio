import * as React from "react";

import { useHydrated } from "@/hooks/use-hydrated";
import ghostCharacter from "@/assets/hero-character-480.webp";
import eyeBlink from "@/assets/eye-blink-400.webp";

type Props = { onDone: () => void };

const LETTERS = [
  { char: "A", x: "-24vw", y: "-20vh", r: "-9deg", s: 0.72 },
  { char: "K", x: "22vw", y: "-26vh", r: "7deg", s: 0.84 },
  { char: "S", x: "-20vw", y: "22vh", r: "6deg", s: 0.66 },
  { char: "H", x: "24vw", y: "18vh", r: "-8deg", s: 0.9 },
];

/** Intro length multiplier: 1 = the original ~4.1s cinematic, lower = faster hand-off to the page. */
const INTRO_SPEED = 0.42;

export function Preloader({ onDone }: Props) {
  const hydrated = useHydrated();
  const [stage, setStage] = React.useState(0);
  const [gone, setGone] = React.useState(false);

  React.useEffect(() => {
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 720;

    // stage marks: 1 ambient, 2 eye, 3 eye open, 4 char fade / fragments,
    // 5 letters scattered, 6 assembled, 7 supporting, 8 ready, 9 handoff
    const full = [300, 500, 1000, 1800, 2050, 2350, 2950, 3250, 3600, 4100];
    const quick = [120, 200, 380, 700, 850, 1000, 1250, 1450, 1650, 1950];
    const marks = reduced ? quick : full.map((t) => t * (small ? INTRO_SPEED * 0.85 : INTRO_SPEED));

    const timers = marks.map((t, i) =>
      window.setTimeout(() => {
        if (i === marks.length - 1) {
          document.documentElement.classList.remove("pre-lock");
          setGone(true);
          onDone();
        } else {
          setStage(i + 1);
        }
      }, t),
    );


    document.documentElement.classList.add("pre-lock");
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      document.documentElement.classList.remove("pre-lock");
    };
  }, [onDone]);

  if (gone) return null;

  return (
    <div
      className={`pre pre-s${stage}`}
      role="presentation"
      aria-hidden="true"
      data-stage={stage}
    >
      <div className="pre-ambient">
        <span className="pre-light pre-light-blue" />
        <span className="pre-light pre-light-violet" />
        <span className="pre-light pre-light-red" />
      </div>
      <div className="pre-grain" />

      <img src={ghostCharacter} alt="" className="pre-char" width={480} height={752} decoding="async" />

      <div className="pre-eye">
        <img src={hydrated ? eyeBlink : undefined} alt="" className="pre-eye-gif" width={400} height={332} decoding="async" />

        <span className="pre-ring pre-ring-a" />
        <span className="pre-ring pre-ring-b" />
        <span className="pre-tick pre-tick-x" />
        <span className="pre-tick pre-tick-y" />
        <span className="pre-eye-note mono">CHAPTER 01 — INITIALIZING</span>
        <span className="pre-eye-note pre-eye-note-b mono">
          WAKE / OBSERVE / CREATE
        </span>
        <span className="pre-eye-note pre-eye-note-jp jp">第一章 ・ 起動</span>
        <span className="pre-eye-note pre-eye-note-c jp">目覚め ・ 観察 ・ 創造</span>
      </div>

      <div className="pre-word">
        {LETTERS.map((l, i) => (
          <span
            key={l.char}
            className="pre-letter"
            style={
              {
                "--lx": l.x,
                "--ly": l.y,
                "--lr": l.r,
                "--ls": String(l.s),
                "--ld": `${i * 110}ms`,
              } as React.CSSProperties
            }
          >
            <i className="pre-letter-ghost">{l.char}</i>
            {l.char}
          </span>
        ))}
      </div>

      <span className="pre-rule" />
      <span className="pre-sub mono">MAVERICK — CREATIVE / DEVELOPER</span>
      <span className="pre-status mono">
        <i /> SYSTEM READY
      </span>
      <span className="pre-corner pre-corner-tl mono">AKSH.OS / V.01</span>
      <span className="pre-corner pre-corner-br mono">X 28.6139 / Y 77.2090</span>
    </div>
  );
}
