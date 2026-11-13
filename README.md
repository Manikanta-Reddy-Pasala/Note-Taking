# Folia

Folia is a notebook that stays in the browser. Folders, notes, tasks, and a board share one vault. Work you leave unfinished is carried onto the next day.

![A note with links, bullets and tasks](screenshots/notes.png)

## Run

```bash
./run.sh
```

That builds the page into a small nginx container and serves it at [http://localhost:8080](http://localhost:8080). Docker needs to be running. Stop it with `docker rm -f folia`.

The app is a single `index.html`. Everything you write is stored in `localStorage` in that browser.

## Notes

The tree on the left is the vault. `[[Note title]]` is a link. Hover a link for a short preview of where that note sits and what it says, then click through. Pages that mention the open note are listed under Mentioned in.

Turn the page by dragging its edge, pressing `[` or `]`, or swiping horizontally on a trackpad. Jump to any note with ⌘K (Ctrl+K on other keyboards).

## Tasks

Each daily note has a Today section and a Tomorrow section. The green edge on the right is the next day: open it to see what is waiting, or add a task there.

![Today's note after rollover](screenshots/tasks.png)

- Swipe a task right to schedule it for the day on that edge. Swipe left to complete it.
- Right-click a folder and mark it as the daily folder. Daily notes are named `YYYY-MM-DD.md`.
- Rollover: unfinished tasks from the latest earlier daily note, and anything under its Tomorrow heading, are copied into today's `## todo`. Nesting is kept; a done parent is left behind and its open children move up. Earlier notes are never changed, and a task already on today (ticked or not) is not copied again.
- Rollover runs by itself once a day: when the folder opens, and when the date changes while the app is open. **Open today** (or N) runs it on demand.
- Ticking a box only changes the note it is in.

## Editing

Press Edit on a note.

![The editor, with checkboxes written as markdown](screenshots/edit.png)

- Enter adds a checkbox at the same indent. On a blank line, it turns that line into a checkbox. On a task, it opens the next one.
- Tab nests the current line as a subtopic. Shift+Tab, or Backspace at the start of the checkbox, brings it back out.
- Enter on an empty checkbox leaves the list.

Open folder reads a directory of markdown files. A note named `YYYY-MM-DD.md` is a daily note. Edits write back to those files in Chrome and Edge.

## Tests

```bash
npm i playwright
node tests/rollover.test.js   # set CHROME=/path/to/chrome if needed
```
