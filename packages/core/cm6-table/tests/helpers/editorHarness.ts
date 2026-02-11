import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { JSDOM } from "jsdom";
import { GFM } from "@lezer/markdown";
import { tableEditor, type TableEditorOptions } from "../../src";

type Teardown = () => void;

type TableEditorHarness = {
  view: EditorView;
  parent: HTMLElement;
  getDoc: () => string;
  teardown: Teardown;
};

const GLOBAL_KEYS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLTextAreaElement",
  "Node",
  "Element",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "FocusEvent",
  "CustomEvent",
  "CompositionEvent",
  "DOMRect",
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

  const win = dom.window as unknown as Window & {
    requestAnimationFrame?: typeof requestAnimationFrame;
    cancelAnimationFrame?: typeof cancelAnimationFrame;
    ResizeObserver?: typeof ResizeObserver;
  };

  const patch: Record<string, unknown> = {
    window: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    HTMLTextAreaElement: win.HTMLTextAreaElement,
    Node: win.Node,
    Element: win.Element,
    Event: win.Event,
    MouseEvent: win.MouseEvent,
    KeyboardEvent: win.KeyboardEvent,
    FocusEvent: win.FocusEvent,
    CustomEvent: win.CustomEvent,
    CompositionEvent: win.CompositionEvent,
    DOMRect: win.DOMRect,
    getComputedStyle: win.getComputedStyle.bind(win),
    MutationObserver: win.MutationObserver,
    AbortController: win.AbortController,
    AbortSignal: win.AbortSignal,
    ResizeObserver:
      win.ResizeObserver ??
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    requestAnimationFrame:
      win.requestAnimationFrame?.bind(win) ??
      ((callback: FrameRequestCallback) =>
        setTimeout(() => callback(Date.now()), 0) as unknown as number),
    cancelAnimationFrame:
      win.cancelAnimationFrame?.bind(win) ??
      ((handle: number) => clearTimeout(handle)),
    PointerEvent: (win as unknown as Record<string, unknown>).PointerEvent ?? win.MouseEvent,
  };

  Object.entries(patch).forEach(([key, value]) => {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  });

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
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

export async function createTableEditorHarness(
  doc: string,
  options: TableEditorOptions = {}
): Promise<TableEditorHarness> {
  const restore = installDom();
  const parent = document.createElement("div");
  parent.id = "editor-host";
  document.body.appendChild(parent);

  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), tableEditor(options)],
  });
  const view = new EditorView({ state, parent });
  await flushEditorUpdates();

  return {
    view,
    parent,
    getDoc: () => view.state.doc.toString(),
    teardown: () => {
      view.destroy();
      parent.remove();
      restore();
    },
  };
}
