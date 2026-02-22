import { Decoration, EditorView, WidgetType } from "@codemirror/view";

export type MermaidWidgetMode = "replace" | "append";
export type MermaidThemeMode = "auto" | "light" | "dark";
type MermaidRuntimeTheme = "default" | "dark";

type MermaidWidgetOptions = {
  className: string;
  errorClassName: string;
  mode: MermaidWidgetMode;
  mermaidTheme: MermaidThemeMode;
};

// cm-widget-measure: dynamic
class MermaidWidget extends WidgetType {
  private static initializedTheme: MermaidRuntimeTheme | null = null;
  private static sequence = 0;
  private static mermaidApi: MermaidApi | null | undefined;
  private static renderGenerations = new WeakMap<HTMLElement, number>();
  private static renderFrames = new WeakMap<HTMLElement, number>();
  private static resizeObservers = new WeakMap<HTMLElement, ResizeObserver>();
  private static pendingMeasureFrames = new WeakMap<EditorView, number>();
  private static readonly blockedSvgElements = new Set([
    "script",
    "foreignobject",
    "iframe",
    "object",
    "embed",
    "link",
    "meta",
  ]);

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
      this.options.mode === other.options.mode &&
      this.options.mermaidTheme === other.options.mermaidTheme
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
    container.textContent = "Rendering Mermaid...";
    wrapper.appendChild(container);
    MermaidWidget.attachMeasureObserver(wrapper, container);
    this.scheduleRender(source, container, wrapper);
    return wrapper;
  }

  updateDOM(dom: HTMLElement): boolean {
    const wrapper = dom;
    if (!wrapper.classList.contains(this.options.className)) {
      return false;
    }
    const container = wrapper.querySelector<HTMLElement>(".cm-lp-mermaid-content");
    const source = this.source.trim();
    if (!container) {
      return false;
    }
    if (!source) {
      wrapper.textContent = "(empty mermaid diagram)";
      return true;
    }

    const hasSvg = Boolean(container.querySelector("svg"));
    const hasError = wrapper.getAttribute("data-error") === "true";
    if (!hasSvg && !hasError) {
      this.scheduleRender(source, container, wrapper);
      return true;
    }

    if (hasSvg) {
      this.attachOpenInNewTabButton(wrapper, container);
    }
    return true;
  }

  destroy(dom: HTMLElement): void {
    MermaidWidget.detachMeasureObserver(dom);
  }

  private scheduleRender(source: string, container: HTMLElement, wrapper: HTMLElement) {
    const pendingFrame = MermaidWidget.renderFrames.get(container);
    if (typeof pendingFrame === "number") {
      cancelAnimationFrame(pendingFrame);
      MermaidWidget.renderFrames.delete(container);
    }

    const run = () => {
      if (!wrapper.isConnected) {
        const nextFrame = requestAnimationFrame(run);
        MermaidWidget.renderFrames.set(container, nextFrame);
        return;
      }
      MermaidWidget.renderFrames.delete(container);
      void this.renderDiagram(source, container, wrapper);
    };

    const frame = requestAnimationFrame(run);
    MermaidWidget.renderFrames.set(container, frame);
  }

  private static bumpRenderGeneration(container: HTMLElement): number {
    const generation = (MermaidWidget.renderGenerations.get(container) ?? 0) + 1;
    MermaidWidget.renderGenerations.set(container, generation);
    return generation;
  }

  private static isCurrentRenderGeneration(container: HTMLElement, generation: number): boolean {
    return MermaidWidget.renderGenerations.get(container) === generation;
  }

  private async renderDiagram(
    source: string,
    container: HTMLElement,
    wrapper: HTMLElement
  ) {
    const generation = MermaidWidget.bumpRenderGeneration(container);
    container.textContent = "Rendering Mermaid...";
    wrapper.classList.remove(this.options.errorClassName);
    wrapper.removeAttribute("data-error");

    try {
      let mermaid = await MermaidWidget.loadMermaidApi();
      if (!MermaidWidget.isMermaidApi(mermaid)) {
        // A polluted/stale global can pass through runtime environments unexpectedly.
        // Force a clean module import path before failing the widget.
        MermaidWidget.mermaidApi = undefined;
        mermaid = await MermaidWidget.loadMermaidApi({ skipGlobal: true });
      }
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
      if (!MermaidWidget.isCurrentRenderGeneration(container, generation)) {
        return;
      }
      const sanitizedSvg = MermaidWidget.parseAndSanitizeSvg(svg, container.ownerDocument);
      if (!sanitizedSvg) {
        throw new Error("Rendered Mermaid output is not valid SVG");
      }
      container.replaceChildren(sanitizedSvg);
      MermaidWidget.requestEditorMeasure(wrapper);
      bindFunctions?.(container);
      this.attachOpenInNewTabButton(wrapper, container);
    } catch (error) {
      if (!MermaidWidget.isCurrentRenderGeneration(container, generation)) {
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

  private static attachMeasureObserver(wrapper: HTMLElement, container: HTMLElement): void {
    MermaidWidget.detachMeasureObserver(wrapper);
    const observer = new ResizeObserver(() => {
      MermaidWidget.requestEditorMeasure(wrapper);
    });
    observer.observe(wrapper);
    observer.observe(container);
    MermaidWidget.resizeObservers.set(wrapper, observer);
  }

  private static detachMeasureObserver(wrapper: HTMLElement): void {
    const observer = MermaidWidget.resizeObservers.get(wrapper);
    if (!observer) {
      return;
    }
    observer.disconnect();
    MermaidWidget.resizeObservers.delete(wrapper);
  }

  private static requestEditorMeasure(dom: HTMLElement): void {
    const view = EditorView.findFromDOM(dom);
    if (!view) {
      return;
    }
    const pending = MermaidWidget.pendingMeasureFrames.get(view);
    if (typeof pending === "number") {
      cancelAnimationFrame(pending);
    }
    const frame = requestAnimationFrame(() => {
      MermaidWidget.pendingMeasureFrames.delete(view);
      view.requestMeasure();
    });
    MermaidWidget.pendingMeasureFrames.set(view, frame);
  }

  private attachOpenInNewTabButton(wrapper: HTMLElement, container: HTMLElement) {
    wrapper.querySelector(".cm-lp-mermaid-open-button")?.remove();

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
    const previewRoot = previewWindow.document.createElement("main");
    previewRoot.className = "mermaid-preview";
    const sanitizedSvg = MermaidWidget.parseAndSanitizeSvg(svgMarkup, previewWindow.document);
    if (sanitizedSvg) {
      previewRoot.appendChild(sanitizedSvg);
    } else {
      previewRoot.textContent = "Failed to open Mermaid preview";
    }
    previewWindow.document.body.replaceChildren(previewRoot);

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

  private static parseAndSanitizeSvg(
    svgMarkup: string,
    doc: Document
  ): SVGElement | null {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(svgMarkup, "image/svg+xml");
    if (parsed.querySelector("parsererror")) {
      return null;
    }

    const root = parsed.documentElement;
    if (!root || root.tagName.toLowerCase() !== "svg") {
      return null;
    }

    MermaidWidget.sanitizeSvgElementTree(root);
    const imported = doc.importNode(root, true) as unknown as Element;
    MermaidWidget.sanitizeSvgElementTree(imported);
    return imported as unknown as SVGElement;
  }

  private static sanitizeSvgElementTree(root: Element) {
    const allElements = [root, ...root.querySelectorAll("*")];
    for (const element of allElements) {
      const tagName = (element.localName || element.tagName).toLowerCase();
      if (MermaidWidget.blockedSvgElements.has(tagName)) {
        element.remove();
        continue;
      }
      MermaidWidget.sanitizeAttributes(element);
    }
  }

  private static sanitizeAttributes(element: Element) {
    for (const attribute of [...element.attributes]) {
      const attributeName = attribute.name.toLowerCase();
      const attributeValue = attribute.value.trim().toLowerCase();

      if (attributeName.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (
        (attributeName === "href" || attributeName === "xlink:href") &&
        (attributeValue.startsWith("javascript:") ||
          attributeValue.startsWith("data:text/html"))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  private static async loadMermaidApi(options?: {
    skipGlobal?: boolean;
  }): Promise<MermaidApi | null> {
    if (!options?.skipGlobal) {
      const fromWindow = globalThis as typeof globalThis & {
        mermaid?: unknown;
      };
      const windowApi = MermaidWidget.resolveMermaidApi(fromWindow.mermaid);
      if (windowApi) {
        MermaidWidget.mermaidApi = windowApi;
        return MermaidWidget.mermaidApi;
      }
    }

    if (MermaidWidget.mermaidApi !== undefined) {
      return MermaidWidget.mermaidApi;
    }

    try {
      const imported = await import("mermaid");
      const importedApi = MermaidWidget.resolveMermaidApi(imported);
      if (importedApi) {
        MermaidWidget.mermaidApi = importedApi;
        return MermaidWidget.mermaidApi;
      }
    } catch {
      MermaidWidget.mermaidApi = null;
      return MermaidWidget.mermaidApi;
    }

    MermaidWidget.mermaidApi = null;
    return MermaidWidget.mermaidApi;
  }

  private static resolveMermaidApi(candidate: unknown): MermaidApi | null {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }

    const direct = candidate as Partial<MermaidApi>;
    if (MermaidWidget.isMermaidApi(direct)) {
      return direct;
    }

    const nestedDefault = (candidate as { default?: unknown }).default;
    const nestedApi = MermaidWidget.resolveMermaidApi(nestedDefault);
    if (nestedApi) {
      return nestedApi;
    }

    return null;
  }

  private static isMermaidApi(candidate: unknown): candidate is MermaidApi {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }
    const api = candidate as Partial<MermaidApi>;
    return typeof api.initialize === "function" && typeof api.render === "function";
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
