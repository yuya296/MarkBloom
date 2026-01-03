import { EditorState, Extension } from "@codemirror/state";
import { lineNumbers, EditorView } from "@codemirror/view";
import initialText from "../assets/sample.md?raw";
import { createEditor } from "./createEditor";

type ExtensionOptions = {
  showLineNumbers: boolean;
  wrapLines: boolean;
  tabSize: number;
};

function buildExtensions({ showLineNumbers, wrapLines, tabSize }: ExtensionOptions): Extension[] {
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
    lineNumbers: document.getElementById("toggle-line-numbers") as HTMLInputElement | null,
    wrap: document.getElementById("toggle-wrap") as HTMLInputElement | null,
    tabSize: document.getElementById("tab-size") as HTMLInputElement | null,
    apply: document.getElementById("apply") as HTMLButtonElement | null,
  };

  if (!controls.lineNumbers || !controls.wrap || !controls.tabSize || !controls.apply) {
    throw new Error("Missing control elements");
  }

  const editor = createEditor({
    parent: editorHost,
    initialText,
    extensions: buildExtensions({
      showLineNumbers: controls.lineNumbers.checked,
      wrapLines: controls.wrap.checked,
      tabSize: Number(controls.tabSize.value),
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
        showLineNumbers: controls.lineNumbers.checked,
        wrapLines: controls.wrap.checked,
        tabSize: Number(controls.tabSize.value),
      })
    );
  };

  controls.apply?.addEventListener("click", applyExtensions);

  return editor;
}
