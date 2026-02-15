import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { JSDOM } from "jsdom";
import { livePreview } from "@yuya296/cm6-live-preview-core";
import { mermaidLivePreview } from "../../src";

type Teardown = () => void;

export type MermaidEditorHarness = {
  view: EditorView;
  parent: HTMLElement;
  setCursor: (pos: number) => void;
  teardown: Teardown;
};

const GLOBAL_KEYS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "SVGElement",
  "Node",
  "Element",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "FocusEvent",
  "CustomEvent",
  "CompositionEvent",
  "DOMRect",
  "DOMParser",
  "getComputedStyle",
  "MutationObserver",
  "AbortController",
  "AbortSignal",
  "ResizeObserver",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "PointerEvent",
] as const;

function installDom(): Teardown {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
    url: "http://localhost/",
  });
  const saved = new Map<string, PropertyDescriptor | undefined>();

  for (const key of GLOBAL_KEYS) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  }

  const win = dom.window as unknown as Record<string, unknown>;
  const requestAnimationFrameFromWindow = win.requestAnimationFrame;
  const cancelAnimationFrameFromWindow = win.cancelAnimationFrame;
  const resizeObserverFromWindow = win.ResizeObserver;
  const pointerEventFromWindow = win.PointerEvent;

  const patch: Record<string, unknown> = {
    window: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    SVGElement: win.SVGElement,
    Node: win.Node,
    Element: win.Element,
    Event: win.Event,
    MouseEvent: win.MouseEvent,
    KeyboardEvent: win.KeyboardEvent,
    FocusEvent: win.FocusEvent,
    CustomEvent: win.CustomEvent,
    CompositionEvent: win.CompositionEvent,
    DOMRect: win.DOMRect,
    DOMParser: win.DOMParser,
    getComputedStyle: (win.getComputedStyle as (el: Element) => CSSStyleDeclaration).bind(win),
    MutationObserver: win.MutationObserver,
    AbortController: win.AbortController,
    AbortSignal: win.AbortSignal,
    ResizeObserver:
      resizeObserverFromWindow ??
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    requestAnimationFrame:
      (typeof requestAnimationFrameFromWindow === "function"
        ? requestAnimationFrameFromWindow.bind(win)
        : undefined) ??
      ((callback: FrameRequestCallback) =>
        setTimeout(() => callback(Date.now()), 0) as unknown as number),
    cancelAnimationFrame:
      (typeof cancelAnimationFrameFromWindow === "function"
        ? cancelAnimationFrameFromWindow.bind(win)
        : undefined) ??
      ((handle: number) => clearTimeout(handle)),
    PointerEvent: pointerEventFromWindow ?? win.MouseEvent,
  };

  for (const [key, value] of Object.entries(patch)) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }

  const rangeProto = (win.Range as { prototype?: Record<string, unknown> } | undefined)
    ?.prototype;
  if (rangeProto) {
    if (typeof rangeProto.getBoundingClientRect !== "function") {
      rangeProto.getBoundingClientRect = () => new (win.DOMRect as typeof DOMRect)();
    }
    if (typeof rangeProto.getClientRects !== "function") {
      rangeProto.getClientRects = () =>
        ({
          length: 0,
          item: () => null,
          [Symbol.iterator]: function* () {},
        }) as unknown as DOMRectList;
    }
  }

  return () => {
    for (const key of GLOBAL_KEYS) {
      const previousDescriptor = saved.get(key);
      if (typeof previousDescriptor === "undefined") {
        delete (globalThis as Record<string, unknown>)[key];
      } else {
        Object.defineProperty(globalThis, key, previousDescriptor);
      }
    }
    dom.window.close();
  };
}

export async function flushEditorUpdates(ticks = 3): Promise<void> {
  for (let i = 0; i < ticks; i += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

export async function createMermaidEditorHarness(
  doc: string,
  cursor = 0
): Promise<MermaidEditorHarness> {
  const restore = installDom();
  const parent = document.createElement("div");
  document.body.appendChild(parent);

  const mermaid = mermaidLivePreview();
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [
      markdown(),
      ...mermaid.extensions,
      livePreview({
        exclude: { code: false },
        blockRevealEnabled: true,
        plugins: [mermaid.plugin],
      }),
    ],
  });
  const view = new EditorView({ state, parent });
  await flushEditorUpdates();

  return {
    view,
    parent,
    setCursor: (pos: number) => {
      view.dispatch({ selection: { anchor: pos } });
    },
    teardown: () => {
      view.destroy();
      parent.remove();
      restore();
    },
  };
}
