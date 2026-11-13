// node tests/shot.js <out-prefix> [phone]: screenshots of the main screens.
const { open, settle } = require("./harness");
(async () => {
  const out = process.argv[2] || "shot";
  const phone = process.argv[3] === "phone";
  const { browser, page } = await open({
    "Daily/2026-11-11.md": "## todo\n- [x] Book flights\n\n## Tomorrow\n",
    "Daily/2026-11-12.md": "## todo\n- [ ] Review [[Project plan]] with the team\n- [x] Send invoice to Acme\n- [ ] Fix login bug #important https://acme.atlassian.net/browse/ONE-412\n  - [ ] Reproduce on staging\n  - [x] Write a failing test\n\nNotes from standup: **ship** the *rollover* fix.\n\n## Tomorrow\n- [ ] Call the bank #finance\n",
    "Projects/Project plan.md": "## Goals\n\nShip by **Q4**, see [[2026-11-12]].\n\n> Keep it small.\n\n- Rollover\n- Live preview\n\n- [ ] Draft the spec\n- [x] Pick a name\n\nUse `npm test` before pushing.\n",
    "Notes/Idea.md": "A quick thought.\n"
  }, "2026-11-13T06:00:00Z", { "folia.daily:vault": "vault/Daily", "folia.mode": "live" });
  await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1400, height: 860 });
  await page.waitForTimeout(2800);
  await page.screenshot({ path: `${out}-today.png` });
  await page.locator(".cm-line", { hasText: "Reproduce" }).click();
  await settle(page);
  await page.screenshot({ path: `${out}-editing.png` });
  await page.evaluate(() => openNote(state.notes.find(n => n.title === "Project plan").id)); await settle(page);
  await page.screenshot({ path: `${out}-note.png` });
  await page.click("#btnTasks"); await settle(page);
  await page.screenshot({ path: `${out}-tasks.png` });
  await page.evaluate(() => { theme = "dark"; applyTheme(); });
  await page.click("#btnTasks");
  if (phone) { await page.click("#btnRail"); await settle(page); await page.screenshot({ path: `${out}-drawer.png` }); }
  await page.click('[data-cal-date="2026-11-12"]'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}-dark.png` });
  await browser.close();
})();
