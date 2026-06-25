# Fletch Playground

Browser playground for the Fletch language: a CodeMirror 6 editor with syntax
highlighting and live diagnostics, backed by the Fletch VM compiled to WebAssembly.

## Status: Phase 1 (editor + highlighting)

The editor, highlighting, layout, and the diagnostics/wasm *seams* are in place.
The wasm module is stubbed, so `check` returns no diagnostics and `run` prints a
placeholder. Phase 2 is wiring the real VM.

## Run

```sh
npm install
npm run dev
```

## Structure

```
src/
  main.js               vanilla wiring: editor + run button + output
  style.css
  lang/
    fletch.js           StreamLanguage tokenizer (mirror of the Rust lexer)
    highlight.js        tag -> color mapping
  editor/
    setup.js            assembles the CodeMirror instance (imperative island)
    diagnostics.js      Rust Diagnostic -> CM linter; byte->UTF-16 offset fix
  wasm/
    fletch.js           wasm bridge (stubbed); documents the export contract
```

## Phase 2: wiring the VM

Compile the VM to wasm with wasm-bindgen targeting `wasm32-unknown-unknown`,
exporting two functions that mirror the compiler's analysis/synthesis split:

- `check(source) -> Diagnostic[]` — runs lex/parse/resolve/typecheck, stops at
  the bail-out gate, serializes `DiagCtx` (serde + serde-wasm-bindgen). Does NOT
  run the VM. This backs the live linter.
- `run(source, printCb) -> result` — full pipeline including the VM. The `print`
  builtin calls `printCb` (a JS function) instead of stdout.

Drop the wasm-bindgen output into `src/wasm/` and replace the stub imports in
`src/wasm/fletch.js`. The Vite wasm + top-level-await plugins are already
configured.

### Diagnostic shape (Rust -> JS)

Serialize each `Diagnostic` to:

```ts
interface FletchDiagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  primary: { start: number; end: number };   // BYTE offsets
  labels?: { span: { start: number; end: number }; message: string }[];
  notes?: string[];
}
```

`primary` underlines the error; each `label` becomes a secondary "defined here"
annotation at its own span (this is where the def-site spans stored in
`BindingInfo` surface in the UI). Spans are byte offsets; the linter converts
them to UTF-16 positions for CodeMirror.

## On adding a framework

Currently vanilla. CodeMirror owns its DOM imperatively, so a framework adds
nothing to the editor itself. If the surrounding shell grows enough that manual
DOM sync chafes, add Solid (its fine-grained reactivity coexists with the
imperative editor island better than reconciler frameworks) for the shell only,
leaving the editor mounted once and driven through its transaction API.

## Keeping highlighting honest

`lang/fletch.js` duplicates the lexer's keyword/type lists. When you change the
real lexer, update this. For a demo a stream tokenizer is enough; graduate to a
Lezer grammar only if you need incremental parsing, folding, or structural
indentation.
