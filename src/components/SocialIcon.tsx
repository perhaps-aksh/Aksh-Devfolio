import { SOCIAL_ICON_PATHS, type SocialIconName } from "@/lib/social-icon-paths";

/** Decorative brand glyph — always pair it with a text label or an `aria-label` on the link. */
export function SocialIcon({
  name,
  size = 16,
  className,
}: {
  name: SocialIconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={SOCIAL_ICON_PATHS[name]} />
    </svg>
  );
}
