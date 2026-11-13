// Shared Playwright harness: loads index.html with an in-memory folder that
// stands in for the File System Access API, so writes can be inspected.
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const exe = process.env.CHROME || undefined;
const page_url = "file://" + path.resolve(__dirname, "..", "index.html");

const fakeFs = (files) => {
  window.__files = Object.assign({}, files);
  const dir = (prefix, name) => ({
    kind: "directory", name,
    async *entries() {
      const seen = new Set();
      for (const key of Object.keys(window.__files).sort()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const head = rest.split("/")[0];
        if (seen.has(head)) continue;
        seen.add(head);
        if (rest.includes("/")) yield [head, dir(prefix + head + "/", head)];
        else yield [head, file(prefix + head, head)];
      }
    },
    async getFileHandle(n, opts) {
      const key = prefix + n;
      if (!(key in window.__files)) {
        if (!opts || !opts.create) throw new Error("NotFound");
        window.__files[key] = "";
      }
      return file(key, n);
    },
    async requestPermission() { return "granted"; },
    async queryPermission() { return "granted"; }
  });
  const file = (key, name) => ({
    kind: "file", name,
    async getFile() { return { text: async () => window.__files[key] }; },
    async createWritable() {
      let buf = "";
      return { write: async (s) => { buf = s; }, close: async () => { window.__files[key] = buf; } };
    },
    async remove() { delete window.__files[key]; }
  });
  window.__root = dir("", "vault");
  window.showDirectoryPicker = async () => window.__root;
};

async function open(files, now, storage) {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  if (now) await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(fakeFs, files);
  if (storage) await page.addInitScript((items) => { for (const k in items) localStorage.setItem(k, items[k]); }, storage);
  await page.goto(page_url);
  await page.evaluate(async () => { await openRoot(window.__root); });
  return { browser, page, errors };
}
const settle = (page) => page.waitForTimeout(150);
const files = (page) => page.evaluate(() => Object.assign({}, window.__files));

module.exports = { open, settle, files };
