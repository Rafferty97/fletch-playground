import { EditorView } from "@codemirror/view";
import { createEditor } from "./editor/setup.js";
import { check, run } from "./wasm/fletch.js";

// Vanilla wiring. No framework yet — the page is an editor island plus a couple
// of imperative DOM updates (output, status). If the surrounding shell grows
// (diagnostics list, examples selector, share button) and the manual DOM sync
// starts to chafe, that's the signal to add Solid for the shell while leaving
// the CodeMirror island exactly as-is.

const SAMPLE = `
fn main() {
    print("Hello world")
}
`.trimStart();

const outputEl = document.getElementById("output")!;
const statusEl = document.getElementById("status")!;
const runBtn = document.getElementById("run-btn")!;

const view = createEditor({
  parent: document.getElementById("editor"),
  doc: localStorage.getItem("source") ?? SAMPLE,
  check,
});

function appendOutput(text: string) {
  outputEl.textContent += text;
  outputEl.scrollTop = outputEl.scrollHeight;
}

function setStatus(text: string) {
  statusEl.textContent = text;
}

runBtn.addEventListener("click", async () => {
  outputEl.textContent = "";
  setStatus("running…");
  const source = view.state.doc.toString();
  try {
    await run(source, appendOutput);
    setStatus("done");
  } catch (err) {
    appendOutput("\n[error] " + String(err) + "\n");
    setStatus("error");
  }
});

let saveTimer: ReturnType<typeof setTimeout> | undefined;
EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem("source", update.state.doc.toString());
    }, 200);
  }
});

window.addEventListener("beforeunload", () => {
  localStorage.setItem("source", view.state.doc.toString());
});
