type Props = {
  children: string;
  tone?: "red" | "blue" | "white";
  side?: "left" | "right";
};

/** Decorative vertical kanji watermark. Purely visual, hidden from assistive tech. */
export function JpMark({ children, tone = "red", side = "right" }: Props) {
  return (
    <span className={`jp-mark jp-mark-${tone} jp-mark-${side}`} aria-hidden="true">
      {children}
    </span>
  );
}
