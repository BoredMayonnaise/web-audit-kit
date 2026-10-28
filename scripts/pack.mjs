import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
let html = await readFile("dist/index.html", "utf8");
const blocks = [];
const hold = (content) => {
  blocks.push(content);
  return `<!--INLINE_${blocks.length - 1}-->`;
};
html = await replaceAsync(
  html,
  /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g,
  async (_, path) => {
    const js = await readFile(join("dist", path), "utf8");
    return hold(
      `<script type="module">${js.replaceAll("</script", "<\\/script")}</script>`,
    );
  },
);
html = await replaceAsync(
  html,
  /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  async (_, path) =>
    hold(`<style>${await readFile(join("dist", path), "utf8")}</style>`),
);
if (/<(?:script|link)\b[^>]*(?:src|href)=/.test(html))
  throw Error("External build dependency remains.");
html = html.replace(/<!--INLINE_(\d+)-->/g, (_, i) => blocks[Number(i)]);
const fontLicenses = await Promise.all(
  ["Sora-OFL.txt", "Instrument-Serif-OFL.txt"].map((name) =>
    readFile(join("src/assets/fonts", name), "utf8"),
  ),
);
const licenseText = fontLicenses
  .join("\n\n")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
html = html.replace(
  "</body>",
  `<template id="font-licenses"><pre>${licenseText}</pre></template></body>`,
);
await writeFile("dist/index.html", html);
await writeFile("dist/web-audit-kit.html", html);
for (const file of await readdir("dist"))
  if (file !== "index.html" && file !== "web-audit-kit.html")
    await rm(join("dist", file), { recursive: true });
console.log(
  `Standalone HTML ready: dist/web-audit-kit.html (${(html.length / 1024).toFixed(0)} KB)`,
);
async function replaceAsync(value, regex, transform) {
  const matches = [...value.matchAll(regex)];
  for (const match of matches)
    value = value.replace(match[0], await transform(...match));
  return value;
}
