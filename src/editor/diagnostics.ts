import { Diagnostic } from "@codemirror/lint";
import { linter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";

// ---------------------------------------------------------------------------
// Diagnostics integration.
//
// This is the seam where your Rust `Diagnostic` becomes editor UI. Your wasm
// `check(source)` export should return an array of diagnostics in the shape
// below (serialize your `Diagnostic` struct with serde -> serde-wasm-bindgen):
//
//   interface FletchDiagnostic {
//     severity: "error" | "warning" | "info";
//     message: string;
//     // BYTE offsets into the source (your spans are byte-based from `logos`).
//     primary: { start: number; end: number };
//     // Secondary labels (e.g. "x defined here") — your BindingInfo spans.
//     labels?: { span: { start: number; end: number }; message: string }[];
//     // Trailing "note:" / "help:" lines.
//     notes?: string[];
//   }
//
// CodeMirror works in UTF-16 code-unit positions (JS string indices); your
// spans are byte offsets. For ASCII source they coincide, but the moment the
// source contains a multibyte character the offsets drift and underlines land
// in the wrong place. `byteToUtf16` below converts once, at this boundary.
// ---------------------------------------------------------------------------

type Severity = "hint" | "info" | "warning" | "error";

/**
 * Build a byte-offset -> UTF-16-index lookup for the given source.
 * Returns a function mapping a byte offset to a JS string index.
 */
function makeByteToUtf16(source: string) {
  const encoder = new TextEncoder();
  // Map each UTF-16 index to its starting byte offset, then invert lazily.
  // We build an array `byteAtUnit[i]` = byte offset of UTF-16 unit i.
  const byteAtUnit = new Array(source.length + 1);
  let byte = 0;
  for (let i = 0; i < source.length; ) {
    byteAtUnit[i] = byte;
    const cp = source.codePointAt(i)!;
    const units = cp > 0xffff ? 2 : 1; // surrogate pair?
    byte += encoder.encode(String.fromCodePoint(cp)).length;
    if (units === 2) byteAtUnit[i + 1] = byteAtUnit[i]; // both units share start
    i += units;
  }
  byteAtUnit[source.length] = byte;

  // Invert: given a byte offset, find the UTF-16 index. Binary search.
  return function byteToUtf16(targetByte: number) {
    if (targetByte <= 0) return 0;
    if (targetByte >= byte) return source.length;
    let lo = 0;
    let hi = source.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (byteAtUnit[mid] < targetByte) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
}

type FletchDiagnostic = {
  level: string;
  primary: {
    message: string;
    span: { lo: number; hi: number };
  };
  secondary: {
    message: string;
    span: { lo: number; hi: number };
  }[];
  notes: string[];
};

/**
 * Translate one serialized FletchDiagnostic into one or more CM diagnostics.
 * The primary span is the main diagnostic; each label becomes a related
 * (separate) diagnostic anchored at its own span, which is how the def-site
 * "defined here" annotation surfaces in the editor.
 */
function toCmDiagnostics(
  fd: FletchDiagnostic,
  conv: (pos: number) => number,
): Diagnostic[] {
  const out = [];
  const notes = fd.notes && fd.notes.length ? "\n" + fd.notes.join("\n") : "";
  out.push({
    from: conv(fd.primary.span.lo),
    to: conv(fd.primary.span.hi),
    severity: fd.level.toLowerCase() as Severity,
    message: fd.primary.message + notes,
  });
  if (fd.secondary) {
    for (const label of fd.secondary) {
      out.push({
        from: conv(label.span.lo),
        to: conv(label.span.hi),
        severity: "info" as const,
        message: label.message,
      });
    }
  }
  return out;
}

/**
 * Create a CodeMirror linter extension backed by a `check` function.
 *
 * @param {(source: string) => FletchDiagnostic[] | Promise<FletchDiagnostic[]>} check
 *   Runs the Fletch front-end (lex -> parse -> resolve -> typecheck) and
 *   returns diagnostics WITHOUT executing the VM. This is your wasm `check`
 *   export. The analysis/synthesis boundary you built into the compiler is
 *   exactly this split: `check` stops at the gate; running the program is a
 *   separate `run` export (see runner.js).
 *
 * The `linter` helper debounces and re-runs on document change for us.
 */
export function fletchLinter(
  check: (source: string) => Promise<FletchDiagnostic[]>,
) {
  return linter(
    async (view: EditorView) => {
      const source = view.state.doc.toString();
      let diags;
      try {
        diags = await check(source);
      } catch (err) {
        // If the checker itself throws (panic in wasm, etc.), surface it
        // rather than silently dropping diagnostics.
        return [
          {
            from: 0,
            to: Math.min(source.length, 1),
            severity: "error",
            message: "Internal error while checking: " + String(err),
          },
        ];
      }
      if (!diags || diags.length === 0) return [];
      const conv = makeByteToUtf16(source);
      return diags.flatMap((fd) => toCmDiagnostics(fd, conv));
    },
    {
      // Re-lint shortly after typing stops. Tune to taste.
      delay: 200,
    },
  );
}
