import { EditorState, Extension } from "@codemirror/state";
import { lineNumbers, EditorView } from "@codemirror/view";
import initialText from "../assets/sample.md?raw";
import { livePreview } from "cm6-live-preview";
import { createEditor } from "./createEditor";

type ExtensionOptions = {
  showLineNumbers: boolean;
  wrapLines: boolean;
  tabSize: number;
  livePreviewEnabled: boolean;
  blockRevealEnabled: boolean;
};

function buildExtensions({
  showLineNumbers,
  wrapLines,
  tabSize,
  livePreviewEnabled,
  blockRevealEnabled,
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

  if (livePreviewEnabled) {
    extensions.push(
      livePreview({
        blockRevealMode: blockRevealEnabled ? "block" : "line",
      })
    );
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
    livePreview: document.getElementById("toggle-live-preview"),
    blockReveal: document.getElementById("toggle-block-reveal"),
    tabSize: document.getElementById("tab-size"),
    apply: document.getElementById("apply"),
  };

  if (
    !(controls.lineNumbers instanceof HTMLInputElement) ||
    !(controls.wrap instanceof HTMLInputElement) ||
    !(controls.livePreview instanceof HTMLInputElement) ||
    !(controls.blockReveal instanceof HTMLInputElement) ||
    !(controls.tabSize instanceof HTMLInputElement) ||
    !(controls.apply instanceof HTMLButtonElement)
  ) {
    throw new Error("Missing control elements");
  }

  const editor = createEditor({
    parent: editorHost,
    initialText,
    extensions: buildExtensions({
      showLineNumbers: controls.lineNumbers.checked,
      wrapLines: controls.wrap.checked,
      livePreviewEnabled: controls.livePreview.checked,
      blockRevealEnabled: controls.blockReveal.checked,
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
        livePreviewEnabled: controls.livePreview.checked,
        blockRevealEnabled: controls.blockReveal.checked,
        tabSize: Number(controls.tabSize.value),
      })
    );
  };

  controls.apply.addEventListener("click", applyExtensions);

  return editor;
}
