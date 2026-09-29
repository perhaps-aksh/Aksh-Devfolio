import { Fragment } from "react";

import type { ServiceKind } from "@/lib/site-content";

type Props = { kind: ServiceKind; className?: string };

/** Subtle monochrome identity marks for each service. Pure SVG, no fills beyond faint strokes. */
export function ServiceGlyph({ kind, className }: Props) {
  const common = {
    viewBox: "0 0 120 120",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 0.8,
    className,
    "aria-hidden": true as const,
  };

  switch (kind) {
    case "design":
      return (
        <svg {...common}>
          <rect x="12" y="14" width="96" height="92" strokeDasharray="2 3" />
          {[30, 46, 62, 78, 94].map((y) => (
            <line key={y} x1="12" y1={y} x2="108" y2={y} opacity="0.5" />
          ))}
          <line x1="40" y1="14" x2="40" y2="106" opacity="0.6" />
          <line x1="80" y1="14" x2="80" y2="106" opacity="0.6" />
          <text
            x="46"
            y="60"
            fontSize="30"
            fontFamily="serif"
            stroke="none"
            fill="currentColor"
            opacity="0.7"
          >
            Aa
          </text>
          <rect
            x="16"
            y="86"
            width="20"
            height="4"
            fill="currentColor"
            opacity="0.5"
            stroke="none"
          />
        </svg>
      );
    case "dev":
      return (
        <svg {...common}>
          <rect x="10" y="18" width="100" height="84" />
          <line x1="10" y1="30" x2="110" y2="30" />
          <circle cx="17" cy="24" r="1.4" />
          <circle cx="23" cy="24" r="1.4" />
          <text
            x="18"
            y="50"
            fontSize="9"
            fontFamily="monospace"
            stroke="none"
            fill="currentColor"
            opacity="0.8"
          >
            {"$ build --secure"}
          </text>
          <text
            x="18"
            y="64"
            fontSize="9"
            fontFamily="monospace"
            stroke="none"
            fill="currentColor"
            opacity="0.5"
          >
            {"<Aksh render />"}
          </text>
          <text
            x="18"
            y="78"
            fontSize="9"
            fontFamily="monospace"
            stroke="none"
            fill="currentColor"
            opacity="0.5"
          >
            {"200 OK · 38ms"}
          </text>
          <rect
            x="18"
            y="86"
            width="5"
            height="9"
            fill="currentColor"
            stroke="none"
            opacity="0.7"
          />
        </svg>
      );
    case "creative":
      return (
        <svg {...common}>
          <text
            x="18"
            y="76"
            fontSize="54"
            fontWeight="900"
            fontFamily="sans-serif"
            stroke="currentColor"
            fill="none"
            transform="skewX(-14)"
            opacity="0.85"
          >
            創
          </text>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line
              key={i}
              x1={78 + i * 6}
              y1="10"
              x2={96 + i * 6}
              y2="60"
              opacity={0.6 - i * 0.08}
            />
          ))}
          <polyline points="8,96 30,84 44,104 66,88 86,106 112,90" opacity="0.6" />
          <polygon points="96,70 110,78 100,92" opacity="0.5" />
        </svg>
      );
    case "webgl":
      return (
        <svg {...common}>
          <g opacity="0.9">
            <polygon points="60,20 96,38 96,82 60,100 24,82 24,38" />
            <polyline points="24,38 60,56 96,38" />
            <line x1="60" y1="56" x2="60" y2="100" />
          </g>
          <ellipse cx="60" cy="60" rx="54" ry="18" opacity="0.4" />
          <ellipse cx="60" cy="60" rx="54" ry="18" transform="rotate(60 60 60)" opacity="0.3" />
          <circle cx="112" cy="54" r="1.6" fill="currentColor" stroke="none" />
          <line x1="60" y1="8" x2="60" y2="112" strokeDasharray="1 4" opacity="0.4" />
        </svg>
      );
    case "ux":
      return (
        <svg {...common}>
          <rect x="14" y="16" width="92" height="88" />
          <line x1="14" y1="30" x2="106" y2="30" />
          <rect x="20" y="40" width="34" height="22" />
          <rect x="60" y="40" width="40" height="8" opacity="0.6" />
          <rect x="60" y="54" width="28" height="8" opacity="0.4" />
          <rect
            x="20"
            y="72"
            width="30"
            height="10"
            fill="currentColor"
            stroke="none"
            opacity="0.6"
          />
          <line x1="20" y1="92" x2="100" y2="92" opacity="0.5" strokeDasharray="3 3" />
          <polygon
            points="74,66 88,80 80,80 76,88"
            fill="currentColor"
            stroke="none"
            opacity="0.8"
          />
        </svg>
      );
    case "ai":
      return (
        <svg {...common}>
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={i}
              x1="10"
              y1={14 + i * 8}
              x2="110"
              y2={14 + i * 8}
              opacity={0.18 + ((i * 7) % 5) * 0.06}
            />
          ))}
          {Array.from({ length: 22 }).map((_, i) => {
            const x = 14 + ((i * 41) % 92);
            const y = 16 + ((i * 29) % 88);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width="3"
                height="3"
                fill="currentColor"
                stroke="none"
                opacity={0.3 + ((i * 13) % 6) * 0.1}
              />
            );
          })}
          <path d="M20 88 C 36 60, 56 100, 72 66 S 100 44, 108 30" opacity="0.7" />
          <rect x="70" y="22" width="26" height="12" opacity="0.5" />
        </svg>
      );
    case "bug":
      return (
        <svg {...common}>
          <ellipse cx="60" cy="66" rx="26" ry="34" />
          <line x1="60" y1="34" x2="60" y2="98" opacity="0.5" />
          <path d="M44 44 L 24 28 M76 44 L 96 28 M40 66 L 14 66 M80 66 L 106 66 M44 88 L 24 104 M76 88 L 96 104" />
          <circle cx="52" cy="52" r="2.4" fill="currentColor" stroke="none" opacity="0.8" />
          <circle cx="68" cy="52" r="2.4" fill="currentColor" stroke="none" opacity="0.8" />
          <path d="M40 34 Q 60 18 80 34" opacity="0.6" />
        </svg>
      );
    case "scan":
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="46" />
          <circle cx="60" cy="60" r="30" opacity="0.5" />
          <circle cx="60" cy="60" r="14" opacity="0.35" />
          <line x1="60" y1="14" x2="60" y2="106" opacity="0.35" />
          <line x1="14" y1="60" x2="106" y2="60" opacity="0.35" />
          <path
            d="M60 60 L 60 16 A 44 44 0 0 1 98 38 Z"
            fill="currentColor"
            opacity="0.18"
            stroke="none"
          />
          <circle cx="60" cy="60" r="2.6" fill="currentColor" stroke="none" />
          <circle cx="78" cy="34" r="2" fill="currentColor" stroke="none" opacity="0.7" />
        </svg>
      );
    case "forensic":
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="30" />
          <line x1="71" y1="71" x2="102" y2="102" strokeWidth="2.2" />
          {[38, 44, 50, 56].map((r) => (
            <path
              key={r}
              d={`M${50 - r * 0.6} ${50 + r * 0.5} Q 50 ${50 - r} ${50 + r * 0.6} ${50 + r * 0.5}`}
              opacity="0.35"
            />
          ))}
          <circle cx="50" cy="50" r="4" fill="currentColor" stroke="none" opacity="0.6" />
        </svg>
      );
    case "shell":
      return (
        <svg {...common}>
          <rect x="10" y="18" width="100" height="84" />
          <line x1="10" y1="32" x2="110" y2="32" />
          <circle cx="18" cy="25" r="1.4" />
          <circle cx="24" cy="25" r="1.4" />
          <path d="M20 46 L 34 58 L 20 70" fill="none" strokeWidth="1.4" />
          <line x1="40" y1="70" x2="64" y2="70" strokeWidth="1.4" />
          <rect
            x="20"
            y="86"
            width="7"
            height="10"
            fill="currentColor"
            stroke="none"
            opacity="0.8"
          />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M60 14 L 100 28 V 60 C 100 84 84 100 60 108 C 36 100 20 84 20 60 V 28 Z" />
          <path d="M42 60 L 54 72 L 80 44" strokeWidth="2" />
        </svg>
      );
    case "freelance":
      return (
        <svg {...common}>
          <rect x="16" y="42" width="88" height="56" rx="2" />
          <path d="M42 42 V 30 a6 6 0 0 1 6-6 h24 a6 6 0 0 1 6 6 v12" />
          <line x1="16" y1="66" x2="104" y2="66" />
          <rect
            x="50"
            y="60"
            width="20"
            height="12"
            fill="currentColor"
            stroke="none"
            opacity="0.6"
          />
        </svg>
      );
    case "chip":
      return (
        <svg {...common}>
          <rect x="34" y="34" width="52" height="52" />
          <rect x="48" y="48" width="24" height="24" opacity="0.5" />
          {[18, 34, 50, 66, 82].map((p) => (
            <Fragment key={p}>
              <line x1={p} y1="10" x2={p} y2="34" opacity="0.6" />
              <line x1={p} y1="86" x2={p} y2="110" opacity="0.6" />
              <line x1="10" y1={p} x2="34" y2={p} opacity="0.6" />
              <line x1="86" y1={p} x2="110" y2={p} opacity="0.6" />
            </Fragment>
          ))}
        </svg>
      );
    case "hex":
      return (
        <svg {...common}>
          {["6f 65 21", "72 32 3a", "c0 00 01", "de ad be"].map((row, i) => (
            <text
              key={row}
              x="16"
              y={34 + i * 18}
              fontSize="11"
              fontFamily="monospace"
              stroke="none"
              fill="currentColor"
              opacity={0.75 - i * 0.12}
              letterSpacing="2"
            >
              {row}
            </text>
          ))}
          <line x1="16" y1="94" x2="104" y2="94" opacity="0.4" />
          <path d="M16 100 L 30 108 L 44 100" opacity="0.6" />
        </svg>
      );
    case "endpoint":
      return (
        <svg {...common}>
          <rect x="18" y="24" width="84" height="54" rx="2" />
          <line x1="18" y1="66" x2="102" y2="66" opacity="0.5" />
          <path d="M30 46 L 44 46 L 50 34 L 58 58 L 66 42 L 72 46 L 90 46" strokeWidth="1.4" />
          <rect
            x="46"
            y="86"
            width="28"
            height="6"
            fill="currentColor"
            stroke="none"
            opacity="0.6"
          />
          <line x1="38" y1="78" x2="38" y2="86" opacity="0.5" />
          <line x1="82" y1="78" x2="82" y2="86" opacity="0.5" />
        </svg>
      );
    case "research":
      return (
        <svg {...common}>
          <path d="M50 16 V 44 L 28 92 a8 8 0 0 0 8 12 h48 a8 8 0 0 0 8-12 L 70 44 V 16" />
          <line x1="42" y1="16" x2="58" y2="16" strokeWidth="2" />
          <line x1="34" y1="76" x2="86" y2="76" opacity="0.5" />
          {[
            [46, 82],
            [58, 88],
            [70, 84],
            [52, 92],
          ].map(([cx, cy]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r="2.2"
              fill="currentColor"
              stroke="none"
              opacity="0.7"
            />
          ))}
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="20" y="20" width="80" height="80" strokeDasharray="2 3" />
          <line x1="60" y1="30" x2="60" y2="90" opacity="0.4" />
          <line x1="30" y1="60" x2="90" y2="60" opacity="0.4" />
        </svg>
      );
  }
}
