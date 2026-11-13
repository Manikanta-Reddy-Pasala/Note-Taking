// node tests/shot.js <out-prefix>: screenshots of today's note, the editor and a plain note.
const { open, settle } = require("./harness");
(async () => {
  const out = process.argv[2] || "shot";
  const { browser, page } = await open({
    "Daily/2026-11-12.md": "## todo\n- [ ] Review [[Project plan]] with the team\n- [x] Send invoice to Acme\n- [ ] Fix login bug https://acme.atlassian.net/browse/ONE-412\n  - [ ] Reproduce on staging\n  - [x] Write a failing test\n\n## Tomorrow\n- [ ] Call the bank\n",
    "Projects/Project plan.md": "# Project plan\n\nGoals for **Q4**, see [[2026-11-12]].\n\n## Milestones\n- Ship rollover\n- Obsidian look\n\n- [ ] Draft the spec\n- [x] Pick a name\n",
    "Notes/Idea.md": "# Idea\nA quick thought.\n"
  }, "2026-11-13T06:00:00Z", { "folia.daily:vault": "vault/Daily" });
  await page.setViewportSize(process.argv[3] === "phone" ? { width: 390, height: 844 } : { width: 1400, height: 860 });
  await settle(page);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}-today.png` });
  await page.click("#btnEditNote"); await settle(page);
  await page.screenshot({ path: `${out}-edit.png` });
  await page.evaluate(() => openNote(state.notes.find(n => n.title === "Project plan").id)); await settle(page);
  await page.screenshot({ path: `${out}-note.png` });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.emulateMedia({ colorScheme: "dark" }); await settle(page);
  await page.screenshot({ path: `${out}-dark.png` });
  await browser.close();
})();
