// ---------------------------------------------------------------------------
// WASM bridge (phase two).
//
// When you compile the Fletch VM to wasm via wasm-bindgen, you'll get a JS
// module (e.g. `fletch_wasm.js` + `fletch_wasm_bg.wasm`) exporting an `init`
// default function plus your `#[wasm_bindgen]` exports. Drop those files into
// src/wasm/ and replace the stub bodies below with real imports:
//
//   import init, { check as wasmCheck, run as wasmRun } from "./fletch_wasm.js";
//
// Recommended Rust-side surface (mirrors the analysis/synthesis split you built
// into the compiler — `check` stops at the gate, `run` goes through the VM):
//
//   #[wasm_bindgen]
//   pub fn check(source: &str) -> JsValue {
//       // lex -> parse -> resolve -> typecheck, collect DiagCtx,
//       // serialize Vec<Diagnostic> via serde_wasm_bindgen.
//   }
//
//   #[wasm_bindgen]
//   pub fn run(source: &str, print_cb: &js_sys::Function) -> JsValue {
//       // full pipeline incl. VM. `print` builtin calls print_cb instead of
//       // stdout (no stdout in the browser). Return result/diagnostics.
//   }
//
// The `print_cb` is how your all-Rust `print` builtin reaches the UI in the
// browser: on the wasm target, the builtin invokes this JS callback rather than
// writing to stdout — one builtin whose body differs by target.
// ---------------------------------------------------------------------------

let ready: Promise<{
  check: (src: string) => any;
  run: (src: string, printCb: (msg: string) => void) => void;
}> | null = null;

/**
 * Initialize the wasm module once. Idempotent.
 * Returns a promise resolving to { check, run } or null if wasm isn't present.
 */
export function loadFletch() {
  if (ready) return ready;
  ready = (async () => {
    try {
      // Phase two: uncomment and point at your wasm-bindgen output.
      const mod = await import("fletch-wasm");
      await mod.default();
      return { check: mod.check, run: mod.run };
    } catch (err) {
      console.warn("Fletch wasm not available:", err);
      return { check: () => {}, run: () => {} };
    }
  })();
  return ready;
}

// Dev fallback `check`: until wasm is wired, return no diagnostics so the
// editor's linter is a no-op rather than erroring.
export async function check(source: string) {
  const fletch = await loadFletch();
  if (fletch && fletch.check) {
    return fletch.check(source);
  }
  return [];
}

// Dev fallback `run`: echoes a placeholder until wasm is wired.
export async function run(source: string, printCb: (msg: string) => void) {
  const fletch = await loadFletch();
  if (fletch && fletch.run) {
    return fletch.run(source, printCb);
  }
  printCb("[wasm not loaded — wire up src/wasm/ to run Fletch]\n");
  return null;
}
