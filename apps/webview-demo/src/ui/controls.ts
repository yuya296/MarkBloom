export type AppControls = {
  editorHost: HTMLElement;
  status: HTMLElement | null;
  changeInfo: HTMLElement | null;
  lineNumbers: HTMLInputElement;
  wrap: HTMLInputElement;
  livePreview: HTMLInputElement;
  blockReveal: HTMLInputElement;
  themeToggle: HTMLButtonElement;
  tabSize: HTMLInputElement;
  apply: HTMLButtonElement;
  settingsToggle: HTMLButtonElement;
  settingsPanel: HTMLDivElement;
};

function requireElement<T extends Element>(
  doc: Document,
  id: string,
  ctor: new () => T,
  label: string
): T {
  const el = doc.getElementById(id);
  if (!(el instanceof ctor)) {
    throw new Error(`Missing or wrong type for control element: ${label} (#${id})`);
  }
  return el;
}

export function queryAppControls(doc: Document = document): AppControls {
  const editorHost = doc.getElementById("editor");
  if (!editorHost) {
    throw new Error("Missing editor host element");
  }

  return {
    editorHost,
    status: doc.getElementById("status"),
    changeInfo: doc.getElementById("change-info"),
    lineNumbers: requireElement(doc, "toggle-line-numbers", HTMLInputElement, "lineNumbers"),
    wrap: requireElement(doc, "toggle-wrap", HTMLInputElement, "wrap"),
    livePreview: requireElement(doc, "toggle-live-preview", HTMLInputElement, "livePreview"),
    blockReveal: requireElement(doc, "toggle-block-reveal", HTMLInputElement, "blockReveal"),
    themeToggle: requireElement(doc, "toggle-theme", HTMLButtonElement, "themeToggle"),
    tabSize: requireElement(doc, "tab-size", HTMLInputElement, "tabSize"),
    apply: requireElement(doc, "apply", HTMLButtonElement, "apply"),
    settingsToggle: requireElement(doc, "settings-toggle", HTMLButtonElement, "settingsToggle"),
    settingsPanel: requireElement(doc, "settings-panel", HTMLDivElement, "settingsPanel"),
  };
}
