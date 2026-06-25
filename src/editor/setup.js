import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
} from "@codemirror/language";
import { lintGutter } from "@codemirror/lint";

import { fletchLanguage } from "../lang/fletch.js";
import { fletchHighlighting } from "../lang/highlight.js";
import { fletchLinter } from "./diagnostics";

// CodeMirror owns its own DOM and state imperatively. We mount it once here and
// never let anything outside re-render this subtree — it's an imperative island.
// If you add Solid later for the surrounding shell (output pane, controls), keep
// this island mounted once in an effect and drive it only through `view`'s
// transaction API, never by re-rendering.
export function createEditor({ parent, doc, check }) {
  const state = EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      indentOnInput(),
      indentUnit.of("    "),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      fletchLanguage,
      fletchHighlighting,
      lintGutter(),
      fletchLinter(check),
      EditorView.theme(
        {
          "&": { height: "100%", fontSize: "14px" },
          ".cm-scroller": {
            fontFamily:
              "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
          },
        },
        { dark: true },
      ),
    ],
  });

  return new EditorView({ state, parent });
}
