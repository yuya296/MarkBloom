import { EditorState, Extension } from "@codemirror/state";
import { lineNumbers, EditorView } from "@codemirror/view";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import initialText from "../assets/sample.md?raw";
import { livePreviewPreset } from "cm6-live-preview";
import { createEditor } from "./createEditor";
import { tableEditor as revogridTableEditor } from "cm6-table-editor";
import { tableEditor as tabulatorTableEditor } from "cm6-table-editor-tabulator";
import { tableEditor as toastuiTableEditor } from "cm6-table-editor-toastui";

type ExtensionOptions = {
  showLineNumbers: boolean;
  wrapLines: boolean;
  tabSize: number;
  livePreviewEnabled: boolean;
  blockRevealEnabled: boolean;
  tableEngine: "revogrid" | "tabulator" | "toastui" | "none";
};

function buildExtensions({
  showLineNumbers,
  wrapLines,
  tabSize,
  livePreviewEnabled,
  blockRevealEnabled,
  tableEngine,
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

  extensions.push(syntaxHighlighting(defaultHighlightStyle));

  if (livePreviewEnabled) {
    extensions.push(
      livePreviewPreset({
        livePreview: {
          blockRevealEnabled,
          imageBasePath: new URL("../assets/", import.meta.url).toString(),
          imageRawShowsPreview: true,
        },
      })
    );
  }

  if (tableEngine !== "none") {
    extensions.push(resolveTableEditor(tableEngine));
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
    tableEngine: document.getElementById("table-engine"),
    apply: document.getElementById("apply"),
  };

  if (
    !(controls.lineNumbers instanceof HTMLInputElement) ||
    !(controls.wrap instanceof HTMLInputElement) ||
    !(controls.livePreview instanceof HTMLInputElement) ||
    !(controls.blockReveal instanceof HTMLInputElement) ||
    !(controls.tabSize instanceof HTMLInputElement) ||
    !(controls.tableEngine instanceof HTMLSelectElement) ||
    !(controls.apply instanceof HTMLButtonElement)
  ) {
    throw new Error("Missing control elements");
  }

  const lineNumbersControl = controls.lineNumbers;
  const wrapControl = controls.wrap;
  const livePreviewControl = controls.livePreview;
  const blockRevealControl = controls.blockReveal;
  const tabSizeControl = controls.tabSize;
  const tableEngineControl = controls.tableEngine;
  const applyControl = controls.apply;

  const editor = createEditor({
    parent: editorHost,
    initialText,
    extensions: buildExtensions({
      showLineNumbers: lineNumbersControl.checked,
      wrapLines: wrapControl.checked,
      livePreviewEnabled: livePreviewControl.checked,
      blockRevealEnabled: blockRevealControl.checked,
      tabSize: Number(tabSizeControl.value),
      tableEngine: resolveTableEngine(tableEngineControl.value),
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
        livePreviewEnabled: livePreviewControl.checked,
        blockRevealEnabled: blockRevealControl.checked,
        tabSize: Number(tabSizeControl.value),
        tableEngine: resolveTableEngine(tableEngineControl.value),
      })
    );
  };

  applyControl.addEventListener("click", applyExtensions);

  return editor;
}

function resolveTableEngine(value: string): ExtensionOptions["tableEngine"] {
  if (value === "tabulator" || value === "toastui" || value === "none") {
    return value;
  }
  return "revogrid";
}

function resolveTableEditor(engine: ExtensionOptions["tableEngine"]): Extension {
  switch (engine) {
    case "tabulator":
      return tabulatorTableEditor({ editMode: "inlineCellEdit" });
    case "toastui":
      return toastuiTableEditor({ editMode: "inlineCellEdit" });
    case "none":
      return [];
    case "revogrid":
    default:
      return revogridTableEditor({ editMode: "inlineCellEdit" });
  }
}
