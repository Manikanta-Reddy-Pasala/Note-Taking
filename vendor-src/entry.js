// Editor bundle for Folia. Rebuild: cd vendor-src && npm install && npm run build
export { EditorState, StateField, StateEffect, RangeSetBuilder, Compartment, EditorSelection } from "@codemirror/state";
export { EditorView, ViewPlugin, Decoration, WidgetType, keymap, placeholder, drawSelection, highlightActiveLine, dropCursor } from "@codemirror/view";
export { history, defaultKeymap, historyKeymap, indentWithTab, indentMore, indentLess } from "@codemirror/commands";
export { markdown, markdownLanguage, markdownKeymap } from "@codemirror/lang-markdown";
export { syntaxTree, syntaxHighlighting, HighlightStyle, indentUnit } from "@codemirror/language";
export { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
export { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
export { tags } from "@lezer/highlight";
export { GFM } from "@lezer/markdown";
