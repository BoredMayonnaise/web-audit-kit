import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";
const html = await readFile(
  new URL("../dist/web-audit-kit.html", import.meta.url),
  "utf8",
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await sleep(20);
  }
  assert.ok(predicate(), "Timed out waiting for UI update");
}
async function app(
  url = "file:///web-audit-kit.html",
  draft = null,
  keepWelcome = false,
) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(html, {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole,
  });
  const w = dom.window,
    downloads = [];
  w.Blob = Blob;
  w.structuredClone = structuredClone;
  w.URL.createObjectURL = (blob) => {
    downloads.push(blob);
    return "blob:download";
  };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {
    w.downloadName = this.download;
  };
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.confirm = () => true;
  w.document.fonts = { ready: Promise.resolve() };
  w.HTMLImageElement.prototype.decode = () => Promise.resolve();
  w.print = () => {
    w.printCalls = (w.printCalls ?? 0) + 1;
  };
  if (draft)
    w.localStorage.setItem("web-audit-kit-draft-v1", JSON.stringify(draft));
  w.eval(w.document.querySelector("script[type=module]").textContent);
  try {
    await until(() => w.document.querySelector(".app-shell"));
  } catch (error) {
    console.error(errors);
    dom.window.close();
    throw error;
  }
  if (!keepWelcome && w.document.querySelector(".welcome-screen")) {
    [...w.document.querySelectorAll("button")]
      .find((b) => b.textContent.trim() === "Explore the example")
      .click();
    await sleep(50);
  }
  const button = (name) =>
    [...w.document.querySelectorAll("button")].find(
      (b) =>
        b.textContent.trim() === name || b.getAttribute("aria-label") === name,
    );
  const click = async (name) => {
    const b = button(name);
    assert.ok(b, `Missing button: ${name}`);
    assert.ok(!b.disabled);
    b.click();
    await sleep(35);
  };
  const edit = async (label, value) => {
    const el = [...w.document.querySelectorAll(".field")]
      .find((l) => l.querySelector(".field-label")?.textContent === label)
      ?.querySelector("input,textarea,select");
    assert.ok(el, `Missing field: ${label}`);
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(el),
      "value",
    );
    descriptor.set.call(el, value);
    el.dispatchEvent(
      new w.Event(el.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
    await sleep(30);
  };
  const importText = async (text, name = "project.audit.json") => {
    const input = w.document.querySelector(
      'input[aria-label="Open project file"]',
    );
    Object.defineProperty(input, "files", {
      value: [new File([text], name, { type: "application/json" })],
      configurable: true,
    });
    input.dispatchEvent(new w.Event("change", { bubbles: true }));
    await sleep(80);
    await until(() => !button("Export PDF")?.disabled);
  };
  return {
    w,
    dom,
    downloads,
    errors,
    click,
    edit,
    importText,
    button,
    close: () => dom.window.close(),
  };
}
test("packaging contains no external scripts, stylesheets, images, fonts, or runtime imports", async () => {
  const dom = new JSDOM(html);
  assert.equal(
    dom.window.document.querySelectorAll(
      'script[src],link[href],img[src^="http"]',
    ).length,
    0,
  );
  assert.equal(dom.window.document.querySelectorAll("script").length, 1);
  assert.ok(!html.match(/@import\s|url\(["']?https?:/));
  assert.ok(
    !dom.window.document
      .querySelector("script")
      .textContent.match(/\bimport\s*\(/),
  );
  const css = dom.window.document.querySelector("style").textContent;
  const embeddedFonts = [
    ...css.matchAll(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g),
  ].map((match) => Buffer.from(match[1], "base64"));
  assert.equal(
    embeddedFonts.length,
    2,
    "Both fonts must be embedded in the HTML",
  );
  for (const name of [
    "sora-latin-variable.woff2",
    "instrument-serif-regular.woff2",
  ]) {
    const source = await readFile(
      new URL(`../src/assets/fonts/${name}`, import.meta.url),
    );
    assert.equal(source.subarray(0, 4).toString(), "wOF2");
    assert.ok(
      embeddedFonts.some((font) => font.equals(source)),
      `${name} must retain its original bytes`,
    );
  }
  const licenses =
    dom.window.document.querySelector("#font-licenses").content.textContent;
  assert.ok(licenses.includes("Copyright 2019 The Sora Project Authors"));
  assert.ok(
    licenses.includes("Copyright 2022 The Instrument Serif Project Authors"),
  );
  assert.equal(
    (licenses.match(/SIL OPEN FONT LICENSE Version 1.1/g) || []).length,
    2,
  );
  assert.equal(dom.window.document.title, "Web Audit Kit for Freelancers");
  dom.window.close();
});
test("editor creates five findings, reorders, duplicates, deletes, and keeps actions live", async () => {
  const a = await app();
  try {
    await a.click("New project");
    await a.edit("Client / business name", "Juniper Home");
    await a.edit("Auditor / studio name", "North Studio");
    assert.match(
      a.w.document.querySelector(".save-state").textContent,
      /Unsaved changes/,
    );
    await a.click("Findings");
    for (let i = 1; i <= 5; i++) {
      await a.click("Add finding");
      await a.edit("Finding title", `Finding ${i}`);
      await a.edit("Recommended fix", `Fix ${i}`);
    }
    await a.click("Move finding 5 up");
    await a.click("Duplicate finding");
    assert.equal(a.w.document.querySelectorAll(".finding-list>li").length, 6);
    await a.click("Delete finding");
    assert.equal(a.w.document.querySelectorAll(".finding-list>li").length, 5);
    await a.click("Action Plan");
    const checkbox = a.w.document.querySelector(".finding-checkbox input");
    checkbox.click();
    await sleep(30);
    assert.match(
      a.w.document.querySelector(".action-list").textContent,
      /Fix 1/,
    );
    await a.click("Findings");
    a.w.document.querySelector(".finding-select").click();
    await sleep(30);
    await a.edit("Recommended fix", "Updated fix from the editor");
    await a.click("Action Plan");
    assert.match(
      a.w.document.querySelector(".action-list").textContent,
      /Updated fix from the editor/,
    );
    await a.click("Save project");
    const saved = JSON.parse(await a.downloads.at(-1).text());
    assert.equal(saved.details.client, "Juniper Home");
    assert.equal(saved.findings.length, 5);
    assert.deepEqual(
      saved.findings.map((f) => f.title),
      ["Finding 1", "Finding 2", "Finding 3", "Finding 5", "Finding 4"],
    );
    assert.equal(saved.actionPlan[0], saved.findings[0].id);
    assert.match(
      a.w.document.querySelector("[role=status]").textContent,
      /download started/,
    );
    assert.match(
      a.w.document.querySelector(".save-state").textContent,
      /No unsaved changes/,
    );
    assert.equal(a.errors.length, 0);
  } finally {
    a.close();
  }
});
test("bad imports and rejected replacement never erase work; valid import restores all text and order", async () => {
  const a = await app();
  try {
    await a.click("New project");
    await a.edit("Client / business name", "Work to preserve");
    await a.importText("{bad");
    assert.match(
      a.w.document.querySelector("[role=alert]").textContent,
      /unchanged/,
    );
    await a.click("Save project");
    const saved = JSON.parse(await a.downloads.at(-1).text());
    assert.equal(saved.details.client, "Work to preserve");
    await a.importText(JSON.stringify({ ...saved, schemaVersion: 999 }));
    assert.match(
      a.w.document.querySelector("[role=alert]").textContent,
      /Unsupported project version/,
    );
    await a.edit("Client / business name", "Unsaved work");
    a.w.confirm = () => false;
    await a.importText(
      JSON.stringify({
        ...saved,
        details: { ...saved.details, client: "Replacement" },
      }),
    );
    assert.equal(
      a.w.document.querySelector(".sidebar-project strong").textContent,
      "Unsaved work",
    );
    a.w.confirm = () => true;
    await a.importText(
      JSON.stringify({
        ...saved,
        details: {
          ...saved.details,
          client: "Restored project",
          summary: "<script>alert(1)</script>",
        },
      }),
    );
    assert.equal(
      a.w.document.querySelector(".sidebar-project strong").textContent,
      "Restored project",
    );
    assert.match(
      a.w.document.querySelector(".report-document").textContent,
      /<script>alert\(1\)<\/script>/,
    );
    assert.equal(
      a.w.document.querySelectorAll(".report-document script").length,
      0,
    );
    await a.click("Preview");
    await a.click("Export PDF");
    assert.equal(a.w.printCalls, 1);
    assert.equal(a.errors.length, 0);
  } finally {
    a.close();
  }
});
test("download preserves the entire fictional project and all embedded images", async () => {
  const a = await app();
  try {
    await a.click("Save project");
    const actual = JSON.parse(await a.downloads[0].text());
    const expected = JSON.parse(
      await readFile(
        new URL("../examples/brightside-cleaning.audit.json", import.meta.url),
        "utf8",
      ),
    );
    assert.deepEqual(actual, expected);
    assert.ok(a.w.downloadName.endsWith(".audit.json"));
  } finally {
    a.close();
  }
});
test("draft recovery preserves unsaved content; unavailable file-origin storage is explicit", async () => {
  const sample = JSON.parse(
    await readFile(
      new URL("../examples/brightside-cleaning.audit.json", import.meta.url),
      "utf8",
    ),
  );
  sample.details.client = "Recovered client";
  const a = await app("https://offline.test/", {
    project: sample,
    dirty: true,
  });
  try {
    assert.equal(
      a.w.document.querySelector(".sidebar-project strong").textContent,
      "Recovered client",
    );
    assert.match(
      a.w.document.querySelector("[role=status]").textContent,
      /draft recovered/,
    );
    await a.edit("Client / business name", "Updated draft");
    await sleep(750);
    assert.equal(
      JSON.parse(a.w.localStorage.getItem("web-audit-kit-draft-v1")).project
        .details.client,
      "Updated draft",
    );
  } finally {
    a.close();
  }
  const b = await app();
  try {
    await sleep(750);
    assert.match(
      b.w.document.querySelector(".workspace-footer").textContent,
      /recovery unavailable/,
    );
  } finally {
    b.close();
  }
});
test("compact finding selector preserves selection, order, and accessible priority help", async () => {
  const a = await app();
  try {
    await a.click("Findings");
    const field = (label) =>
      [...a.w.document.querySelectorAll(".field")].find(
        (item) => item.querySelector(".field-label")?.textContent === label,
      );
    const picker = field("Select a finding").querySelector("select");
    const originalIds = [...picker.options].map((option) => option.value);
    assert.equal(originalIds.length, 5);
    await a.edit("Select a finding", originalIds[1]);
    const title = field("Finding title").querySelector("input");
    assert.equal(title.value, "Quote form needs persistent labels");
    await a.edit("Priority", "Low");
    const priority = field("Priority").querySelector("select");
    const description = a.w.document.getElementById(
      priority.getAttribute("aria-describedby"),
    );
    assert.match(description.textContent, /useful refinement/);
    assert.equal(field("Priority").querySelector("label").htmlFor, priority.id);
    await a.click("Move selected finding up");
    assert.equal(picker.value, originalIds[1]);
    await a.click("Save project");
    const saved = JSON.parse(await a.downloads.at(-1).text());
    assert.deepEqual(
      saved.findings.map((f) => f.id),
      [originalIds[1], originalIds[0], ...originalIds.slice(2)],
    );
    assert.equal(saved.findings[0].priority, "Low");
    assert.equal(saved.findings.flatMap((f) => f.screenshots).length, 5);
    await a.click("Delete finding");
    assert.equal(picker.value, originalIds[0]);
    assert.equal(picker.options.length, 4);
    assert.equal(a.errors.length, 0);
  } finally {
    a.close();
  }
});
test("first-use guide completes a report without installing or changing the project schema", async () => {
  const a = await app("https://offline.test/", null, true);
  try {
    assert.ok(a.w.document.querySelector(".welcome-screen"));
    await sleep(750);
    assert.equal(
      a.w.localStorage.getItem("web-audit-kit-draft-v1"),
      null,
      "Welcome must not save an unchosen example as a user draft",
    );
    await a.click("Create a report");
    assert.equal(
      a.w.document.querySelector(".sidebar-project strong").textContent,
      "Untitled project",
    );
    await a.edit("Client / business name", "Guided client");
    await a.click("Next: Branding");
    assert.match(
      a.w.document.querySelector(".guide-top").textContent,
      /STEP 2 OF 5/,
    );
    await a.click("Back");
    assert.match(
      a.w.document.querySelector(".guide-top").textContent,
      /STEP 1 OF 5/,
    );
    await a.click("Next: Branding");
    await a.click("Next: Findings");
    await a.click("Add finding");
    await a.edit("Finding title", "Quote form labels");
    await a.edit("Recommended fix", "Add visible labels.");
    await a.click("Next: Action Plan");
    a.w.document.querySelector(".finding-checkbox input").click();
    await sleep(30);
    await a.click("Next: Preview");
    assert.match(
      a.w.document.querySelector(".guide-review").textContent,
      /executive summary/,
    );
    await a.click("Save editable project");
    const saved = JSON.parse(await a.downloads.at(-1).text());
    assert.equal(saved.schemaVersion, 1);
    assert.equal(saved.demo, false);
    assert.equal(saved.findings.length, 1);
    assert.equal(saved.actionPlan.length, 1);
    assert.equal(saved.details.client, "Guided client");
    assert.ok(!("guided" in saved));
    assert.match(
      a.w.document.querySelector(".guide-review").textContent,
      /Backup download started/,
    );
    await a.click("Export client PDF");
    assert.equal(a.w.printCalls, 1);
    await a.click("Exit guide");
    assert.equal(a.w.document.querySelector(".guide-panel"), null);
    await a.click("Help");
    await a.click("Restart guide");
    assert.match(
      a.w.document.querySelector(".guide-top").textContent,
      /STEP 1 OF 5/,
    );
    assert.equal(
      a.w.document.querySelector(".sidebar-project strong").textContent,
      "Guided client",
    );
    assert.equal(a.errors.length, 0);
  } finally {
    a.close();
  }
});
test("welcome imports reject malformed files and restore a saved project without a source-code workflow", async () => {
  const a = await app("file:///web-audit-kit.html", null, true);
  try {
    await a.importText("{bad");
    assert.ok(a.w.document.querySelector(".welcome-screen"));
    assert.match(
      a.w.document.querySelector("[role=alert]").textContent,
      /unchanged/,
    );
    const saved = JSON.parse(
      await readFile(
        new URL("../examples/brightside-cleaning.audit.json", import.meta.url),
        "utf8",
      ),
    );
    saved.findings.forEach((f) => (f.screenshots = []));
    saved.details.client = "Opened from welcome";
    await a.importText(JSON.stringify(saved));
    assert.equal(a.w.document.querySelector(".welcome-screen"), null);
    assert.equal(
      a.w.document.querySelector(".sidebar-project strong").textContent,
      "Opened from welcome",
    );
    await a.click("Save project");
    assert.deepEqual(JSON.parse(await a.downloads.at(-1).text()), saved);
    a.w.confirm = () => false;
    await a.edit("Client / business name", "Unsaved client");
    await a.click("New project");
    assert.equal(
      a.w.document.querySelector(".sidebar-project strong").textContent,
      "Unsaved client",
    );
    assert.equal(a.errors.length, 0);
  } finally {
    a.close();
  }
});
test("recovered work skips welcome and zero-finding review remains exportable", async () => {
  const saved = JSON.parse(
    await readFile(
      new URL("../examples/brightside-cleaning.audit.json", import.meta.url),
      "utf8",
    ),
  );
  saved.findings = [];
  saved.actionPlan = [];
  saved.details.client = "Recovered work";
  const a = await app(
    "https://offline.test/",
    { project: saved, dirty: true },
    true,
  );
  try {
    assert.equal(a.w.document.querySelector(".welcome-screen"), null);
    assert.equal(
      a.w.document.querySelector(".sidebar-project strong").textContent,
      "Recovered work",
    );
    await a.click("Preview");
    assert.match(
      a.w.document.querySelector(".guide-review").textContent,
      /no findings/,
    );
    await a.click("Export client PDF");
    assert.equal(a.w.printCalls, 1);
    await a.click("Save editable project");
    assert.equal(
      JSON.parse(await a.downloads.at(-1).text()).details.client,
      "Recovered work",
    );
    assert.equal(a.errors.length, 0);
  } finally {
    a.close();
  }
});
