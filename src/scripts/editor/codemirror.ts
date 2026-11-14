// The sketch editor: CodeMirror 6 with C++ highlighting. Loaded only when
// someone presses "Edit and build", so pages that never edit never download it.
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle, indentUnit } from "@codemirror/language";
import { cpp } from "@codemirror/lang-cpp";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { tags as t } from "@lezer/highlight";
import { errorRange, type CompileError } from "../../lib/compile-client";
import { FIRMWARE } from "../../i18n/strings/firmware";
import { pageLocale, translator } from "../../i18n/t";

const tr = translator(FIRMWARE, pageLocale());

export interface SketchEditor {
  getCode(): string;
  setCode(code: string): void;
  showErrors(errors: CompileError[]): void;
  clearErrors(): void;
  goTo(line: number, col: number): void;
  focus(): void;
  destroy(): void;
}

// Colours come from the site's CSS variables, so the editor follows the light and dark themes.
const theme = EditorView.theme({
  "&": {
    color: "var(--term-ink)",
    backgroundColor: "var(--term-bg)",
    fontSize: "0.82rem",
    borderRadius: "2px",
  },
  ".cm-content": { fontFamily: "var(--mono)", caretColor: "var(--term-ink)", padding: "10px 0" },
  ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "1.55" },
  "&.cm-focused": { outline: "2px solid var(--accent)", outlineOffset: "2px" },
  ".cm-gutters": { backgroundColor: "var(--term-bg)", color: "var(--term-dim)", border: "none" },
  ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.04)" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.06)", color: "var(--term-ink)" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--term-ink)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "rgba(143,199,255,0.25)" },
  ".cm-matchingBracket": { backgroundColor: "rgba(226,183,85,0.25)", outline: "1px solid rgba(226,183,85,0.6)" },
  ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy #ff8a75", textUnderlineOffset: "3px" },
  ".cm-tooltip": { backgroundColor: "var(--panel)", color: "var(--ink)", border: "1px solid var(--line)" },
  ".cm-diagnostic-error": { borderLeft: "4px solid var(--accent)" },
}, { dark: true });

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.modifier, t.definitionKeyword], color: "#ff9e7a" },
  { tag: [t.typeName, t.standard(t.typeName)], color: "#8fc7ff" },
  { tag: [t.string, t.character], color: "#b5e08a" },
  { tag: [t.number, t.bool, t.null], color: "#e2b755" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--term-dim)", fontStyle: "italic" },
  { tag: [t.processingInstruction, t.meta], color: "#d6a5ff" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#ffd479" },
  { tag: t.macroName, color: "#d6a5ff" },
]);

export function mountEditor(parent: HTMLElement, code: string, onChange: (code: string) => void, label: string): SketchEditor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: code,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        highlightActiveLine(),
        indentUnit.of("  "),
        EditorState.tabSize.of(2),
        cpp(),
        syntaxHighlighting(highlight),
        lintGutter(),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        theme,
        EditorView.contentAttributes.of({ "aria-label": label }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChange(u.state.doc.toString());
        }),
      ],
    }),
  });

  return {
    getCode: () => view.state.doc.toString(),
    setCode(next) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
    },
    showErrors(errors) {
      const text = view.state.doc.toString();
      const diagnostics: Diagnostic[] = errors.map((e) => {
        const r = errorRange(text, e.line, e.col);
        return { from: r.from, to: r.to, severity: "error", message: e.message, source: tr("cmLine", { line: e.line }) };
      });
      view.dispatch(setDiagnostics(view.state, diagnostics));
    },
    clearErrors() {
      view.dispatch(setDiagnostics(view.state, []));
    },
    goTo(line, col) {
      const r = errorRange(view.state.doc.toString(), line, col);
      view.dispatch({ selection: { anchor: r.from, head: r.to }, effects: EditorView.scrollIntoView(r.from, { y: "center" }) });
      view.focus();
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
