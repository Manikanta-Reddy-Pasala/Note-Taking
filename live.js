// Live preview editor: markdown stays plain text, but marks that the cursor
// is not on are hidden, so the note reads like the rendered page while you
// type. Built on CodeMirror 6 from vendor/editor.js (window.CM).
// The host app passes hooks: onChange(body), openTarget(title), titles(), tags().
window.FoliaLive = (() => {
  const CM = window.CM;
  if (!CM) return null;
  const {
    EditorState, EditorView, ViewPlugin, Decoration, WidgetType, keymap, drawSelection, dropCursor,
    history, defaultKeymap, historyKeymap, indentMore, indentLess, markdown, markdownLanguage, markdownKeymap,
    syntaxTree, syntaxHighlighting, HighlightStyle, indentUnit, autocompletion, completionKeymap,
    closeBrackets, closeBracketsKeymap, searchKeymap, highlightSelectionMatches, tags, GFM, placeholder
  } = CM;

  const WIKI = /\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|([^\]\n]+))?\]\]/g;
  const BARE = /https?:\/\/[^\s)<>\]]+/g;
  // #tag after a space or at the start of a line; "# Title" stays a heading.
  const TAG = /(^|[\s(])#([A-Za-z][\w/-]*)/g;

  class CheckWidget extends WidgetType {
    constructor(done) { super(); this.done = done; }
    eq(other) { return other.done === this.done; }
    toDOM(view) {
      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "check cm-check";
      box.checked = this.done;
      box.setAttribute("aria-label", this.done ? "Mark as not done" : "Mark as done");
      box.addEventListener("mousedown", (e) => e.preventDefault());
      box.addEventListener("click", (e) => {
        e.preventDefault();
        toggleTaskAt(view, view.posAtDOM(box));
      });
      return box;
    }
    ignoreEvent() { return true; }
  }
  class BulletWidget extends WidgetType {
    eq() { return true; }
    toDOM() {
      const dot = document.createElement("span");
      dot.className = "cm-bullet";
      dot.setAttribute("aria-hidden", "true");
      return dot;
    }
  }
  class RuleWidget extends WidgetType {
    eq() { return true; }
    toDOM() {
      const hr = document.createElement("span");
      hr.className = "cm-rule";
      return hr;
    }
  }
  const hide = Decoration.replace({});
  const check = (done) => Decoration.replace({ widget: new CheckWidget(done) });
  const bullet = Decoration.replace({ widget: new BulletWidget() });
  const rule = Decoration.replace({ widget: new RuleWidget() });
  const mark = (cls, attrs) => Decoration.mark({ class: cls, attributes: attrs });
  const line = (cls) => Decoration.line({ class: cls });

  // Toggle the task whose list marker starts at or contains pos.
  function toggleTaskAt(view, pos) {
    const ln = view.state.doc.lineAt(pos);
    const match = ln.text.match(/^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/);
    if (!match) return false;
    const at = ln.from + match[1].length + 1;
    view.dispatch({
      changes: { from: at, to: at + 1, insert: match[2] === " " ? "x" : " " },
      userEvent: "input.toggle"
    });
    return true;
  }
  function toggleTaskAtCursor(view) {
    const ln = view.state.doc.lineAt(view.state.selection.main.head);
    if (toggleTaskAt(view, ln.from)) return true;
    // Not a task yet: make the line one.
    const lead = ln.text.match(/^(\s*)(?:([-*+])\s+)?/);
    const insert = `${lead[1]}- [ ] `;
    view.dispatch({ changes: { from: ln.from, to: ln.from + lead[0].length, insert } });
    return true;
  }

  // Tab on an empty line (or a bare "- ") starts a task there; on any other
  // line it indents as before.
  function tabTask(view) {
    const sel = view.state.selection;
    if (sel.ranges.length !== 1 || !sel.main.empty) return indentMore(view);
    const ln = view.state.doc.lineAt(sel.main.head);
    const bare = ln.text.match(/^(\s*)(?:[-*+]\s*)?$/);
    if (!bare) return indentMore(view);
    const insert = `${bare[1]}- [ ] `;
    view.dispatch({
      changes: { from: ln.from, to: ln.to, insert },
      selection: { anchor: ln.from + insert.length },
      userEvent: "input"
    });
    return true;
  }
  // "!!" then a space turns into #important.
  const bangToImportant = EditorView.inputHandler.of((view, from, to, text) => {
    if (text !== " " || from !== to) return false;
    const ln = view.state.doc.lineAt(from);
    const before = view.state.sliceDoc(ln.from, from);
    if (!/(^|\s)!!$/.test(before)) return false;
    const insert = "#important ";
    view.dispatch({
      changes: { from: from - 2, to, insert },
      selection: { anchor: from - 2 + insert.length },
      userEvent: "input.type"
    });
    return true;
  });

  function activeLines(view) {
    const out = new Set();
    if (!view.hasFocus) return out;
    for (const r of view.state.selection.ranges) {
      const a = view.state.doc.lineAt(r.from).number;
      const b = view.state.doc.lineAt(r.to).number;
      for (let n = a; n <= b; n++) out.add(n);
    }
    return out;
  }
  function touches(view, from, to) {
    if (!view.hasFocus) return false;
    return view.state.selection.ranges.some(r => r.from <= to && r.to >= from);
  }

  function build(view, hooks) {
    const { state } = view;
    const doc = state.doc;
    const active = activeLines(view);
    const isActive = (pos) => active.has(doc.lineAt(pos).number);
    const out = [];
    const add = (from, to, deco) => { if (from <= to) out.push(deco.range(from, to)); };
    const tree = syntaxTree(state);
    for (const { from, to } of view.visibleRanges) {
      tree.iterate({
        from, to,
        enter: (node) => {
          const name = node.name;
          const heading = name.match(/^(?:ATX|Setext)Heading(\d)$/);
          if (heading) {
            add(doc.lineAt(node.from).from, doc.lineAt(node.from).from, line(`cm-h cm-h${heading[1]}`));
            return;
          }
          if (name === "HeaderMark" && node.node.parent && /^ATX/.test(node.node.parent.name)) {
            if (isActive(node.from)) return;
            const next = doc.sliceString(node.to, node.to + 1);
            add(node.from, node.to + (next === " " ? 1 : 0), hide);
            return;
          }
          if (name === "Emphasis") add(node.from, node.to, mark("cm-em"));
          if (name === "StrongEmphasis") add(node.from, node.to, mark("cm-strong"));
          if (name === "Strikethrough") add(node.from, node.to, mark("cm-strike"));
          if (name === "InlineCode") add(node.from, node.to, mark("cm-code"));
          if (name === "EmphasisMark" || name === "StrikethroughMark" ||
              (name === "CodeMark" && node.node.parent && node.node.parent.name === "InlineCode")) {
            if (!isActive(node.from)) add(node.from, node.to, hide);
            return;
          }
          if (name === "Blockquote") {
            for (let n = doc.lineAt(node.from).number; n <= doc.lineAt(node.to).number; n++) {
              add(doc.line(n).from, doc.line(n).from, line("cm-quote"));
            }
          }
          if (name === "QuoteMark") {
            if (!isActive(node.from)) {
              const next = doc.sliceString(node.to, node.to + 1);
              add(node.from, node.to + (next === " " ? 1 : 0), hide);
            }
            return;
          }
          if (name === "FencedCode" || name === "CodeBlock") {
            for (let n = doc.lineAt(node.from).number; n <= doc.lineAt(node.to).number; n++) {
              add(doc.line(n).from, doc.line(n).from, line("cm-codeblock"));
            }
            return false;
          }
          if (name === "HorizontalRule") {
            if (!isActive(node.from)) add(node.from, node.to, rule);
            return;
          }
          if (name === "ListMark") {
            const item = node.node.parent;
            const ln = doc.lineAt(node.from);
            const lead = ln.text.match(/^\s*/)[0].length;
            if (lead) add(ln.from, ln.from + lead, mark("cm-lead"));
            const task = item && item.getChild("Task");
            const marker = task && task.getChild("TaskMarker");
            if (marker && doc.lineAt(marker.from).number === ln.number) {
              const done = /x/i.test(doc.sliceString(marker.from, marker.to));
              const end = marker.to + (doc.sliceString(marker.to, marker.to + 1) === " " ? 1 : 0);
              add(ln.from, ln.from, line(done ? "cm-task cm-task-done" : "cm-task"));
              if (!touches(view, node.from, marker.to)) add(node.from, end, check(done));
              return;
            }
            const sign = doc.sliceString(node.from, node.to);
            add(ln.from, ln.from, line("cm-li"));
            if (/^[-*+]$/.test(sign) && !touches(view, node.from, node.to)) add(node.from, node.to, bullet);
            return;
          }
          if (name === "Link") {
            const marks = [];
            let url = null;
            for (let child = node.node.firstChild; child; child = child.nextSibling) {
              if (child.name === "LinkMark") marks.push(child);
              if (child.name === "URL") url = child;
            }
            if (marks.length >= 2 && url) {
              const href = doc.sliceString(url.from, url.to);
              add(marks[0].to, marks[1].from, mark("cm-link", { "data-url": href, title: href }));
              if (!isActive(node.from)) {
                add(marks[0].from, marks[0].to, hide);
                add(marks[1].from, node.to, hide);
              }
            }
            return false;
          }
          if (name === "URL" && !(node.node.parent && node.node.parent.name === "Link")) {
            const href = doc.sliceString(node.from, node.to);
            add(node.from, node.to, mark("cm-url", { "data-url": href }));
          }
        }
      });
      // [[wiki links]] and bare URLs are not in the markdown grammar.
      const text = doc.sliceString(from, to);
      let m;
      WIKI.lastIndex = 0;
      while ((m = WIKI.exec(text))) {
        const start = from + m.index;
        const end = start + m[0].length;
        const target = m[1].trim();
        if (isActive(start)) {
          add(start, end, mark("cm-wikilink-raw"));
          continue;
        }
        const labelFrom = m[2] ? end - 2 - m[2].length : start + 2;
        add(start, labelFrom, hide);
        add(labelFrom, end - 2, mark("wikilink cm-wikilink", { "data-target": target }));
        add(end - 2, end, hide);
      }
      TAG.lastIndex = 0;
      while ((m = TAG.exec(text))) {
        const start = from + m.index + m[1].length;
        const end = start + 1 + m[2].length;
        const tree2 = tree.resolveInner(start, 1);
        if (/Code|URL|LinkMark/.test(tree2.name)) continue;
        const important = m[2].toLowerCase() === "important";
        add(start, end, mark(important ? "cm-tag cm-tag-important" : "cm-tag"));
        if (important) {
          const l = doc.lineAt(start);
          add(l.from, l.from, line("cm-important"));
        }
      }
    }
    return Decoration.set(out, true);
  }

  const livePlugin = (hooks) => ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = build(view, hooks); }
    update(u) {
      if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged ||
          syntaxTree(u.startState) !== syntaxTree(u.state)) {
        this.decorations = build(u.view, hooks);
      }
    }
  }, { decorations: v => v.decorations });

  const style = HighlightStyle.define([
    { tag: tags.heading, fontWeight: "700" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strong, fontWeight: "700" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.monospace, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "0.9em" },
    { tag: tags.url, color: "var(--leaf)" },
    { tag: tags.link, color: "var(--leaf)" },
    { tag: tags.quote, color: "var(--mute)" },
    { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: "var(--faint)" }
  ]);

  // [[ completes note titles.
  function wikiCompletions(hooks) {
    return (ctx) => {
      const before = ctx.matchBefore(/\[\[[^\]\n]*$/);
      if (!before) return null;
      const from = before.from + 2;
      const closed = ctx.state.sliceDoc(ctx.pos, ctx.pos + 2) === "]]";
      return {
        from,
        validFor: /^[^\]\n]*$/,
        options: hooks.titles().map(title => ({
          label: title,
          type: "text",
          apply: (view, completion, f, t) => {
            const insert = closed ? title : `${title}]]`;
            view.dispatch({
              changes: { from: f, to: t, insert },
              selection: { anchor: f + title.length + 2 }
            });
          }
        }))
      };
    };
  }

  // # completes tags used in the vault; "important" is always offered.
  function tagCompletions(hooks) {
    return (ctx) => {
      const before = ctx.matchBefore(/(?:^|[\s(])#[\w/-]*$/);
      if (!before) return null;
      const hash = before.text.lastIndexOf("#");
      const from = before.from + hash + 1;
      const typed = ctx.state.sliceDoc(from, ctx.pos).toLowerCase();
      const lineStart = ctx.state.doc.lineAt(ctx.pos).from;
      if (from - 1 === lineStart && !typed) return null; // "#" at line start is likely a heading
      const all = ["important", ...((hooks.tags && hooks.tags()) || [])];
      const seen = new Set();
      const options = all.filter(tag => {
        const key = tag.toLowerCase();
        if (seen.has(key) || key === typed) return false;
        seen.add(key);
        return true;
      }).map(tag => ({ label: tag, displayLabel: `#${tag}`, apply: `${tag} `, type: "keyword" }));
      if (!options.length) return null;
      return { from, options, validFor: /^[\w/-]*$/ };
    };
  }

  function create(parent, body, hooks) {
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: body,
        extensions: [
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentUnit.of("  "),
          EditorState.tabSize.of(2),
          markdown({ base: markdownLanguage, extensions: [GFM], addKeymap: false }),
          syntaxHighlighting(style),
          closeBrackets(),
          autocompletion({ override: [wikiCompletions(hooks), tagCompletions(hooks)], icons: false }),
          bangToImportant,
          highlightSelectionMatches(),
          placeholder("Start writing. Tab on an empty line makes a task, !! marks it important, [[ links a note."),
          EditorView.lineWrapping,
          livePlugin(hooks),
          keymap.of([
            ...completionKeymap,
            { key: "Mod-Enter", run: toggleTaskAtCursor },
            { key: "Mod-l", run: toggleTaskAtCursor },
            { key: "Tab", run: tabTask, shift: indentLess },
            ...closeBracketsKeymap,
            ...markdownKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...defaultKeymap
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) hooks.onChange(u.state.doc.toString(), u);
          }),
          EditorView.domEventHandlers({
            mousedown(e) {
              const wiki = e.target.closest && e.target.closest(".cm-wikilink");
              if (wiki && e.button === 0 && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                hooks.openTarget(wiki.dataset.target);
                return true;
              }
              const link = e.target.closest && e.target.closest(".cm-link, .cm-url");
              const wantsOpen = link && e.button === 0 && (link.classList.contains("cm-link") || e.metaKey || e.ctrlKey);
              if (wantsOpen && /^https?:\/\//i.test(link.dataset.url || "")) {
                e.preventDefault();
                window.open(link.dataset.url, "_blank", "noopener,noreferrer");
                return true;
              }
              return false;
            }
          }),
          EditorView.contentAttributes.of({ "aria-label": "Note text", spellcheck: "true" })
        ]
      })
    });
    return view;
  }
  // Swap the whole text when the note changed elsewhere, keeping the cursor.
  function replaceDoc(view, body) {
    const current = view.state.doc.toString();
    if (current === body) return;
    let start = 0;
    while (start < current.length && start < body.length && current[start] === body[start]) start++;
    let endA = current.length;
    let endB = body.length;
    while (endA > start && endB > start && current[endA - 1] === body[endB - 1]) { endA--; endB--; }
    view.dispatch({ changes: { from: start, to: endA, insert: body.slice(start, endB) }, userEvent: "sync" });
  }
  return { create, replaceDoc, toggleTaskAt };
})();
