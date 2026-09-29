import type { SocialIconName } from "@/lib/social-icon-paths";

export type SocialLink = {
  /** Also the icon key in `social-icon-paths.ts`. */
  id: SocialIconName;
  label: string;
  href: string;
  handle: string;
  /** Shown in the compact icon row in the hero (keep this list short). */
  hero?: boolean;
};

/**
 * Single source of truth for every social / profile link on the site
 * (hero, menu, contact section, footer, article pages).
 * Add, remove or reorder entries here — nothing else needs to change.
 */
export const socials: readonly SocialLink[] = [
  {
    id: "github",
    label: "GitHub",
    handle: "perhaps-aksh",
    href: "https://github.com/perhaps-aksh",
    hero: true,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    handle: "perhaps-aksh",
    href: "https://www.linkedin.com/in/perhaps-aksh",
    hero: true,
  },
  {
    id: "x",
    label: "X",
    handle: "@Chitraksh_kumar",
    href: "https://x.com/Chitraksh_kumar",
    hero: true,
  },
  {
    id: "instagram",
    label: "Instagram",
    handle: "aksh._.me",
    href: "https://www.instagram.com/aksh._.me/",
    hero: true,
  },
  {
    id: "discord",
    label: "Discord",
    handle: "1108415513333342308",
    href: "https://discord.com/users/1108415513333342308",
    hero: true,
  },
  {
    id: "youtube",
    label: "YouTube",
    handle: "@perhaps-aksh",
    href: "https://www.youtube.com/@perhaps-aksh",
    hero: true,
  },
  {
    id: "tryhackme",
    label: "TryHackMe",
    handle: "thakurchitrakshkumar",
    href: "https://tryhackme.com/p/thakurchitrakshkumar",
  },
  {
    id: "hackerone",
    label: "HackerOne",
    handle: "perhaps-aksh",
    href: "https://hackerone.com/perhaps-aksh",
  },
  {
    id: "bugcrowd",
    label: "Bugcrowd",
    handle: "perhaps-aksh",
    href: "https://bugcrowd.com/h/perhaps-aksh",
  },
  {
    id: "leetcode",
    label: "LeetCode",
    handle: "qkwUPgXMGj",
    href: "https://leetcode.com/u/qkwUPgXMGj/",
  },
  {
    id: "gitlab",
    label: "GitLab",
    handle: "thakurchitrakshkumar",
    href: "https://gitlab.com/thakurchitrakshkumar",
  },
  {
    id: "reddit",
    label: "Reddit",
    handle: "u/aksh-me",
    href: "https://www.reddit.com/user/aksh-me/",
  },
  {
    id: "orcid",
    label: "ORCID",
    handle: "0009-0008-6163-4898",
    href: "https://orcid.org/0009-0008-6163-4898",
  },
];

export const heroSocials = socials.filter((s) => s.hero);

/** Attributes for every outbound profile link. */
export const externalLinkProps = { target: "_blank", rel: "noopener noreferrer" } as const;
