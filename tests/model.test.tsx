import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Report } from "../src/Report";
import {
  newProject,
  newFinding,
  validateProject,
  parseProject,
  serializeProject,
  duplicateFinding,
  deleteFinding,
  move,
  orderedActions,
  MAX_PROJECT_BYTES,
} from "../src/model";
const fixture = () =>
  parseProject(
    readFileSync(
      new URL("../examples/brightside-cleaning.audit.json", import.meta.url),
      "utf8",
    ),
  );
test("example project round trips all fields, images, and plan order", () => {
  const p = fixture();
  assert.equal(p.findings.length, 5);
  assert.equal(p.demo, true);
  assert.equal(p.findings.flatMap((f) => f.screenshots).length, 5);
  assert.deepEqual(parseProject(serializeProject(p)), p);
  assert.equal(
    new Set(p.findings.flatMap((f) => f.screenshots.map((s) => s.id))).size,
    5,
  );
});
test("blank, one-finding, and twenty-finding reports render without exceptions", () => {
  for (const count of [0, 1, 20]) {
    const p = newProject();
    p.findings = Array.from({ length: count }, (_, i) => ({
      ...newFinding(),
      title: `Finding ${i + 1}`,
    }));
    p.actionPlan = p.findings.map((f) => f.id);
    const html = renderToStaticMarkup(
      createElement(Report, { project: validateProject(p) }),
    );
    assert.equal((html.match(/class="report-finding"/g) || []).length, count);
    assert.equal((html.match(/class="report-action"/g) || []).length, count);
    assert.ok(html.includes("Scope &amp; limitations"));
  }
});
test("long text and portrait images retain content and proportions", () => {
  const p = fixture();
  p.findings[0].observation = "An observation with clear evidence. ".repeat(
    330,
  );
  p.findings[0].screenshots[0].width = 500;
  p.findings[0].screenshots[0].height = 1600;
  const html = renderToStaticMarkup(createElement(Report, { project: p }));
  assert.ok(html.includes(p.findings[0].observation));
  assert.ok(html.includes('width="500" height="1600"'));
});
test("imported text is escaped; HTML and scripts never become document elements", () => {
  const p = fixture();
  p.details.client = "<img src=x onerror=alert(1)>";
  p.details.summary = "<script>window.injected=true</script>";
  p.findings[0].title = '<iframe src="https://evil.example"></iframe>';
  const html = renderToStaticMarkup(
    createElement(Report, { project: validateProject(p) }),
  );
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<iframe"));
  assert.ok(!html.includes('<img src="x"'));
});
test("editing and deleting findings keeps the action plan synchronized", () => {
  const p = fixture(),
    id = p.actionPlan[0];
  p.findings[0].title = "Changed";
  p.findings[0].priority = "Low";
  p.findings[0].recommendation = "Use a visible label.";
  p.findings[0].effort = "Small";
  assert.equal(orderedActions(p)[0].title, "Changed");
  assert.equal(orderedActions(p)[0].priority, "Low");
  const next = deleteFinding(p, id);
  assert.ok(!next.actionPlan.includes(id));
  assert.equal(next.findings.length, 4);
  assert.equal(p.findings.length, 5);
});
test("duplicate has independent IDs and keeps screenshot data and captions", () => {
  const p = fixture(),
    f = p.findings[0],
    copy = duplicateFinding(f);
  assert.notEqual(copy.id, f.id);
  assert.notEqual(copy.screenshots[0].id, f.screenshots[0].id);
  assert.equal(copy.screenshots[0].dataUrl, f.screenshots[0].dataUrl);
  copy.screenshots[0].caption = "New";
  assert.notEqual(copy.screenshots[0].caption, f.screenshots[0].caption);
});
test("reorder preserves data and rejects out-of-bounds moves", () => {
  const a = ["a", "b", "c"];
  assert.deepEqual(move(a, 0, 1), ["b", "a", "c"]);
  assert.deepEqual(move(a, 2, -1), ["a", "c", "b"]);
  assert.equal(move(a, 0, -1), a);
  assert.equal(move(a, 3, -1), a);
  assert.deepEqual(a, ["a", "b", "c"]);
});
test("rejects malformed JSON and unsupported schema versions", () => {
  assert.throws(() => parseProject("{ broken"), /not valid JSON/);
  assert.throws(
    () => validateProject({ ...newProject(), schemaVersion: 2 }),
    /Unsupported project version/,
  );
  assert.throws(() => validateProject(null), /must be an object/);
});
test("rejects duplicate IDs, invalid action references, and invalid enum values", () => {
  const p = fixture();
  p.findings[1].id = p.findings[0].id;
  assert.throws(() => validateProject(p), /unique/);
  const q = fixture();
  q.actionPlan.push("missing");
  assert.throws(() => validateProject(q), /existing findings/);
  const r = fixture();
  r.actionPlan.push(r.actionPlan[0]);
  assert.throws(() => validateProject(r), /unique/);
  const s = fixture();
  (s.findings[0] as any).priority = "Critical";
  assert.throws(() => validateProject(s), /unsupported value/);
});
test("rejects invalid dates, unsafe colors, external images, mismatched image types, and oversized images", () => {
  const p = fixture();
  p.details.date = "2026-02-30";
  assert.throws(() => validateProject(p), /valid YYYY-MM-DD/);
  const q = fixture();
  q.branding.accent = "red;}</style>";
  assert.throws(() => validateProject(q), /Accent color/);
  const r = fixture();
  r.findings[0].screenshots[0].dataUrl = "https://evil.example/tracker.png";
  assert.throws(() => validateProject(r), /embedded PNG/);
  const s = fixture();
  s.findings[0].screenshots[0].dataUrl =
    s.findings[0].screenshots[0].dataUrl.replace("image/png", "image/jpeg");
  assert.throws(() => validateProject(s), /does not match/);
  const t = fixture();
  t.findings[0].screenshots[0].width = 3000;
  assert.throws(() => validateProject(t), /dimensions/);
});
test("enforces counts, field lengths, and file size", () => {
  const p = newProject();
  p.findings = Array.from({ length: 101 }, () => newFinding());
  assert.throws(() => validateProject(p), /at most 100/);
  const q = newProject();
  q.details.summary = "x".repeat(12001);
  assert.throws(() => validateProject(q), /12,000/);
  assert.throws(() => parseProject(" ".repeat(MAX_PROJECT_BYTES + 1)), /25 MB/);
  const image = fixture().findings[0].screenshots[0];
  const r = newProject();
  r.findings = Array.from({ length: 7 }, (_, i) => ({
    ...newFinding(),
    screenshots: Array.from({ length: i === 6 ? 3 : 8 }, (_, j) => ({
      ...image,
      id: `shot-${i}-${j}`,
    })),
  }));
  assert.throws(() => validateProject(r), /at most 50 screenshots/);
  const s = newProject();
  s.findings = [{ ...newFinding(), screenshots: Array(9).fill(image) }];
  assert.throws(() => validateProject(s), /at most 8 items/);
});
test("unknown imported properties are discarded", () => {
  const p = {
    ...newProject(),
    unexpected: "discard",
    details: { ...newProject().details, extra: "discard" },
  };
  const clean = validateProject(p);
  assert.ok(!("unexpected" in clean));
  assert.ok(!("extra" in clean.details));
});
