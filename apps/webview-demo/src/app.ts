import { EditorState, Extension } from "@codemirror/state";
import { lineNumbers, EditorView } from "@codemirror/view";
import initialText from "../assets/sample.md?raw";
import { diffGutter } from "@yuya296/cm6-diff-gutter";
import { livePreviewPreset } from "@yuya296/cm6-live-preview";
import { tableEditor as cm6TableEditor } from "@yuya296/cm6-table";
import { mermaidLivePreview } from "@yuya296/cm6-live-preview-mermaid";
import { createEditor } from "./createEditor";
import { editorTheme } from "./editorTheme";
import { editorHighlightStyle } from "./editorHighlightStyle";

type ExtensionOptions = {
  showLineNumbers: boolean;
  wrapLines: boolean;
  tabSize: number;
  livePreviewEnabled: boolean;
  blockRevealEnabled: boolean;
  diffBaselineText: string;
};

function isTableLine(lineText: string): boolean {
  const line = lineText.trim();
  if (line.length === 0 || !line.includes("|")) {
    return false;
  }
  if (/^\|?[-:\s]+(\|[-:\s]+)+\|?$/u.test(line)) {
    return true;
  }
  return /^\|.*\|$/u.test(line);
}

function buildExtensions({
  showLineNumbers,
  wrapLines,
  tabSize,
  livePreviewEnabled,
  blockRevealEnabled,
  diffBaselineText,
}: ExtensionOptions): Extension[] {
  const extensions: Extension[] = [];

  extensions.push(
    diffGutter({
      baselineText: diffBaselineText,
      ignoreLine: isTableLine,
    })
  );

  if (showLineNumbers) {
    extensions.push(lineNumbers());
  }

  if (wrapLines) {
    extensions.push(EditorView.lineWrapping);
  }

  if (Number.isFinite(tabSize)) {
    extensions.push(EditorState.tabSize.of(tabSize));
  }

  extensions.push(editorHighlightStyle());
  extensions.push(editorTheme());

  if (livePreviewEnabled) {
    const mermaid = mermaidLivePreview();
    extensions.push(...mermaid.extensions);
    extensions.push(
      livePreviewPreset({
        livePreview: {
          blockRevealEnabled,
          imageBasePath: new URL("../assets/", import.meta.url).toString(),
          imageRawShowsPreview: true,
          plugins: [mermaid.plugin],
        },
      })
    );
  }

  extensions.push(cm6TableEditor());

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
    themeToggle: document.getElementById("toggle-theme"),
    tabSize: document.getElementById("tab-size"),
    apply: document.getElementById("apply"),
    settingsMenu: document.getElementById("settings-menu"),
  };

  if (
    !(controls.lineNumbers instanceof HTMLInputElement) ||
    !(controls.wrap instanceof HTMLInputElement) ||
    !(controls.livePreview instanceof HTMLInputElement) ||
    !(controls.blockReveal instanceof HTMLInputElement) ||
    !(controls.themeToggle instanceof HTMLButtonElement) ||
    !(controls.tabSize instanceof HTMLInputElement) ||
    !(controls.apply instanceof HTMLButtonElement)
  ) {
    throw new Error("Missing control elements");
  }

  const lineNumbersControl = controls.lineNumbers;
  const wrapControl = controls.wrap;
  const livePreviewControl = controls.livePreview;
  const blockRevealControl = controls.blockReveal;
  const themeToggleControl = controls.themeToggle;
  const tabSizeControl = controls.tabSize;
  const applyControl = controls.apply;
  const settingsMenu = controls.settingsMenu;

  const setTheme = (nextTheme: "light" | "dark") => {
    document.documentElement.dataset.theme = nextTheme;
    themeToggleControl.setAttribute(
      "aria-pressed",
      nextTheme === "dark" ? "true" : "false"
    );
  };

  const prefersDark =
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  setTheme(prefersDark ? "dark" : "light");

  themeToggleControl.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  });

  const editor = createEditor({
    parent: editorHost,
    initialText,
    extensions: buildExtensions({
      showLineNumbers: lineNumbersControl.checked,
      wrapLines: wrapControl.checked,
      livePreviewEnabled: livePreviewControl.checked,
      blockRevealEnabled: blockRevealControl.checked,
      tabSize: Number(tabSizeControl.value),
      diffBaselineText: initialText,
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
        diffBaselineText: initialText,
      })
    );
    if (settingsMenu instanceof HTMLDetailsElement) {
      settingsMenu.open = false;
    }
  };

  applyControl.addEventListener("click", applyExtensions);

  return editor;
}
