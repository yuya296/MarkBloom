import { Decoration, WidgetType } from "@codemirror/view";

export type MermaidWidgetMode = "replace" | "append";

type MermaidWidgetOptions = {
  className: string;
  errorClassName: string;
  mode: MermaidWidgetMode;
};

class MermaidWidget extends WidgetType {
  private static initialized = false;
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

      if (!MermaidWidget.initialized) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
        });
        MermaidWidget.initialized = true;
      }

      const id = `cm-lp-mermaid-${MermaidWidget.sequence++}`;
      const { svg, bindFunctions } = await mermaid.render(id, source);
      if (!container.isConnected) {
        return;
      }
      container.innerHTML = svg;
      bindFunctions?.(container);
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
  initialize: (options: { startOnLoad: boolean; securityLevel: "strict" | "loose" }) => void;
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
