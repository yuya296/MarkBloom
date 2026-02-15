import { Decoration, WidgetType } from "@codemirror/view";

export type MermaidWidgetMode = "replace" | "append";
export type MermaidThemeMode = "auto" | "light" | "dark";
type MermaidRuntimeTheme = "default" | "dark";

type MermaidWidgetOptions = {
  className: string;
  errorClassName: string;
  mode: MermaidWidgetMode;
  mermaidTheme: MermaidThemeMode;
};

class MermaidWidget extends WidgetType {
  private static initializedTheme: MermaidRuntimeTheme | null = null;
  private static sequence = 0;
  private static mermaidApi: MermaidApi | null | undefined;

  constructor(
    private readonly source: string,
    private readonly options: MermaidWidgetOptions
  ) {
    super();
  }

  eq(other: MermaidWidget): boolean {
    return (
      this.source === other.source &&
      this.options.className === other.options.className &&
      this.options.errorClassName === other.options.errorClassName &&
      this.options.mode === other.options.mode
    );
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = `${this.options.className} cm-lp-mermaid-${this.options.mode}`;

    const source = this.source.trim();
    if (!source) {
      wrapper.textContent = "(empty mermaid diagram)";
      return wrapper;
    }

    const container = document.createElement("div");
    container.className = "cm-lp-mermaid-content";
    wrapper.appendChild(container);
    void this.renderDiagram(source, container, wrapper);
    return wrapper;
  }

  private async renderDiagram(
    source: string,
    container: HTMLElement,
    wrapper: HTMLElement
  ) {
    try {
      const mermaid = await MermaidWidget.loadMermaidApi();
      if (!mermaid) {
        throw new Error("Mermaid runtime is not available");
      }

      const runtimeTheme = MermaidWidget.resolveRuntimeTheme(this.options.mermaidTheme);
      if (MermaidWidget.initializedTheme !== runtimeTheme) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: runtimeTheme,
        });
        MermaidWidget.initializedTheme = runtimeTheme;
      }

      const id = `cm-lp-mermaid-${MermaidWidget.sequence++}`;
      const { svg, bindFunctions } = await mermaid.render(id, source);
      if (!container.isConnected) {
        return;
      }
      container.innerHTML = svg;
      bindFunctions?.(container);
      this.attachOpenInNewTabButton(wrapper, container);
    } catch (error) {
      if (!container.isConnected) {
        return;
      }
      wrapper.classList.add(this.options.errorClassName);
      wrapper.setAttribute("data-error", "true");
      container.textContent =
        error instanceof Error
          ? `Mermaid render error: ${error.message}`
          : "Mermaid render error";
    }
  }

  private static resolveRuntimeTheme(theme: MermaidThemeMode): MermaidRuntimeTheme {
    if (theme === "light") {
      return "default";
    }
    if (theme === "dark") {
      return "dark";
    }
    return document.documentElement.dataset.theme === "dark" ? "dark" : "default";
  }

  private attachOpenInNewTabButton(wrapper: HTMLElement, container: HTMLElement) {
    const svg = container.querySelector("svg");
    if (!(svg instanceof SVGElement)) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-lp-mermaid-open-button";
    button.setAttribute("aria-label", "Open Mermaid preview in new tab");
    button.title = "Open Mermaid preview in new tab";
    button.textContent = "Open";

    const openPreview = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      MermaidWidget.openExternalPreview(svg.outerHTML);
    };

    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("click", openPreview);
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        openPreview(event);
      }
    });
    wrapper.appendChild(button);
  }

  private static openExternalPreview(svgMarkup: string) {
    const previewWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!previewWindow) {
      console.warn("Mermaid preview popup was blocked by the browser");
      return;
    }

    previewWindow.document.title = "Mermaid Preview";
    previewWindow.document.body.innerHTML = `<main class="mermaid-preview">${svgMarkup}</main>`;

    const style = previewWindow.document.createElement("style");
    style.textContent = `
      :root { color-scheme: light dark; }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #f6f8fa;
      }
      .mermaid-preview {
        min-height: 100%;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .mermaid-preview svg {
        width: min(96vw, 1400px);
        height: auto;
      }
    `;
    previewWindow.document.head.appendChild(style);
  }

  private static async loadMermaidApi(): Promise<MermaidApi | null> {
    if (MermaidWidget.mermaidApi !== undefined) {
      return MermaidWidget.mermaidApi;
    }

    const fromWindow = globalThis as typeof globalThis & {
      mermaid?: MermaidApi;
    };
    if (fromWindow.mermaid) {
      MermaidWidget.mermaidApi = fromWindow.mermaid;
      return MermaidWidget.mermaidApi;
    }

    try {
      const imported = await import("mermaid");
      const candidate = (imported.default ?? imported) as Partial<MermaidApi>;
      if (
        typeof candidate.initialize === "function" &&
        typeof candidate.render === "function"
      ) {
        MermaidWidget.mermaidApi = candidate as MermaidApi;
        return MermaidWidget.mermaidApi;
      }
    } catch {
      MermaidWidget.mermaidApi = null;
      return MermaidWidget.mermaidApi;
    }

    MermaidWidget.mermaidApi = null;
    return MermaidWidget.mermaidApi;
  }
}

type MermaidApi = {
  initialize: (options: {
    startOnLoad: boolean;
    securityLevel: "strict" | "loose";
    theme: MermaidRuntimeTheme;
  }) => void;
  render: (
    id: string,
    source: string
  ) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>;
};

export function mermaidBlockReplace(
  source: string,
  options: Omit<MermaidWidgetOptions, "mode">
): Decoration {
  return Decoration.replace({
    block: true,
    inclusive: false,
    widget: new MermaidWidget(source, {
      ...options,
      mode: "replace",
    }),
  });
}

export function mermaidBlockWidget(
  source: string,
  options: Omit<MermaidWidgetOptions, "mode">
): Decoration {
  return Decoration.widget({
    block: true,
    side: 1,
    widget: new MermaidWidget(source, {
      ...options,
      mode: "append",
    }),
  });
}
