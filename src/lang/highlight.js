import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// Minimal, legible highlight style. Tweak freely — this is presentation, not
// structure. Colors are chosen to read on the dark editor background in
// style.css.
const fletchHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#c792ea" },
  { tag: t.comment, color: "#637777", fontStyle: "italic" },
  { tag: t.string, color: "#ecc48d" },
  { tag: t.number, color: "#f78c6c" },
  { tag: t.typeName, color: "#82aaff" },
  { tag: t.variableName, color: "#d6deeb" },
  { tag: t.operator, color: "#7fdbca" },
]);

export const fletchHighlighting = syntaxHighlighting(fletchHighlightStyle);
