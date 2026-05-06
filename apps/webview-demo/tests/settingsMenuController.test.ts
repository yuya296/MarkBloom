import test from "node:test";
import assert from "node:assert/strict";
import { createSettingsMenuController } from "../src/ui/settingsMenuController.ts";

type Listener = (event: unknown) => void;

function makeNode(opts: { contains?: (other: unknown) => boolean } = {}) {
  const attrs = new Map<string, string>();
  const listeners = new Map<string, Listener[]>();
  const node = {
    hidden: true,
    focused: 0,
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
    addEventListener(type: string, listener: Listener) {
      const arr = listeners.get(type) ?? [];
      arr.push(listener);
      listeners.set(type, arr);
    },
    removeEventListener(type: string, listener: Listener) {
      const arr = listeners.get(type) ?? [];
      listeners.set(
        type,
        arr.filter((l) => l !== listener)
      );
    },
    contains(other: unknown) {
      return opts.contains ? opts.contains(other) : false;
    },
    focus() {
      this.focused += 1;
    },
    dispatch(type: string, event: unknown) {
      for (const l of listeners.get(type) ?? []) {
        l(event);
      }
    },
  };
  return node;
}

function makeDoc() {
  const listeners = new Map<string, Listener[]>();
  return {
    addEventListener(type: string, listener: Listener) {
      const arr = listeners.get(type) ?? [];
      arr.push(listener);
      listeners.set(type, arr);
    },
    removeEventListener(type: string, listener: Listener) {
      const arr = listeners.get(type) ?? [];
      listeners.set(
        type,
        arr.filter((l) => l !== listener)
      );
    },
    dispatch(type: string, event: unknown) {
      for (const l of listeners.get(type) ?? []) {
        l(event);
      }
    },
  };
}

test("controller starts closed and exposes isOpen()", () => {
  const toggle = makeNode();
  const panel = makeNode();
  const firstFocusable = makeNode();
  const doc = makeDoc();
  const ctrl = createSettingsMenuController({
    toggle: toggle as unknown as HTMLButtonElement,
    panel: panel as unknown as HTMLDivElement,
    firstFocusable: firstFocusable as unknown as HTMLElement,
    doc: doc as unknown as Document,
  });
  assert.equal(ctrl.isOpen(), false);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(panel.hidden, true);
});

test("toggle click opens then closes the menu", () => {
  const toggle = makeNode();
  const panel = makeNode();
  const firstFocusable = makeNode();
  const doc = makeDoc();
  const ctrl = createSettingsMenuController({
    toggle: toggle as unknown as HTMLButtonElement,
    panel: panel as unknown as HTMLDivElement,
    firstFocusable: firstFocusable as unknown as HTMLElement,
    doc: doc as unknown as Document,
  });
  toggle.dispatch("click", {});
  assert.equal(ctrl.isOpen(), true);
  assert.equal(panel.hidden, false);
  assert.equal(firstFocusable.focused, 1);

  toggle.dispatch("click", {});
  assert.equal(ctrl.isOpen(), false);
  assert.equal(toggle.focused, 1);
});

test("Escape on panel closes and refocuses toggle", () => {
  const toggle = makeNode();
  const panel = makeNode();
  const firstFocusable = makeNode();
  const doc = makeDoc();
  const ctrl = createSettingsMenuController({
    toggle: toggle as unknown as HTMLButtonElement,
    panel: panel as unknown as HTMLDivElement,
    firstFocusable: firstFocusable as unknown as HTMLElement,
    doc: doc as unknown as Document,
  });
  ctrl.open();
  let prevented = false;
  panel.dispatch("keydown", {
    key: "Escape",
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(ctrl.isOpen(), false);
});

test("outside pointerdown closes when open", () => {
  const toggle = makeNode();
  const panel = makeNode({ contains: () => false });
  const firstFocusable = makeNode();
  const doc = makeDoc();
  const ctrl = createSettingsMenuController({
    toggle: toggle as unknown as HTMLButtonElement,
    panel: panel as unknown as HTMLDivElement,
    firstFocusable: firstFocusable as unknown as HTMLElement,
    doc: doc as unknown as Document,
  });
  ctrl.open();
  let prevented = false;
  doc.dispatch("pointerdown", {
    target: { nodeType: 1 },
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(ctrl.isOpen(), false);
});

test("destroy removes registered listeners", () => {
  const toggle = makeNode();
  const panel = makeNode();
  const firstFocusable = makeNode();
  const doc = makeDoc();
  const ctrl = createSettingsMenuController({
    toggle: toggle as unknown as HTMLButtonElement,
    panel: panel as unknown as HTMLDivElement,
    firstFocusable: firstFocusable as unknown as HTMLElement,
    doc: doc as unknown as Document,
  });
  ctrl.destroy();
  toggle.dispatch("click", {});
  assert.equal(ctrl.isOpen(), false);
});
