import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";

import * as React from "react";

import { JourneyTrain } from "@/components/JourneyTrain";
import { ServiceBounce } from "@/components/ServiceBounce";
import { ToolboxStack } from "@/components/ToolboxStack";
import { initSmoothScroll, setScrollLocked, smoothScrollTo } from "@/lib/smooth-scroll";
import { AchievementBounce } from "@/components/AchievementBounce";
import { ContactForm } from "@/components/ContactForm";
import { FlowingBlog } from "@/components/FlowingBlog";
import { getHomeContentFn } from "@/lib/content.functions";
import { WorkArchive } from "@/components/WorkArchive";
import { WritingsFlow } from "@/components/WritingsFlow";
import heroCharacter from "@/assets/hero-character-816.webp";
import wordmark640 from "@/assets/aksh-wordmark-640.webp";
import wordmark800 from "@/assets/aksh-wordmark-800.webp";
import wordmark1200 from "@/assets/aksh-wordmark-1200.webp";
import { JpMark } from "@/components/JpMark";
import { Preloader } from "@/components/Preloader";
import { useInView } from "@/hooks/use-in-view";
import { useHydrated } from "@/hooks/use-hydrated";
import { SocialIcon } from "@/components/SocialIcon";
import { externalLinkProps, heroSocials, socials } from "@/lib/socials";
import type { ExploringItem, FaqItem, IdentityItem, SiteProfile } from "@/lib/site-content";

export const Route = createFileRoute("/")({
  // Projects, posts, writings and every editable section (about, journey, services, achievements,
  // toolbox, exploring, FAQ) come from Supabase; each degrades to empty/default independently if
  // unreachable, so the page never breaks — see src/server/content.server.ts.
  loader: () => getHomeContentFn(),
  staleTime: 60_000,
  head: ({ loaderData }) => {
    const siteUrl = loaderData?.siteUrl ?? "";
    const title = "Chitraksh Kumar (AKSH) — Creative Developer & Cybersecurity Researcher";
    const description =
      "Chitraksh Kumar, known online as AKSH, is a creative developer and cybersecurity researcher in India building expressive, secure digital experiences.";
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Chitraksh Kumar",
      alternateName: "AKSH",
      url: siteUrl || undefined,
      jobTitle: "Creative Developer & Cybersecurity Researcher",
      description,
      sameAs: socials.map((s) => s.href),
    };
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "What if, is where I begin. Creative development and security research by AKSH.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(jsonLd).replace(/</g, "\\u003c") },
      ],
    };
  },
  component: Index,
});

const chapters = [
  ["01", "HERO", "#hero"],
  ["02", "ABOUT / WHO IS AKSH", "#about"],
  ["03", "JOURNEY", "#journey"],
  ["04", "WHAT I DO", "#services"],
  ["05", "SELECTED PROJECTS", "#projects"],
  ["06", "ACHIEVEMENTS", "#achievements"],
  ["07", "THE TOOLBOX", "#toolbox"],
  ["08", "CURRENTLY EXPLORING", "#exploring"],
  ["09", "BLOG / THOUGHTS", "#blog"],
  ["", "FAQ", "#faq"],
  ["10", "CONTACT", "#contact"],
] as const;

const KANJI_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一"] as const;

const menuNotes: Record<string, string> = {
  "#hero": "ENTRY POINT",
  "#about": "THE CHARACTER",
  "#journey": "TIMELINE",
  "#services": "CAPABILITIES",
  "#projects": "SELECTED WORK",
  "#achievements": "SIGNALS",
  "#toolbox": "STACK",
  "#exploring": "IN PROGRESS",
  "#blog": "WRITING",
  "#faq": "QUERIES",
  "#contact": "OPEN CHANNEL",
};

const CinematicFooter = React.lazy(() =>
  import("@/components/ui/motion-footer").then((m) => ({ default: m.CinematicFooter })),
);

/**
 * The footer is not part of the server HTML: SSR and the first client render emit only a same-height
 * placeholder (no layout shift), and the real footer mounts after the intro, when the browser is idle.
 * This keeps its markup, JS and CSS off the critical path.
 */
function FooterSlot({ ready, email }: { ready: boolean; email: string }) {
  const [mount, setMount] = React.useState(false);
  React.useEffect(() => {
    if (!ready) return;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setMount(true), { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setMount(true), 800);
    return () => window.clearTimeout(id);
  }, [ready]);

  const placeholder = <div className="cf" aria-hidden="true" />;
  if (!mount) return placeholder;
  return (
    <React.Suspense fallback={placeholder}>
      <CinematicFooter
        email={email}
        socials={footerSocials}
        onStartProject={() => scrollToSection("#contact")}
      />
    </React.Suspense>
  );
}

const footerSocials = socials.map(({ id, label, href }) => ({ label, href, icon: id }));

function Crosshair({ className = "" }: { className?: string }) {
  return (
    <span className={`crosshair ${className}`} aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

function SectionLabel({ children, jp }: { children: React.ReactNode; jp?: string }) {
  return (
    <span className="section-label" data-jp={jp}>
      {children}
    </span>
  );
}

function StatusChip({
  label = "SECURE",
  tone = "blue",
}: {
  label?: string;
  tone?: "blue" | "alert";
}) {
  return (
    <span className={`status-chip ${tone}`} aria-hidden="true">
      <i />
      {label}
    </span>
  );
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const delayClass =
    delay === 1
      ? "reveal-delay-1"
      : delay === 2
        ? "reveal-delay-2"
        : delay === 3
          ? "reveal-delay-3"
          : delay === 4
            ? "reveal-delay-4"
            : "";
  return (
    <div ref={ref} className={`reveal ${delayClass} ${className} ${inView ? "in-view" : ""}`}>
      {children}
    </div>
  );
}

function scrollToSection(href: string) {
  const el = document.getElementById(href.slice(1));
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
  const go = (duration: number) => {
    if (!smoothScrollTo(el, duration)) el.scrollIntoView({ behavior, block: "start" });
  };
  go(1.8);
  history.replaceState(null, "", href);

  // Reveal animations change page height mid-scroll; re-align once settled.
  [1900, 2800].forEach((delay) =>
    window.setTimeout(() => {
      const offset = el.getBoundingClientRect().top;
      if (Math.abs(offset) > 8) go(0.8);
    }, delay),
  );
}

function Topbar({ activeSection }: { activeSection: string }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (!menuOpen) {
      setMounted(false);
      return;
    }
    const raf = requestAnimationFrame(() => setMounted(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setScrollLocked(true);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      setScrollLocked(false);
    };
  }, [menuOpen]);

  const go = (href: string) => {
    setMenuOpen(false);
    window.setTimeout(() => scrollToSection(href), 380);
  };

  return (
    <>
      <header className="topbar">
        <a
          href="#hero"
          className="brand-mark"
          aria-label="AKSH home"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection("#hero");
          }}
        >
          AKSH
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <a
            href="#projects"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection("#projects");
            }}
          >
            WORKS <span>01</span>
          </a>
          <a
            href="#services"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection("#services");
            }}
          >
            SERVICES <span>02</span>
          </a>
          <Link to="/writings">
            WRITINGS <span>03</span>
          </Link>
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection("#contact");
            }}
          >
            CONTACT <span>04</span>
          </a>
        </nav>
        <button
          className="menu-link"
          aria-label="Open chapter menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <span>MENU</span>
          <Menu size={20} strokeWidth={1.4} />
        </button>
      </header>

      {menuOpen && (
        <div
          className={`nav-overlay ${mounted ? "is-open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
        >
          <div className="nav-overlay-head">
            <div className="nav-overlay-brand">
              <span className="nav-overlay-word">AKSH</span>
              <span className="mono nav-overlay-sub">MENU / 01</span>
            </div>
            <button
              className="nav-overlay-close"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <X size={26} strokeWidth={1.2} />
            </button>
          </div>

          <div className="nav-overlay-art" aria-hidden="true">
            <span className="nav-overlay-art-glow" />
            <img
              src={heroCharacter}
              alt=""
              width={816}
              height={1278}
              loading="lazy"
              decoding="async"
            />
          </div>

          <span className="mono nav-overlay-tag nav-overlay-tag-left">NAVIGATION / SYSTEM</span>

          <nav className="nav-overlay-list" aria-label="Sections">
            <span className="nav-overlay-line" aria-hidden="true" />
            <Link
              to="/writings"
              className="nav-overlay-item"
              style={{ ["--i" as string]: -1 }}
              onClick={() => setMenuOpen(false)}
            >
              <span className="mono nav-overlay-num">—</span>
              <span className="nav-overlay-title">WRITINGS</span>
              <span className="mono nav-overlay-desc">POEMS &amp; THOUGHTS</span>
              <span className="nav-overlay-mark" aria-hidden="true">
                <i />
                <ArrowRight size={16} strokeWidth={1.4} />
              </span>
            </Link>
            {chapters.map(([number, title, href], index) => {
              const active = activeSection === href.slice(1);
              return (
                <button
                  key={title}
                  type="button"
                  className={`nav-overlay-item ${active ? "active" : ""}`}
                  style={{ ["--i" as string]: index }}
                  onClick={() => go(href)}
                >
                  <span className="mono nav-overlay-num">{number || "—"}</span>
                  <span className="nav-overlay-title">{title}</span>
                  <span className="mono nav-overlay-desc">{menuNotes[href] ?? ""}</span>
                  <span className="nav-overlay-mark" aria-hidden="true">
                    <i />
                    <ArrowRight size={16} strokeWidth={1.4} />
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="nav-overlay-foot mono">
            <span className="nav-overlay-session">
              <i /> SESSION ACTIVE
            </span>
            <span className="nav-overlay-socials">
              {socials.map(({ id, label, href }) => (
                <a key={id} href={href} {...externalLinkProps} aria-label={label} title={label}>
                  <SocialIcon name={id} size={15} />
                </a>
              ))}
            </span>
            <span>AKSH.OS / V.01</span>
          </div>
        </div>
      )}
    </>
  );
}

function ChapterNav({ activeSection }: { activeSection: string }) {
  const index = Math.max(
    0,
    chapters.findIndex(([, , href]) => href.slice(1) === activeSection),
  );
  const [number, title, href] = chapters[index] ?? chapters[0];
  const kanji = KANJI_NUM[index] ?? "";
  const progress = ((index + 1) / chapters.length) * 100;

  return (
    <nav id="chapters" className="chapter-nav mono" aria-label="Section progress">
      <span className="chapter-track" aria-hidden="true">
        <span className="chapter-track-fill" style={{ height: `${progress}%` }} />
      </span>
      <a
        className="chapter-current"
        href={href}
        key={href}
        onClick={(e) => {
          e.preventDefault();
          scrollToSection(href);
        }}
      >
        <span className="chapter-num">
          {number || "—"}
          <b className="chapter-jp jp" aria-hidden="true">
            {kanji}
          </b>
        </span>
        <strong>{title}</strong>
      </a>
      <span className="chapter-count" aria-hidden="true">
        {index + 1} / {chapters.length}
      </span>
    </nav>
  );
}

function useHeroParallax<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 900px)").matches) return;
    let frame = 0;
    let tx = 0;
    let ty = 0;
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          el.style.setProperty("--mx", tx.toFixed(3));
          el.style.setProperty("--my", ty.toFixed(3));
        });
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);
  return ref;
}

function Hero({ start = true }: { start?: boolean }) {
  const stageRef = useHeroParallax<HTMLElement>();
  const hydrated = useHydrated();
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (!start) return;
    const t = window.setTimeout(() => setLoaded(true), 60);
    return () => window.clearTimeout(t);
  }, [start]);

  return (
    <section
      id="hero"
      className={`hero-stage ${loaded ? "hero-loaded" : ""}`}
      ref={stageRef as React.RefObject<HTMLElement>}
    >
      <div className="scan-line" aria-hidden="true" />

      <h1 className="sr-only">
        Chitraksh Kumar (AKSH) — Creative Developer &amp; Cybersecurity Researcher
      </h1>

      <div className="coordinate mono hero-ui">
        <Crosshair />
        <span>
          X: 28.6139
          <br />
          Y: 77.2090
        </span>
      </div>

      <div className="system mono hero-ui">
        <span>AKSH.OS / V.01</span>
        <span className="online">
          <i /> SYSTEM ONLINE
        </span>
        <span className="encrypted">
          <i /> ENCRYPTED
        </span>
      </div>

      <div className="wordmark-wrap" aria-hidden="true">
        <img
          src={hydrated ? wordmark800 : undefined}
          srcSet={
            hydrated ? `${wordmark640} 640w, ${wordmark800} 800w, ${wordmark1200} 1200w` : undefined
          }
          sizes="(max-width: 768px) 340px, 720px"
          alt="AKSH"
          className="wordmark-image"
          width={1200}
          height={600}
          decoding="async"
          fetchPriority="low"
        />
      </div>

      <div className="technical-orbit" aria-hidden="true">
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <span className="axis axis-x" />
        <span className="axis axis-y" />
        <Crosshair className="orbit-cross" />
      </div>

      <div className="hero-char-layer" aria-hidden="true">
        <span className="hero-char-glow" />
      </div>

      <img
        src={hydrated ? heroCharacter : undefined}
        alt="Monochrome manga swordsman in a hooded jacket"
        className="hero-character"
        width={816}
        height={1278}
        decoding="async"
        fetchPriority="low"
      />

      <div className="identity-block mono">
        <div className="label-row">
          <strong>CHARACTER</strong>
          <span />
        </div>
        <p>
          MAVERICK /
          <br />
          CREATIVE DEVELOPER
        </p>
        <blockquote>
          What if, is where
          <br />I begin.
        </blockquote>
      </div>

      <div className="dossier mono">
        <div className="dossier-head">
          <span>
            <strong>01</strong> / AKSH
          </span>
          <Crosshair />
        </div>
        <dl>
          <div>
            <dt>STATUS</dt>
            <dd>BUILDING</dd>
          </div>
          <div>
            <dt>ROLE</dt>
            <dd>CREATIVE DEV</dd>
          </div>
          <div>
            <dt>FOCUS</dt>
            <dd>SECURITY</dd>
          </div>
          <div>
            <dt>LOCATION</dt>
            <dd>INDIA</dd>
          </div>
        </dl>
        <div className="dossier-foot">
          <StatusChip label="AUTH: VERIFIED" />
        </div>
      </div>

      <div className="loop-mark mono" role="img" aria-label="Create, build, experiment">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <path id="loop" d="M 60,60 m -42,0 a 42,42 0 1,1 84,0 a 42,42 0 1,1 -84,0" />
          </defs>
          <text>
            <textPath href="#loop">CREATE • BUILD • EXPERIMENT • </textPath>
          </text>
        </svg>
        <Crosshair />
      </div>

      <span className="date mono">SEPTEMBER / 2026</span>

      <a href="#about" className="scroll-cue mono" aria-label="Scroll to about section">
        <span className="mouse">
          <i />
        </span>
        <span>SCROLL</span>
      </a>

      <div className="hero-jp hero-ui" aria-hidden="true">
        <span className="hero-jp-vert jp">創造 ・ 技術 ・ 物語</span>
        <span className="hero-jp-line jp">「もしも」から、はじまる。</span>
      </div>

      <div className="socials mono">
        <div className="label-row">
          <strong>SOCIALS</strong>
          <span />
        </div>
        <div>
          {heroSocials.map(({ id, label, href }) => (
            <a href={href} {...externalLinkProps} key={id} aria-label={label} title={label}>
              <SocialIcon name={id} size={15} />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function About({ profile, identity }: { profile: SiteProfile; identity: readonly IdentityItem[] }) {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section
      id="about"
      className={`section section-dark about-scene ${inView ? "about-in" : ""}`}
      ref={ref}
    >
      <span className="about-amber" aria-hidden="true" />

      <div className="about-layout">
        <div className="about-figure">
          <span className="about-frame about-frame-a" aria-hidden="true" />
          <span className="about-frame about-frame-b" aria-hidden="true" />
          <span className="about-guide about-guide-x" aria-hidden="true" />
          <span className="about-guide about-guide-y" aria-hidden="true" />
          <span className="about-kanji" aria-hidden="true">
            創造
          </span>
          <span className="mono about-figure-tag" aria-hidden="true">
            FIG. 02 / CHARACTER STUDY
          </span>
          <img
            src={heroCharacter}
            alt="Monochrome manga portrait of AKSH"
            className="about-figure-img"
            width={816}
            height={1278}
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="about-copy">
          <span className="mono about-kicker">WHO IS AKSH?</span>
          <h2 className="about-heading">
            ABOUT
            <span className="about-heading-ghost" aria-hidden="true">
              ABOUT
            </span>
          </h2>
          <p className="about-lead">{profile.about_lead}</p>
          <p className="about-body">{profile.about_body}</p>
          {profile.signature ? (
            <span className="about-signature" aria-label={`${profile.signature} signature`}>
              {profile.signature}
              {profile.hanko ? (
                <i className="hanko jp" aria-hidden="true">
                  {profile.hanko}
                </i>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>

      {identity.length ? (
        <div className="about-identity">
          {identity.map((item, i) => (
            <div className="about-identity-item" key={item.id} style={{ ["--i" as string]: i }}>
              <span className="mono about-identity-num">{String(i + 1).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
              <span className="about-identity-note">{item.note}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Exploring({ items }: { items: readonly ExploringItem[] }) {
  return (
    <section id="exploring" className="section section-dark section-grid">
      <JpMark tone="blue">探求</JpMark>
      <div className="section-header">
        <Reveal>
          <SectionLabel jp="探求">Chapter 08 — Currently Exploring</SectionLabel>
        </Reveal>
        <Reveal delay={1}>
          <h2 className="section-title">EXPLORING</h2>
        </Reveal>
        <Reveal delay={2}>
          <p className="section-subtitle">
            Interests and experiments that are shaping the next phase of my work.
          </p>
        </Reveal>
      </div>

      {items.length === 0 ? (
        <p className="section-empty">Nothing logged here yet.</p>
      ) : (
        <div className="exploring-list">
          {items.map((item, index) => (
            <Reveal key={item.id} delay={((index % 3) + 1) as 1 | 2 | 3}>
              <div className="exploring-card">
                <h3 className="exploring-title">{item.title}</h3>
                <p className="exploring-desc">{item.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

function Faq({ items }: { items: readonly FaqItem[] }) {
  const [open, setOpen] = React.useState<number | null>(null);

  return (
    <section id="faq" className="section section-dark section-grid">
      <JpMark tone="red">質問</JpMark>
      <div className="section-header">
        <Reveal>
          <div className="section-header-row">
            <SectionLabel jp="質問">09 / FAQ</SectionLabel>
            <StatusChip label="QUERY CHANNEL" />
          </div>
        </Reveal>
        <Reveal delay={1}>
          <h2 className="section-title">FAQ</h2>
        </Reveal>
        <Reveal delay={2}>
          <p className="section-subtitle">
            Common questions about the work, the interests, and how to start a conversation.
          </p>
        </Reveal>
      </div>

      {items.length === 0 ? (
        <p className="section-empty">Questions will show up here soon.</p>
      ) : (
        <div className="faq-list">
          {items.map((item, index) => {
            const isOpen = open === index;
            return (
              <Reveal key={item.id} delay={((index % 4) + 1) as 1 | 2 | 3 | 4}>
                <div className={`faq-item ${isOpen ? "open" : ""}`}>
                  <button
                    type="button"
                    className="faq-question"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${index}`}
                    id={`faq-button-${index}`}
                    onClick={() => setOpen(isOpen ? null : index)}
                  >
                    <span>{item.question}</span>
                    <span className="faq-icon" aria-hidden="true">
                      <i />
                      <i />
                    </span>
                  </button>
                  <div
                    className="faq-panel"
                    id={`faq-panel-${index}`}
                    role="region"
                    aria-labelledby={`faq-button-${index}`}
                  >
                    <div className="faq-panel-inner">
                      <p>{item.answer}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Contact({ profile }: { profile: SiteProfile }) {
  return (
    <section id="contact" className="section section-dark section-grid">
      <JpMark tone="red">連絡</JpMark>
      <div className="section-header">
        <Reveal>
          <div className="section-header-row">
            <SectionLabel jp="連絡">Chapter 10 — Contact</SectionLabel>
            <StatusChip label="CHANNEL OPEN" />
          </div>
        </Reveal>
        <Reveal delay={1}>
          <h2 className="section-title">GET IN TOUCH</h2>
        </Reveal>
        <Reveal delay={2}>
          <p className="section-subtitle">
            Have a project, idea, or collaboration in mind? Let’s build something memorable.
          </p>
        </Reveal>
      </div>

      <div className="contact-grid">
        <div>
          <Reveal delay={1}>
            <p className="contact-lead">{profile.contact_lead}</p>
          </Reveal>
          <Reveal delay={2}>
            <a href={`mailto:${profile.contact_email}`} className="contact-email">
              {profile.contact_email.toUpperCase()}
            </a>
          </Reveal>
          <Reveal delay={3}>
            <div className="contact-links">
              {socials.map(({ id, label, href }) => (
                <a key={id} href={href} {...externalLinkProps} aria-label={`${label} profile`}>
                  <SocialIcon name={id} size={15} />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={2}>
          <ContactForm />
        </Reveal>
      </div>
    </section>
  );
}

function Index() {
  const { projects, posts, writings, site } = Route.useLoaderData();
  const [activeSection, setActiveSection] = React.useState("hero");
  const [intro, setIntro] = React.useState(true);
  const handleIntroDone = React.useCallback(() => setIntro(false), []);

  React.useEffect(() => initSmoothScroll(), []);

  // Decorative star field: its CSS loads only after the intro, when the browser is idle.
  React.useEffect(() => {
    if (intro) return;
    const load = () => void import("@/styles-stars.css");
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(load, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(load, 600);
    return () => window.clearTimeout(id);
  }, [intro]);
  React.useEffect(() => {
    setScrollLocked(intro);
    return () => setScrollLocked(false);
  }, [intro]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const ids = chapters.map(([, , href]) => href.slice(1));
    let frame = 0;

    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 4;
      if (atBottom) {
        setActiveSection(ids[ids.length - 1] ?? "hero");
        return;
      }
      const line = window.innerHeight * 0.35;
      let current = ids[0] ?? "hero";
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      });
      setActiveSection(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <main className="hero-shell">
      {intro ? <Preloader onDone={handleIntroDone} /> : null}
      <div className="atmosphere" aria-hidden="true" />
      <div className="stars" aria-hidden="true">
        <i className="stars-a" />
        <i className="stars-b" />
        <i className="stars-c" />
      </div>
      <div className="grain" aria-hidden="true" />

      <Topbar activeSection={activeSection} />
      <ChapterNav activeSection={activeSection} />

      <Hero start={!intro} />
      <About profile={site.profile} identity={site.identity} />
      <JourneyTrain entries={site.journey} />
      <ServiceBounce services={site.services} />
      <WorkArchive projects={projects} />
      <ToolboxStack groups={site.toolbox} />
      <AchievementBounce items={site.achievements} />
      <Exploring items={site.exploring} />
      <FlowingBlog posts={posts} />
      <WritingsFlow writings={writings} />
      <Faq items={site.faqs} />
      <Contact profile={site.profile} />
      <FooterSlot ready={!intro} email={site.profile.contact_email} />
    </main>
  );
}
