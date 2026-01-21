import { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { livePreviewPreset } from "@yuya296/cm6-live-preview";
import { tableEditor as vanillaTableEditor } from "@yuya296/cm6-table-editor-vanilla";
import { createEditor, EditorHandle } from "./editor/createEditor";
import { editorHighlightStyle } from "./editor/editorHighlightStyle";
import { editorTheme } from "./editor/editorTheme";
import "./style.scss";

type MarkBloomConfig = {
  livePreview: {
    enabled: boolean;
    inlineRadius: number;
  };
  table: {
    enabled: boolean;
  };
};

type HostMessage =
  | {
      type: "initDocument";
      uri: string;
      text: string;
      version: number;
    }
  | {
      type: "setConfig";
      config: MarkBloomConfig;
    };

type WebviewMessage =
  | { type: "ready" }
  | { type: "requestSave" }
  | {
      type: "didChangeText";
      uri: string;
      text: string;
      version: number;
    };

type ExtensionOptions = {
  wrapLines: boolean;
  tabSize: number;
  livePreviewEnabled: boolean;
  tableEnabled: boolean;
  editable: boolean;
};

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewMessage): void;
};

const vscode = acquireVsCodeApi();
const editorHost = document.getElementById("editor");
const appRoot = document.getElementById("app");
const toggleEditModeButton = document.getElementById(
  "toggle-edit-mode"
) as HTMLButtonElement | null;
const toggleWidthButton = document.getElementById(
  "toggle-width"
) as HTMLButtonElement | null;
const status = document.getElementById("status");
const changeInfo = document.getElementById("change-info");

if (!editorHost) {
  throw new Error("Missing editor host element");
}

let editor: EditorHandle | null = null;
let currentUri = "";
let currentVersion = 0;
let currentConfig: MarkBloomConfig = {
  livePreview: { enabled: true, inlineRadius: 6 },
  table: { enabled: true },
};
let applyingRemoteUpdate = false;
let isEditable = true;
let widthMode: "default" | "wide" = "default";
let toastTimer: number | null = null;

const viewModeToast = document.createElement("div");
viewModeToast.className = "view-mode-toast";
viewModeToast.textContent = "View mode active. Switch to edit to make changes.";
appRoot?.appendChild(viewModeToast);

const postMessage = (message: WebviewMessage) => {
  vscode.postMessage(message);
};

const buildExtensions = ({
  wrapLines,
  tabSize,
  livePreviewEnabled,
  tableEnabled,
  editable,
}: ExtensionOptions): Extension[] => {
  const extensions: Extension[] = [];

  if (wrapLines) {
    extensions.push(EditorView.lineWrapping);
  }

  if (Number.isFinite(tabSize)) {
    extensions.push(EditorState.tabSize.of(tabSize));
  }

  extensions.push(editorHighlightStyle());
  extensions.push(editorTheme());

  if (!editable) {
    extensions.push(EditorView.editable.of(false));
    extensions.push(EditorState.readOnly.of(true));
  }

  if (livePreviewEnabled) {
    extensions.push(
      livePreviewPreset({
        livePreview: {
          blockRevealEnabled: true,
        },
      })
    );
  }

  if (tableEnabled) {
    extensions.push(vanillaTableEditor());
  }

  return extensions;
};

const applyConfig = () => {
  if (!editor) {
    return;
  }
  editor.setExtensions(
    buildExtensions({
      wrapLines: true,
      tabSize: 4,
      livePreviewEnabled: currentConfig.livePreview.enabled,
      tableEnabled: currentConfig.table.enabled,
      editable: isEditable,
    })
  );
};

const replaceEditorText = (text: string) => {
  if (!editor) {
    return;
  }
  const view = editor.view;
  const currentText = view.state.doc.toString();
  if (currentText === text) {
    return;
  }
  applyingRemoteUpdate = true;
  view.dispatch({
    changes: {
      from: 0,
      to: currentText.length,
      insert: text,
    },
  });
  applyingRemoteUpdate = false;
};

const ensureEditor = (text: string) => {
  if (editor) {
    replaceEditorText(text);
    return;
  }

  editor = createEditor({
    parent: editorHost,
    initialText: text,
    extensions: buildExtensions({
      wrapLines: true,
      tabSize: 4,
      livePreviewEnabled: currentConfig.livePreview.enabled,
      tableEnabled: currentConfig.table.enabled,
      editable: isEditable,
    }),
    onChange: (nextText) => {
      if (applyingRemoteUpdate) {
        return;
      }
      currentVersion += 1;
      if (status) {
        status.textContent = `Length: ${nextText.length}`;
      }
      if (changeInfo) {
        changeInfo.textContent = `Last change at ${new Date().toLocaleTimeString()}`;
      }
      if (currentUri) {
        postMessage({
          type: "didChangeText",
          uri: currentUri,
          text: nextText,
          version: currentVersion,
        });
      }
    },
  });
};

window.addEventListener("message", (event: MessageEvent<HostMessage>) => {
  const message = event.data;
  switch (message.type) {
    case "initDocument":
      currentUri = message.uri;
      currentVersion = message.version;
      ensureEditor(message.text);
      return;
    case "setConfig":
      currentConfig = message.config;
      applyConfig();
      return;
    default:
      return;
  }
});

window.addEventListener("keydown", (event) => {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const modifier = isMac ? event.metaKey : event.ctrlKey;
  if (modifier && event.key.toLowerCase() === "s") {
    event.preventDefault();
    postMessage({ type: "requestSave" });
  }
});

postMessage({ type: "ready" });

const updateEditModeUi = () => {
  if (appRoot) {
    appRoot.dataset.editable = isEditable ? "true" : "false";
  }
  if (toggleEditModeButton) {
    toggleEditModeButton.setAttribute("aria-pressed", String(isEditable));
    toggleEditModeButton.title = isEditable
      ? "Switch to view mode"
      : "Switch to edit mode";
  }
};

const updateWidthUi = () => {
  if (appRoot) {
    appRoot.dataset.width = widthMode;
  }
  if (toggleWidthButton) {
    const isWide = widthMode === "wide";
    toggleWidthButton.setAttribute("aria-pressed", String(isWide));
    toggleWidthButton.title = isWide
      ? "Switch to default width"
      : "Switch to wide layout";
  }
};

toggleEditModeButton?.addEventListener("click", () => {
  isEditable = !isEditable;
  updateEditModeUi();
  applyConfig();
});

toggleWidthButton?.addEventListener("click", () => {
  widthMode = widthMode === "wide" ? "default" : "wide";
  updateWidthUi();
});

updateEditModeUi();
updateWidthUi();

editorHost?.addEventListener(
  "pointerdown",
  (event) => {
    if (isEditable) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    editor?.view.dom.blur();
    viewModeToast.dataset.visible = "true";
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(() => {
      viewModeToast.removeAttribute("data-visible");
    }, 1600);
  },
  { capture: true }
);
