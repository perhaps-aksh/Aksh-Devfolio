/**
 * The editable parts of the home page ("Personalize" in the admin area).
 *
 * One registry describes every list section — its table, fields, limits and labels — and is shared by
 * the admin forms (what to render) and the server (what to accept and how to clean it), so the two can
 * never drift apart. Adding a field is a change here plus a column in the migration.
 */

export type ServiceKind =
  | "design"
  | "dev"
  | "creative"
  | "webgl"
  | "ux"
  | "ai"
  | "bug"
  | "scan"
  | "forensic"
  | "shell"
  | "shield"
  | "freelance"
  | "chip"
  | "hex"
  | "endpoint"
  | "research";

/** Glyph choices for a service card, with the label shown in the admin dropdown. */
export const SERVICE_KINDS: readonly { value: ServiceKind; label: string }[] = [
  { value: "ux", label: "Interface (UI / UX)" },
  { value: "dev", label: "Terminal (development)" },
  { value: "design", label: "Grid (design)" },
  { value: "creative", label: "Brush stroke (creative)" },
  { value: "webgl", label: "Cube (3D)" },
  { value: "ai", label: "Signal (AI / generative)" },
  { value: "bug", label: "Bug (bug bounty)" },
  { value: "scan", label: "Radar (VAPT / scanning)" },
  { value: "forensic", label: "Magnifier (forensics)" },
  { value: "shell", label: "Shell prompt (pentesting)" },
  { value: "shield", label: "Shield (defence)" },
  { value: "freelance", label: "Briefcase (freelancing)" },
  { value: "chip", label: "Chip (hardware)" },
  { value: "hex", label: "Hex dump (reverse engineering)" },
  { value: "endpoint", label: "Endpoint (device security)" },
  { value: "research", label: "Flask (research)" },
];

export const isServiceKind = (value: unknown): value is ServiceKind =>
  SERVICE_KINDS.some((kind) => kind.value === value);

// --- public shapes ---------------------------------------------------------------------------------------

export type SiteProfile = {
  about_lead: string;
  about_body: string;
  signature: string;
  hanko: string;
  contact_email: string;
  contact_lead: string;
};
export type IdentityItem = { id: string; title: string; note: string };
export type JourneyEntry = {
  id: string;
  year: string;
  place: string;
  stage: string;
  title: string;
  description: string;
  tags: string[];
};
export type ServiceItem = {
  id: string;
  title: string;
  jp: string;
  tagline: string;
  capabilities: string[];
  kind: ServiceKind;
};
export type MediaKind = "image" | "video";
export type AchievementItem = {
  id: string;
  value: string;
  title: string;
  jp: string;
  year: string;
  organization: string;
  detail: string;
  media_url: string | null;
  media_kind: MediaKind | null;
};
export type ExploringItem = { id: string; title: string; description: string };
export type ToolboxGroup = { id: string; title: string; jp: string; tools: string[] };
export type FaqItem = { id: string; question: string; answer: string };

/** Everything the home page needs beyond projects, posts and writings. */
export type SiteContent = {
  profile: SiteProfile;
  identity: IdentityItem[];
  journey: JourneyEntry[];
  services: ServiceItem[];
  achievements: AchievementItem[];
  exploring: ExploringItem[];
  toolbox: ToolboxGroup[];
  faqs: FaqItem[];
};

// --- registry -------------------------------------------------------------------------------------------

export type FieldType = "text" | "longtext" | "tags" | "select" | "media";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  /** Max characters (text / longtext / tag) — also the database limit. */
  max: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** `select` only. */
  options?: readonly { value: string; label: string }[];
  /** `tags` only: how many entries. */
  maxItems?: number;
  /** `media` only: the column that stores "image" or "video". */
  kindKey?: string;
};

export const SECTION_KEYS = [
  "journey",
  "services",
  "achievements",
  "exploring",
  "toolbox",
  "faq",
  "identity",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export type SectionDef = {
  key: SectionKey;
  table: string;
  label: string;
  singular: string;
  jp: string;
  blurb: string;
  /** Which field is the row's headline in the list, and which supports it. */
  titleField: string;
  metaField?: string;
  fields: readonly FieldDef[];
  /** Shown under the list: what happens on the public site. */
  visibility: string;
};

export const SECTIONS: Record<SectionKey, SectionDef> = {
  journey: {
    key: "journey",
    table: "journey_entries",
    label: "Journey",
    singular: "chapter",
    jp: "旅路",
    blurb: "The train-ride timeline: one card per stage of your story, in order.",
    titleField: "title",
    metaField: "year",
    visibility:
      "The Journey section is hidden on the site until it has at least one published chapter.",
    fields: [
      {
        key: "title",
        label: "Title",
        type: "text",
        max: 80,
        required: true,
        placeholder: "FIRST SPARK",
      },
      { key: "year", label: "Year", type: "text", max: 12, placeholder: "2024" },
      {
        key: "place",
        label: "Place / label",
        type: "text",
        max: 40,
        placeholder: "DELHI",
        hint: "Shown next to the year.",
      },
      {
        key: "stage",
        label: "Stage keyword",
        type: "text",
        max: 24,
        placeholder: "BEGIN",
        hint: "One word: BEGIN, LEARN, BUILD, NOW…",
      },
      { key: "description", label: "Story", type: "longtext", max: 600 },
      {
        key: "tags",
        label: "Tags",
        type: "tags",
        max: 24,
        maxItems: 8,
        hint: "Press Enter or comma after each one.",
      },
    ],
  },
  services: {
    key: "services",
    table: "services",
    label: "What I can build",
    singular: "service",
    jp: "制作",
    blurb: "The cards in “What I can build”. Order here is the order on the site.",
    titleField: "title",
    metaField: "tagline",
    visibility: "The section is hidden on the site while it has no published services.",
    fields: [
      {
        key: "title",
        label: "Title",
        type: "text",
        max: 60,
        required: true,
        placeholder: "PENTESTING",
      },
      { key: "kind", label: "Card artwork", type: "select", max: 24, options: SERVICE_KINDS },
      {
        key: "jp",
        label: "Kanji watermark",
        type: "text",
        max: 4,
        placeholder: "侵入",
        hint: "One or two Japanese characters, purely decorative.",
      },
      { key: "tagline", label: "One-line description", type: "text", max: 160 },
      {
        key: "capabilities",
        label: "Capabilities",
        type: "tags",
        max: 30,
        maxItems: 8,
        hint: "Short chips shown on the card.",
      },
    ],
  },
  achievements: {
    key: "achievements",
    table: "achievements",
    label: "Achievements",
    singular: "achievement",
    jp: "実績",
    blurb: "Milestones, certificates and wins. Each can carry a photo or a short video.",
    titleField: "title",
    metaField: "value",
    visibility:
      "The section is hidden on the site until it has at least one published achievement.",
    fields: [
      {
        key: "title",
        label: "Title",
        type: "text",
        max: 80,
        required: true,
        placeholder: "HALL OF FAME",
      },
      {
        key: "value",
        label: "Big number / badge",
        type: "text",
        max: 12,
        placeholder: "12+",
        hint: "Shown large on the card: 12+, #1, 3rd…",
      },
      { key: "year", label: "Year", type: "text", max: 20, placeholder: "2026" },
      { key: "organization", label: "Organisation / event", type: "text", max: 80 },
      { key: "jp", label: "Kanji watermark", type: "text", max: 4, placeholder: "実績" },
      { key: "detail", label: "Details", type: "longtext", max: 400 },
      {
        key: "media_url",
        label: "Photo or video",
        type: "media",
        max: 2048,
        kindKey: "media_kind",
        hint: "JPG, PNG, WebP, MP4 or WebM. Videos up to 50 MB.",
      },
    ],
  },
  exploring: {
    key: "exploring",
    table: "exploring_items",
    label: "Currently exploring",
    singular: "topic",
    jp: "探求",
    blurb: "What you are learning or experimenting with right now.",
    titleField: "title",
    visibility: "The section is hidden on the site until it has at least one published topic.",
    fields: [
      {
        key: "title",
        label: "Topic",
        type: "text",
        max: 80,
        required: true,
        placeholder: "Malware analysis",
      },
      { key: "description", label: "Description", type: "longtext", max: 500 },
    ],
  },
  toolbox: {
    key: "toolbox",
    table: "toolbox_groups",
    label: "Toolbox",
    singular: "group",
    jp: "道具",
    blurb: "Your tech stack, grouped. Each group is one card in the stacked toolbox.",
    titleField: "title",
    visibility: "The section is hidden on the site while it has no published groups.",
    fields: [
      {
        key: "title",
        label: "Group name",
        type: "text",
        max: 40,
        required: true,
        placeholder: "BLUE TEAM",
      },
      { key: "jp", label: "Kanji watermark", type: "text", max: 2, placeholder: "守" },
      {
        key: "tools",
        label: "Tools",
        type: "tags",
        max: 40,
        maxItems: 24,
        hint: "Press Enter or comma after each one.",
      },
    ],
  },
  faq: {
    key: "faq",
    table: "faqs",
    label: "FAQ",
    singular: "question",
    jp: "質問",
    blurb: "Questions visitors often ask, with your answers.",
    titleField: "question",
    visibility:
      "The FAQ section is hidden on the site until it has at least one published question.",
    fields: [
      { key: "question", label: "Question", type: "text", max: 200, required: true },
      { key: "answer", label: "Answer", type: "longtext", max: 1500 },
    ],
  },
  identity: {
    key: "identity",
    table: "identity_items",
    label: "Identity lines",
    singular: "line",
    jp: "自己",
    blurb: "The four short lines under the About text (DEVELOPER, CREATOR…).",
    titleField: "title",
    metaField: "note",
    visibility: "Hidden while empty.",
    fields: [
      {
        key: "title",
        label: "Label",
        type: "text",
        max: 30,
        required: true,
        placeholder: "DEVELOPER",
      },
      { key: "note", label: "Note", type: "text", max: 60, placeholder: "Building. Solving." },
    ],
  },
};

export const isSectionKey = (value: unknown): value is SectionKey =>
  typeof value === "string" && value in SECTIONS;

/**
 * A row as the admin area sees it: the section's own fields (looked up by the field's `key`) plus the
 * shared bookkeeping columns. Values are narrowed to plain JSON-serialisable types (not `unknown`) so
 * server functions returning these rows can be serialised.
 */
export type SectionRow = {
  id: string;
  display_order: number;
  published: boolean;
  updated_at: string;
} & Record<string, string | number | boolean | string[] | null>;

export const PROFILE_FIELDS: readonly FieldDef[] = [
  {
    key: "about_lead",
    label: "About — lead paragraph",
    type: "longtext",
    max: 800,
    hint: "The larger opening paragraph.",
  },
  { key: "about_body", label: "About — body", type: "longtext", max: 2000 },
  { key: "signature", label: "Signature", type: "text", max: 40, placeholder: "Aksh" },
  {
    key: "hanko",
    label: "Hanko stamp character",
    type: "text",
    max: 2,
    placeholder: "暁",
    hint: "The little red seal next to the signature.",
  },
  {
    key: "contact_email",
    label: "Contact email",
    type: "text",
    max: 254,
    required: true,
    hint: "Shown on the site and used as the destination for the contact form.",
  },
  { key: "contact_lead", label: "Contact — intro line", type: "longtext", max: 400 },
];
