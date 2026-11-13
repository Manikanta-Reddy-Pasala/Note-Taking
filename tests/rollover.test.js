// Run: node tests/rollover.test.js   (CHROME=/path/to/chrome if Playwright's own browser is missing)
const assert = require("assert");
const { open, settle, files } = require("./harness");

const PREV = "## todo\n- [ ] A\n- [x] B\n- [ ] C\n  - [ ] C1\n  - [x] C2\n- [x] E\n  - [ ] E1 open under done parent\n\n## Tomorrow\n- [ ] D\n";
const OLDER = "## todo\n- [ ] Old open\n- [x] Old done\n\n## Tomorrow\n";
const start = () => ({
  "Daily/2026-11-11.md": OLDER,
  "Daily/2026-11-12.md": PREV,
  "Notes/Idea.md": "# Idea\n- [ ] not a daily task\n"
});
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("Open today copies open tasks and leaves earlier notes untouched", async () => {
  const { browser, page, errors } = await open(start(), "2026-11-13T06:00:00Z");
  await page.evaluate(() => markDaily(state.folders.find(f => f.name === "Daily").id));
  await settle(page);
  let f = await files(page);
  assert.strictEqual(f["Daily/2026-11-12.md"], PREV, "previous note changed");
  assert.strictEqual(f["Daily/2026-11-11.md"], OLDER, "older note changed");
  assert.strictEqual(f["Daily/2026-11-13.md"],
    "## todo\n- [ ] A\n- [ ] C\n  - [ ] C1\n- [ ] E1 open under done parent\n- [ ] D\n\n## Tomorrow\n");
  // pressing the button again adds nothing
  await page.click("#btnToday"); await settle(page);
  f = await files(page);
  assert.strictEqual(f["Daily/2026-11-13.md"].split("- [ ] A").length, 2, "A duplicated");
  assert.strictEqual(f["Daily/2026-11-12.md"], PREV);
  assert.deepStrictEqual(errors, []);
  await browser.close();
});

test("Ticking a task today only changes today's file", async () => {
  const { browser, page, errors } = await open(start(), "2026-11-13T06:00:00Z");
  await page.evaluate(() => markDaily(state.folders.find(f => f.name === "Daily").id));
  await settle(page);
  const title = await page.locator(".ed-title").inputValue();
  assert.match(title, /13 November 2026/);
  await page.locator("#notePreview input.check").first().click(); await settle(page);
  await page.locator("#notePreview input.check").nth(1).click(); await settle(page);
  let f = await files(page);
  assert.match(f["Daily/2026-11-13.md"], /- \[x\] A\n- \[x\] C\n/);
  assert.strictEqual(f["Daily/2026-11-12.md"], PREV, "previous note changed by a tick");
  await page.click("#btnToday"); await settle(page);
  f = await files(page);
  assert.match(f["Daily/2026-11-13.md"], /- \[x\] A\n- \[x\] C\n/, "Open today reopened or duplicated ticked tasks");
  assert.strictEqual(f["Daily/2026-11-12.md"], PREV);
  // unticking keeps one line
  await page.locator("#notePreview input.check").first().click(); await settle(page);
  f = await files(page);
  assert.strictEqual(f["Daily/2026-11-13.md"].match(/\] A\n/g).length, 1);
  assert.deepStrictEqual(errors, []);
  await browser.close();
});

test("Opening the folder rolls over to today by itself", async () => {
  const { browser, page, errors } = await open(start(), "2026-11-13T06:00:00Z", { "folia.daily:vault": "vault/Daily" });
  await settle(page);
  const f = await files(page);
  assert.ok(f["Daily/2026-11-13.md"], "today's note not created");
  assert.match(f["Daily/2026-11-13.md"], /- \[ \] A\n/);
  assert.strictEqual(f["Daily/2026-11-12.md"], PREV);
  assert.match(await page.locator(".ed-title").inputValue(), /13 November 2026/);
  assert.deepStrictEqual(errors, []);
  await browser.close();
});

test("A new day while the app is open rolls from yesterday", async () => {
  const { browser, page, errors } = await open(start(), "2026-11-13T06:00:00Z", { "folia.daily:vault": "vault/Daily" });
  await settle(page);
  await page.locator("#notePreview input.check").first().click(); await settle(page); // A done on the 13th
  const day13 = (await files(page))["Daily/2026-11-13.md"];
  await page.clock.setFixedTime(new Date("2026-11-14T05:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await settle(page);
  const f = await files(page);
  assert.strictEqual(f["Daily/2026-11-13.md"], day13, "yesterday changed");
  assert.strictEqual(f["Daily/2026-11-14.md"],
    "## todo\n- [ ] C\n  - [ ] C1\n- [ ] E1 open under done parent\n- [ ] D\n\n## Tomorrow\n");
  assert.match(await page.locator(".ed-title").inputValue(), /14 November 2026/);
  assert.deepStrictEqual(errors, []);
  await browser.close();
});

test("Tasks added for tomorrow land in tomorrow's todo", async () => {
  const { browser, page, errors } = await open(start(), "2026-11-13T06:00:00Z", { "folia.daily:vault": "vault/Daily" });
  await settle(page);
  await page.click("#peekTab");
  await page.fill("#addTomorrow input", "Call bank");
  await page.press("#addTomorrow input", "Enter"); await settle(page);
  let f = await files(page);
  assert.match(f["Daily/2026-11-13.md"], /## Tomorrow\n- \[ \] Call bank/);
  await page.clock.setFixedTime(new Date("2026-11-14T05:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await settle(page);
  f = await files(page);
  assert.match(f["Daily/2026-11-14.md"], /## todo\n[\s\S]*- \[ \] Call bank\n[\s\S]*## Tomorrow/);
  assert.match(f["Daily/2026-11-13.md"], /## Tomorrow\n- \[ \] Call bank/, "yesterday changed");
  assert.deepStrictEqual(errors, []);
  await browser.close();
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log("ok  ", t.name); }
    catch (err) { failed += 1; console.log("FAIL", t.name, "\n   ", err.message.split("\n").join("\n    ")); }
  }
  console.log(failed ? `${failed} failed` : "all passed");
  process.exit(failed ? 1 : 0);
})();
