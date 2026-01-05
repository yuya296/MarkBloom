import { EditorState, Extension } from "@codemirror/state";
import { lineNumbers, EditorView } from "@codemirror/view";
import initialText from "../assets/sample.md?raw";
import { createEditor } from "./createEditor";

type ExtensionOptions = {
  showLineNumbers: boolean;
  wrapLines: boolean;
  tabSize: number;
};

function buildExtensions({
  showLineNumbers,
  wrapLines,
  tabSize,
}: ExtensionOptions): Extension[] {
  const extensions: Extension[] = [];

  if (showLineNumbers) {
    extensions.push(lineNumbers());
  }

  if (wrapLines) {
    extensions.push(EditorView.lineWrapping);
  }

  if (Number.isFinite(tabSize)) {
    extensions.push(EditorState.tabSize.of(tabSize));
  }

  return extensions;
}

export function setupApp() {
  const editorHost = document.getElementById("editor");
  const status = document.getElementById("status");
  const changeInfo = document.getElementById("change-info");

  if (!editorHost) {
    throw new Error("Missing editor host element");
  }

  const controls = {
    lineNumbers: document.getElementById("toggle-line-numbers"),
    wrap: document.getElementById("toggle-wrap"),
    tabSize: document.getElementById("tab-size"),
    apply: document.getElementById("apply"),
  };

  if (
    !(controls.lineNumbers instanceof HTMLInputElement) ||
    !(controls.wrap instanceof HTMLInputElement) ||
    !(controls.tabSize instanceof HTMLInputElement) ||
    !(controls.apply instanceof HTMLButtonElement)
  ) {
    throw new Error("Missing control elements");
  }

  const lineNumbersControl = controls.lineNumbers;
  const wrapControl = controls.wrap;
  const tabSizeControl = controls.tabSize;
  const applyControl = controls.apply;

  const editor = createEditor({
    parent: editorHost,
    initialText,
    extensions: buildExtensions({
      showLineNumbers: lineNumbersControl.checked,
      wrapLines: wrapControl.checked,
      tabSize: Number(tabSizeControl.value),
    }),
    onChange: (text) => {
      if (status) {
        status.textContent = `Length: ${text.length}`;
      }
      if (changeInfo) {
        changeInfo.textContent = `Last change at ${new Date().toLocaleTimeString()}`;
      }
    },
  });

  const applyExtensions = () => {
    editor.setExtensions(
      buildExtensions({
        showLineNumbers: lineNumbersControl.checked,
        wrapLines: wrapControl.checked,
        tabSize: Number(tabSizeControl.value),
      })
    );
  };

  applyControl.addEventListener("click", applyExtensions);

  return editor;
}
