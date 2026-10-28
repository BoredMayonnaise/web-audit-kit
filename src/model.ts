export const CATEGORIES = [
  "Mobile usability",
  "Performance",
  "Navigation",
  "Forms",
  "Basic SEO",
] as const;
export const PRIORITIES = ["High", "Medium", "Low"] as const;
export const EFFORTS = ["Small", "Medium", "Large", "Unknown"] as const;
export const PRIORITY_HELP = {
  High: "Blocks a key task or creates a significant usability barrier. Address first.",
  Medium: "Creates friction, but a workaround exists. Schedule next.",
  Low: "A useful refinement. Address when time allows.",
};
export const MAX_PROJECT_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_FINDINGS = 100;
export const MAX_SCREENSHOTS = 50;
export interface AuditImage {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  caption: string;
}
export interface Finding {
  id: string;
  title: string;
  category: (typeof CATEGORIES)[number];
  page: string;
  observation: string;
  impact: string;
  recommendation: string;
  priority: (typeof PRIORITIES)[number];
  effort: (typeof EFFORTS)[number];
  verification: string;
  screenshots: AuditImage[];
}
export interface Project {
  schemaVersion: 1;
  id: string;
  demo: boolean;
  details: {
    client: string;
    website: string;
    title: string;
    date: string;
    auditor: string;
    contact: string;
    scope: string;
    summary: string;
  };
  branding: { accent: string; logo: AuditImage | null };
  findings: Finding[];
  actionPlan: string[];
  paperSize: "A4" | "Letter";
}
export function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}
export function newProject(): Project {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    schemaVersion: 1,
    id: uid(),
    demo: false,
    details: {
      client: "",
      website: "",
      title: "Website audit report",
      date,
      auditor: "",
      contact: "",
      scope: "",
      summary: "",
    },
    branding: { accent: "#526b50", logo: null },
    findings: [],
    actionPlan: [],
    paperSize: "A4",
  };
}
export function newFinding(): Finding {
  return {
    id: uid(),
    title: "",
    category: "Mobile usability",
    page: "",
    observation: "",
    impact: "",
    recommendation: "",
    priority: "Medium",
    effort: "Unknown",
    verification: "",
    screenshots: [],
  };
}
export function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (
    index < 0 ||
    index >= items.length ||
    target < 0 ||
    target >= items.length
  )
    return items;
  const result = [...items];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
export function deleteFinding(project: Project, id: string): Project {
  return {
    ...project,
    findings: project.findings.filter((f) => f.id !== id),
    actionPlan: project.actionPlan.filter((key) => key !== id),
  };
}
export function duplicateFinding(finding: Finding): Finding {
  return {
    ...finding,
    id: uid(),
    title: `${finding.title || "Untitled finding"} (copy)`,
    screenshots: finding.screenshots.map((image) => ({ ...image, id: uid() })),
  };
}
export function orderedActions(project: Project): Finding[] {
  return project.actionPlan
    .map((id) => project.findings.find((f) => f.id === id))
    .filter((f): f is Finding => !!f);
}
export function serializeProject(project: Project): string {
  const json = JSON.stringify(project, null, 2);
  if (new Blob([json]).size > MAX_PROJECT_BYTES)
    throw Error(
      "This project exceeds 25 MB. Remove some screenshots before saving.",
    );
  return json;
}
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
}
function string(value: unknown, path: string, max = 12000): string {
  if (typeof value !== "string" || value.length > max)
    throw Error(
      `${path} must be text with at most ${max.toLocaleString()} characters.`,
    );
  return value;
}
function identifier(value: unknown, path: string): string {
  const id = string(value, path, 100);
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw Error(`${path} is not a valid ID.`);
  return id;
}
function choice<T extends string>(
  value: unknown,
  choices: readonly T[],
  path: string,
): T {
  if (!choices.includes(value as T))
    throw Error(`${path} has an unsupported value.`);
  return value as T;
}
function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw Error(`${path} must be a list of at most ${max} items.`);
  return value;
}
export function validateImage(value: unknown, path: string): AuditImage {
  const v = object(value, path);
  const data = string(v.dataUrl, `${path} image data`, 3 * 1024 * 1024);
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if (!match || match[2].length % 4 !== 0)
    throw Error(`${path} must contain an embedded PNG, JPEG, or WebP image.`);
  let header = "";
  try {
    header = atob(match[2].slice(0, 32));
  } catch {
    throw Error(`${path} contains invalid image data.`);
  }
  if (
    (match[1] === "png" && !header.startsWith("\x89PNG\r\n\x1a\n")) ||
    (match[1] === "jpeg" && !header.startsWith("\xff\xd8\xff")) ||
    (match[1] === "webp" &&
      !(header.startsWith("RIFF") && header.slice(8, 12) === "WEBP"))
  )
    throw Error(`${path} image type does not match its contents.`);
  const width = v.width,
    height = v.height;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 2048 ||
    height > 2048
  )
    throw Error(`${path} image dimensions must be between 1 and 2048 pixels.`);
  return {
    id: identifier(v.id, `${path} ID`),
    dataUrl: data,
    width,
    height,
    caption: string(v.caption, `${path} caption`, 1000),
  };
}
export function validateProject(value: unknown): Project {
  const p = object(value, "Project");
  if (p.schemaVersion !== 1)
    throw Error(
      `Unsupported project version (${String(p.schemaVersion).slice(0, 30)}). This app supports schemaVersion 1.`,
    );
  const d = object(p.details, "Project details"),
    b = object(p.branding, "Branding");
  const details = Object.fromEntries(
    [
      "client",
      "website",
      "title",
      "date",
      "auditor",
      "contact",
      "scope",
      "summary",
    ].map((key) => [
      key,
      string(
        d[key],
        `Project ${key}`,
        ["scope", "summary"].includes(key)
          ? 12000
          : key === "contact"
            ? 2000
            : 500,
      ),
    ]),
  ) as Project["details"];
  if (
    details.date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(details.date) ||
      !Number.isFinite(Date.parse(details.date)) ||
      new Date(details.date + "T12:00:00Z").toISOString().slice(0, 10) !==
        details.date)
  )
    throw Error("Audit date must be a valid YYYY-MM-DD date.");
  const accent = string(b.accent, "Accent color", 7);
  if (!/^#[a-fA-F0-9]{6}$/.test(accent))
    throw Error("Accent color must be a six-digit hex color, such as #526b50.");
  const ids = new Set<string>(),
    imageIds = new Set<string>();
  let screenshotCount = 0;
  const checkImage = (value: unknown, path: string) => {
    const image = validateImage(value, path);
    if (imageIds.has(image.id)) throw Error("Image IDs must be unique.");
    imageIds.add(image.id);
    return image;
  };
  const logo = b.logo === null ? null : checkImage(b.logo, "Logo");
  const findings = array(p.findings, "Findings", MAX_FINDINGS).map(
    (value, i): Finding => {
      const f = object(value, `Finding ${i + 1}`),
        id = identifier(f.id, `Finding ${i + 1} ID`);
      if (ids.has(id)) throw Error("Finding IDs must be unique.");
      ids.add(id);
      const screenshots = array(
        f.screenshots,
        `Finding ${i + 1} screenshots`,
        8,
      ).map((image, j) =>
        checkImage(image, `Finding ${i + 1}, screenshot ${j + 1}`),
      );
      screenshotCount += screenshots.length;
      return {
        id,
        title: string(f.title, "Finding title", 500),
        category: choice(f.category, CATEGORIES, "Category"),
        page: string(f.page, "Affected page", 500),
        observation: string(f.observation, "Observation"),
        impact: string(f.impact, "Impact"),
        recommendation: string(f.recommendation, "Recommended fix"),
        priority: choice(f.priority, PRIORITIES, "Priority"),
        effort: choice(f.effort, EFFORTS, "Effort"),
        verification: string(f.verification, "Verification"),
        screenshots,
      };
    },
  );
  if (screenshotCount > MAX_SCREENSHOTS)
    throw Error(
      `A project can contain at most ${MAX_SCREENSHOTS} screenshots.`,
    );
  const actionPlan = array(p.actionPlan, "Action plan", MAX_FINDINGS).map(
    (id) => identifier(id, "Action plan ID"),
  );
  if (
    new Set(actionPlan).size !== actionPlan.length ||
    actionPlan.some((id) => !ids.has(id))
  )
    throw Error("Action plan must reference unique, existing findings.");
  if (typeof p.demo !== "boolean")
    throw Error("Project must specify whether its content is fictional.");
  const project: Project = {
    schemaVersion: 1,
    id: identifier(p.id, "Project ID"),
    demo: p.demo,
    details,
    branding: { accent, logo },
    findings,
    actionPlan,
    paperSize: choice(p.paperSize, ["A4", "Letter"], "Paper size"),
  };
  serializeProject(project);
  return project;
}
export function parseProject(text: string): Project {
  if (new Blob([text]).size > MAX_PROJECT_BYTES)
    throw Error("Project file exceeds the 25 MB limit.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw Error(
      "This file is not valid JSON. Choose a Web Audit Kit project (.json). Your current work is unchanged.",
    );
  }
  return validateProject(value);
}
export function formatDate(value: string): string {
  if (!value) return "Date not set";
  return new Date(value + "T12:00:00").toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
