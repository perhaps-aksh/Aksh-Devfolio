import type {
  IdentityItem,
  ServiceItem,
  SiteContent,
  SiteProfile,
  ToolboxGroup,
} from "@/lib/site-content";

/**
 * What the site shows for the sections that ship with real copy (about, identity, services, toolbox)
 * when Supabase is not configured or the site-content migration has not been run yet. It mirrors the
 * seed rows in supabase/migrations/20260929000000_site_content.sql. Every other section (journey,
 * achievements, exploring, FAQ, projects, posts, writings) has no built-in content: it stays empty
 * until you add it in the admin area.
 */
export const DEFAULT_CONTACT_EMAIL = "perhaps.maverick@gmail.com";

export const DEFAULT_PROFILE: SiteProfile = {
  about_lead:
    "I am AKSH, a maverick creative developer based in India with a strong interest in cybersecurity, systems, and creative technology. My work lives at the intersection of editorial design, interactive storytelling, and security-conscious engineering.",
  about_body:
    "I believe the best digital experiences feel intentional — every transition, every type choice, every micro-interaction should serve the story, and every system should be built to resist what it was not designed for. I build websites that feel like publications, products that feel like art, and experiments that question what the web can be.",
  signature: "Aksh",
  hanko: "暁",
  contact_email: DEFAULT_CONTACT_EMAIL,
  contact_lead:
    "Tell me what you’re making. If it challenges the ordinary, I’m already interested.",
};

const identity = (title: string, note: string, i: number): IdentityItem => ({
  id: `default-identity-${i}`,
  title,
  note,
});

export const DEFAULT_IDENTITY: IdentityItem[] = [
  identity("DEVELOPER", "Building. Solving.", 1),
  identity("CREATOR", "Imagining. Expressing.", 2),
  identity("LEARNER", "Always Curious.", 3),
  identity("DREAMER", "Building Tomorrow.", 4),
];

const service = (
  i: number,
  title: string,
  jp: string,
  tagline: string,
  kind: ServiceItem["kind"],
  capabilities: string[],
): ServiceItem => ({ id: `default-service-${i}`, title, jp, tagline, kind, capabilities });

export const DEFAULT_SERVICES: ServiceItem[] = [
  service(1, "UI / UX", "体験", "Interfaces and flows that feel intentional.", "ux", [
    "DESIGN SYSTEMS",
    "PROTOTYPING",
    "INTERFACE DESIGN",
    "USER FLOWS",
  ]),
  service(
    2,
    "FULL STACK DEVELOPMENT",
    "開発",
    "End-to-end web apps, from database to interface.",
    "dev",
    ["MERN STACK", "REST APIS", "AUTH & SESSIONS", "DEPLOYMENT"],
  ),
  service(3, "BUG BOUNTY", "報奨", "Hunting real-world vulnerabilities, responsibly.", "bug", [
    "RECON",
    "WEB APP TESTING",
    "OWASP TOP 10",
    "RESPONSIBLE DISCLOSURE",
  ]),
  service(
    4,
    "VAPT",
    "診断",
    "Structured vulnerability assessment and penetration testing.",
    "scan",
    ["SCOPING", "SCANNING", "EXPLOITATION", "REPORTING"],
  ),
  service(
    5,
    "DFIR",
    "鑑識",
    "Digital forensics and incident response, evidence first.",
    "forensic",
    ["DISK & MEMORY FORENSICS", "TIMELINE ANALYSIS", "LOG ANALYSIS", "IR PLAYBOOKS"],
  ),
  service(
    6,
    "PENTESTING",
    "侵入",
    "Adversary-style testing of apps, networks and hosts.",
    "shell",
    ["NMAP", "METASPLOIT", "BLOODHOUND", "KALI LINUX"],
  ),
  service(7, "BLUE TEAMING", "防衛", "Detection, monitoring and defence that holds up.", "shield", [
    "SIEM",
    "SPLUNK",
    "WAZUH",
    "DETECTION ENGINEERING",
  ]),
  service(
    8,
    "FREELANCING",
    "自由",
    "Independent work with clear scope and honest timelines.",
    "freelance",
    ["SCOPED PROJECTS", "SECURITY REVIEWS", "WEB BUILDS", "ONGOING SUPPORT"],
  ),
  service(9, "HARDWARE / ROBOTICS", "機械", "Physical builds where code meets circuits.", "chip", [
    "MICROCONTROLLERS",
    "SENSORS",
    "ROBOTICS PROJECTS",
    "PROTOTYPING",
  ]),
  service(
    10,
    "REVERSE ENGINEERING",
    "解析",
    "Taking software apart to understand how it works.",
    "hex",
    ["STATIC ANALYSIS", "DYNAMIC ANALYSIS", "DEBUGGING", "C / C++"],
  ),
  service(
    11,
    "ENDPOINT SECURITY",
    "端末",
    "Protecting and monitoring the machines people actually use.",
    "endpoint",
    ["EDR", "HARDENING", "TELEMETRY", "THREAT DETECTION"],
  ),
  service(
    12,
    "RESEARCH",
    "研究",
    "Curiosity with method: notes, write-ups and experiments.",
    "research",
    ["SECURITY RESEARCH", "WRITE-UPS", "EXPERIMENTS", "THREAT MODELING"],
  ),
  service(
    13,
    "SOFTWARE DEVELOPMENT",
    "構築",
    "Reliable software in the language the problem needs.",
    "dev",
    ["PYTHON", "JAVASCRIPT", "C / C++", "KOTLIN / SWIFT"],
  ),
];

const group = (i: number, title: string, jp: string, tools: string[]): ToolboxGroup => ({
  id: `default-toolbox-${i}`,
  title,
  jp,
  tools,
});

export const DEFAULT_TOOLBOX: ToolboxGroup[] = [
  group(1, "FULL STACK", "表", ["MERN", "JavaScript", "SQL"]),
  group(2, "LANGUAGES", "言", ["Python", "Bash Scripting", "C / C++", "Kotlin", "Swift"]),
  group(3, "OFFENSIVE SECURITY", "攻", ["Kali Linux", "Nmap", "Metasploit", "BloodHound", "OWASP"]),
  group(4, "BLUE TEAM", "守", ["Splunk", "SIEM", "Wazuh", "EDR"]),
  group(5, "EXPERIMENTAL", "試", ["Experimental Builds", "Creative Coding", "Generative Systems"]),
];

export const defaultSiteContent = (): SiteContent => ({
  profile: { ...DEFAULT_PROFILE },
  identity: DEFAULT_IDENTITY.map((item) => ({ ...item })),
  journey: [],
  services: DEFAULT_SERVICES.map((item) => ({ ...item, capabilities: [...item.capabilities] })),
  achievements: [],
  exploring: [],
  toolbox: DEFAULT_TOOLBOX.map((item) => ({ ...item, tools: [...item.tools] })),
  faqs: [],
});
