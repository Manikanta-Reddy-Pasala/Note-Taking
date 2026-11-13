// Live preview editor, vault task list, calendar, rename, banner.
// Run: node tests/live.test.js   (CHROME=/path/to/chrome if Playwright's own browser is missing)
const assert = require("assert");
const { open, settle, files } = require("./harness");

const PREV = "## todo\n- [ ] A\n- [x] B\n- [ ] C\n  - [ ] C1\n\n## Tomorrow\n- [ ] D\n";
const start = () => ({
  "Daily/2026-11-12.md": PREV,
  "Projects/Project plan.md": "# Plan\n\nSee [[2026-11-12]] and **bold** text.\n\n- [ ] Draft the spec\n",
  "Notes/Idea.md": "Links to [[Project plan]] and [[Project plan|the plan]].\n"
});
const LIVE = { "folia.daily:vault": "vault/Daily", "folia.mode": "live" };
const wait = (page, ms = 700) => page.waitForTimeout(ms);
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const run = async (fn, storage = LIVE) => {
  const ctx = await open(start(), "2026-11-13T06:00:00Z", storage);
  try { await fn(ctx); assert.deepStrictEqual(ctx.errors, []); }
  finally { await ctx.browser.close(); }
};

test("Today opens in the live editor with checkboxes and hidden marks", () => run(async ({ page }) => {
  await settle(page);
  assert.strictEqual(await page.locator(".cm-editor").count(), 1, "no live editor");
  assert.strictEqual(await page.locator(".cm-check").count(), 4);
  const firstLine = await page.locator(".cm-line").first().innerText();
  assert.strictEqual(firstLine.trim(), "todo", "heading marks are showing: " + firstLine);
  assert.strictEqual(await page.locator('[data-mode="live"][aria-pressed="true"]').count(), 1);
}));

test("Clicking a checkbox in the editor ticks it in today's file only", () => run(async ({ page }) => {
  await settle(page);
  await page.locator(".cm-check").first().click();
  await wait(page);
  const f = await files(page);
  assert.match(f["Daily/2026-11-13.md"], /^## todo\n- \[x\] A\n/);
  assert.strictEqual(f["Daily/2026-11-12.md"], PREV);
  assert.match(await page.locator("#status").innerText(), /3 open · 1 done/);
}));

test("Enter on a task starts the next task, and typing is saved", () => run(async ({ page }) => {
  await settle(page);
  await page.locator(".cm-line", { hasText: "C1" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("C2 typed here");
  await wait(page);
  const f = await files(page);
  assert.match(f["Daily/2026-11-13.md"], /  - \[ \] C1\n  - \[ \] C2 typed here\n/);
  assert.match(await page.locator("#status").innerText(), /All changes saved/);
  // N while typing must not run rollover or leave the editor
  await page.keyboard.type(" N");
  await wait(page);
  assert.match((await files(page))["Daily/2026-11-13.md"], /C2 typed here N\n/);
}));

test("[[ suggests note titles and a link opens its note", () => run(async ({ page }) => {
  await settle(page);
  await page.locator(".cm-line", { hasText: "D" }).last().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" see [[Proj");
  await page.waitForSelector(".cm-tooltip-autocomplete");
  // The test clock is frozen; move it so the completion's short input delay passes.
  await page.clock.setFixedTime(new Date("2026-11-13T06:00:05Z"));
  await page.keyboard.press("Enter");
  await wait(page);
  assert.match((await files(page))["Daily/2026-11-13.md"], /- \[ \] D see \[\[Project plan\]\]\n/);
  await page.locator(".cm-line", { hasText: "todo" }).first().click(); // move cursor off the link line
  await settle(page);
  await page.locator(".cm-wikilink", { hasText: "Project plan" }).click();
  await settle(page);
  assert.strictEqual(await page.locator(".ed-title").inputValue(), "Project plan");
}));

test("Cmd/Ctrl+E switches between edit and reading view", () => run(async ({ page }) => {
  await settle(page);
  await page.keyboard.press("Control+e");
  await settle(page);
  assert.strictEqual(await page.locator("#notePreview").count(), 1);
  await page.click('[data-mode="live"]');
  await settle(page);
  assert.strictEqual(await page.locator(".cm-editor").count(), 1);
}));

test("Old daily note has no moved-to labels and is not changed", () => run(async ({ page }) => {
  await settle(page);
  await page.click('[data-day="-1"]');
  await wait(page, 400);
  assert.strictEqual(await page.locator(".cm-carried, .carried").count(), 0);
  assert.doesNotMatch(await page.locator(".cm-content").innerText(), /moved to/);
  assert.strictEqual((await files(page))["Daily/2026-11-12.md"], PREV);
}));

test("Heading, Enter, Tab makes a checkbox; Enter keeps making tasks", () => run(async ({ page }) => {
  await settle(page);
  await page.evaluate(() => { state.selectedFolderId = state.folders.find(f => f.name === "Notes").id; addNote(); });
  await wait(page);
  await page.locator(".cm-content").click();
  await page.keyboard.type("## Important");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Call the bank");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Pay rent");
  await wait(page);
  const body = (await files(page))["Notes/Untitled.md"];
  assert.strictEqual(body, "## Important\n- [ ] Call the bank\n- [ ] Pay rent");
  // Tab on a line with text still indents
  await page.keyboard.press("Home");
  await page.keyboard.press("Tab");
  await wait(page);
  assert.match((await files(page))["Notes/Untitled.md"], /\n  - \[ \] Pay rent$/);
}));

test("!! then space tags a task #important; it shows red in edit, read and Tasks", () => run(async ({ page }) => {
  await settle(page);
  await page.locator(".cm-line", { hasText: "A" }).first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" !! ");
  await wait(page);
  assert.match((await files(page))["Daily/2026-11-13.md"], /- \[ \] A #important \n/);
  await page.locator(".cm-line", { hasText: "todo" }).first().click();
  await settle(page);
  assert.strictEqual(await page.locator(".cm-line.cm-important .cm-tag-important").count(), 1);
  await page.click('[data-mode="read"]');
  await settle(page);
  assert.strictEqual(await page.locator(".row.important .tag-important").count(), 1);
  await page.click("#btnTasks");
  await settle(page);
  await page.click("#tasksImportant");
  await settle(page);
  const rows = await page.locator(".tg-row").allInnerTexts();
  assert.strictEqual(rows.length, 1, JSON.stringify(rows));
  assert.match(rows[0], /A\s*#important/);
  assert.match(rows[0], /since 12 Nov/);
}));

test("# suggests tags, important first", () => run(async ({ page }) => {
  await settle(page);
  await page.locator(".cm-line", { hasText: "D" }).last().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" #imp");
  await page.waitForSelector(".cm-tooltip-autocomplete");
  await page.clock.setFixedTime(new Date("2026-11-13T06:00:05Z"));
  await page.keyboard.press("Enter");
  await wait(page);
  assert.match((await files(page))["Daily/2026-11-13.md"], /- \[ \] D #important \n/);
}));

test("A note shows when it was created and last edited", () => run(async ({ page }) => {
  await settle(page);
  await page.evaluate(() => openNote(state.notes.find(n => n.title === "Project plan").id));
  await settle(page);
  assert.strictEqual(await page.locator("#noteMeta").innerText(), "");
  await page.locator(".cm-line", { hasText: "Draft the spec" }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" now");
  await wait(page);
  assert.match(await page.locator("#noteMeta").innerText(), /^Edited today \d\d:\d\d$/);
  await page.evaluate(() => { state.selectedFolderId = state.folders.find(f => f.name === "Notes").id; addNote(); });
  await wait(page);
  assert.match(await page.locator("#noteMeta").innerText(), /Created today \d\d:\d\d/);
}));

test("Tasks view lists each carried task once and ticks it in the newest note", () => run(async ({ page }) => {
  await settle(page);
  await page.click("#btnTasks");
  await settle(page);
  const rows = await page.locator(".tg-row").allInnerTexts();
  assert.strictEqual(rows.filter(t => /^A\b/.test(t.trim())).length, 1, JSON.stringify(rows));
  assert.ok(rows.some(t => /Draft the spec/.test(t)));
  assert.ok(rows.some(t => /^A\s+since 12 Nov$/.test(t.trim())), JSON.stringify(rows));
  const index = rows.findIndex(t => /^A\b/.test(t.trim()));
  await page.locator(".tg-row").nth(index).locator("input").click();
  await wait(page);
  const f = await files(page);
  assert.match(f["Daily/2026-11-13.md"], /- \[x\] A\n/);
  assert.strictEqual(f["Daily/2026-11-12.md"], PREV);
  await page.fill("#tasksFilter", "spec");
  await settle(page);
  assert.strictEqual(await page.locator(".tg-row").count(), 1);
}));

test("Calendar opens a day; an empty day does not break the next rollover", () => run(async ({ page }) => {
  await settle(page);
  await page.click('[data-cal-date="2026-11-20"]');
  await wait(page);
  let f = await files(page);
  assert.strictEqual(f["Daily/2026-11-20.md"], "## todo\n\n## Tomorrow\n");
  assert.match(await page.locator(".ed-title").inputValue(), /20 November 2026/);
  await page.click('[data-cal-date="2026-11-12"]');
  await settle(page);
  assert.match(await page.locator(".ed-title").inputValue(), /12 November 2026/);
  await page.click('[data-day="0"]');
  await settle(page);
  assert.match(await page.locator(".ed-title").inputValue(), /13 November 2026/);
}));

test("Renaming a note renames the file and fixes links to it", () => run(async ({ page }) => {
  await settle(page);
  await page.evaluate(() => openNote(state.notes.find(n => n.title === "Project plan").id));
  await settle(page);
  await page.fill(".ed-title", "Roadmap");
  await page.press(".ed-title", "Enter");
  await wait(page);
  const f = await files(page);
  assert.ok(f["Projects/Roadmap.md"], "new file missing");
  assert.ok(!("Projects/Project plan.md" in f), "old file left behind");
  assert.strictEqual(f["Notes/Idea.md"], "Links to [[Roadmap]] and [[Roadmap|the plan]].\n");
}));

test("Without a daily folder a banner offers one", () => run(async ({ page }) => {
  await settle(page);
  assert.ok(await page.locator("#banner").isVisible());
  await page.click("[data-use-daily]");
  await wait(page);
  assert.ok(!(await page.locator("#banner").isVisible()));
  assert.ok((await files(page))["Daily/2026-11-13.md"], "today not created");
}, { "folia.mode": "live" }));

test("Theme button cycles and sticks", () => run(async ({ page }) => {
  await settle(page);
  await page.click("#btnTheme");
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.theme), "light");
  await page.click("#btnTheme");
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  assert.strictEqual(await page.evaluate(() => localStorage.getItem("folia.theme")), "dark");
}));

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log("ok  ", t.name); }
    catch (err) { failed += 1; console.log("FAIL", t.name, "\n   ", String(err.message).split("\n").join("\n    ")); }
  }
  console.log(failed ? `${failed} failed` : "all passed");
  process.exit(failed ? 1 : 0);
})();
