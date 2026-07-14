import { StreamLanguage } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// A StreamLanguage tokenizer rather than a full Lezer grammar: for a demo this
// is enough, and it mirrors the token categories your Rust `logos` lexer already
// produces. When/if you want incremental parsing, structural folding, or
// fully-correct indentation, graduate this to a Lezer grammar — but not before
// you need it.
//
// Keep this keyword list in sync with the real lexer. The point of highlighting
// is to reflect the language as it actually is, so when you add a keyword in
// Rust, add it here.
const KEYWORDS = new Set([
  "let",
  "var",
  "fn",
  "return",
  "if",
  "else",
  "while",
  "for",
  "in",
  "true",
  "false",
  "null",
  "oneof",
  "match",
]);

// Built-in / primitive type names get a distinct face from keywords.
const TYPES = new Set([
  "int8",
  "int16",
  "int32",
  "int64",
  "int",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "uint",
  "float32",
  "float64",
  "float",
  "bool",
  "str",
]);

// How many spaces one indent level is. Matches indentUnit in setup.js.
const INDENT_SIZE = 4;

export const fletchLanguage = StreamLanguage.define({
  name: "fletch",

  // State now tracks bracket nesting depth so `indent` (below) has something to
  // work from. `depth` counts unclosed openers ( { [ seen so far in code
  // positions only — never inside strings or comments, because those are
  // tokenized as whole units and we only adjust depth in the operator branch.
  startState() {
    return { depth: 0 };
  },

  token(stream, state) {
    // Whitespace.
    if (stream.eatSpace()) return null;

    // Line comments.
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    // Block comments (non-nesting; make nesting match the real lexer if needed).
    if (stream.match("/*")) {
      while (!stream.eol()) {
        if (stream.match("*/")) break;
        stream.next();
      }
      return "comment";
    }

    // String literals.
    if (stream.match('"')) {
      let escaped = false;
      while (!stream.eol()) {
        const ch = stream.next();
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          break;
        }
      }
      return "string";
    }

    // Numbers (int and float, with optional type suffix like 1i64 / 2.0f32).
    if (stream.match(/^\d[\d_]*(\.\d[\d_]*)?([iuf]\d{1,2})?/)) {
      return "number";
    }

    // Identifiers / keywords / types.
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      const word = stream.current();
      if (KEYWORDS.has(word)) return "keyword";
      if (TYPES.has(word)) return "typeName";
      // Heuristic: Capitalized => type-ish; lower => variable/function.
      if (/^[A-Z]/.test(word)) return "typeName";
      return "variableName";
    }

    // Brackets: adjust nesting depth. We handle these BEFORE the general
    // operator branch so the depth bookkeeping is isolated and obvious. Depth is
    // only ever touched here — in code positions — so braces inside strings or
    // comments (consumed above) never affect indentation.
    if (stream.match(/^[([{]/)) {
      state.depth++;
      return "operator";
    }
    if (stream.match(/^[)\]}]/)) {
      if (state.depth > 0) state.depth--;
      return "operator";
    }

    // Other operators and punctuation.
    if (stream.match(/^(==|!=|<=|>=|->|=>|::|&&|\|\||[-+*/%<>=!&|.,;:?])/)) {
      return "operator";
    }

    // Anything else: consume one char so we never stall.
    stream.next();
    return null;
  },

  // Compute the indentation (in spaces) for a line.
  //
  // `state` is the tokenizer state at the START of the line being indented, so
  // `state.depth` is the nesting level entering this line. `textAfter` is the
  // remaining text of the line (what comes after the indentation). If that text
  // begins with a closing bracket, this line closes a level, so it should sit
  // one level shallower than its contents — hence the dedent.
  //
  // This is the mechanism behind both behaviors:
  //   - Press Enter inside `{ }`: the new line's `state.depth` is higher, so it
  //     indents a level.
  //   - Type `}` on a fresh line: `indentOnInput` (in setup.js) re-runs this,
  //     `textAfter` starts with `}`, the dedent fires, and the brace snaps back
  //     to its opener's level.
  indent(state, textAfter) {
    const closing = /^\s*[)\]}]/.test(textAfter);
    const depth = state.depth - (closing ? 1 : 0);
    return Math.max(0, depth) * INDENT_SIZE;
  },

  // languageData lets indentOnInput know which typed characters should trigger a
  // re-indent of the current line. Without this, typing `}` won't dedent.
  languageData: {
    indentOnInput: /^\s*[)\]}]$/,
    commentTokens: {
      line: "//",
      block: { open: "/*", close: "*/" }
    }
  },

  tokenTable: {
    keyword: t.keyword,
    comment: t.comment,
    string: t.string,
    number: t.number,
    typeName: t.typeName,
    variableName: t.variableName,
    operator: t.operator,
  },
});
