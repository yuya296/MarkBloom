import test from "node:test";
import assert from "node:assert/strict";
import { createThemeController } from "../src/ui/themeController.ts";

type Listener = (event: unknown) => void;

function makeButton(): HTMLButtonElement {
  const attrs = new Map<string, string>();
  const listeners = new Map<string, Listener[]>();
  const button = {
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
    dispatchClick() {
      for (const l of listeners.get("click") ?? []) {
        l({});
      }
    },
  } as unknown as HTMLButtonElement & { dispatchClick: () => void };
  return button;
}

function makeRoot(): HTMLElement {
  const dataset: Record<string, string> = {};
  return { dataset } as unknown as HTMLElement;
}

test("createThemeController initializes from prefersDarkMatcher", () => {
  const toggle = makeButton();
  const root = makeRoot();
  createThemeController({
    toggle,
    root,
    prefersDarkMatcher: () => true,
  });
  assert.equal(root.dataset.theme, "dark");
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
});

test("createThemeController defaults to light when prefersDarkMatcher is false", () => {
  const toggle = makeButton();
  const root = makeRoot();
  createThemeController({
    toggle,
    root,
    prefersDarkMatcher: () => false,
  });
  assert.equal(root.dataset.theme, "light");
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
});

test("toggle click flips data-theme and aria-pressed", () => {
  const toggle = makeButton() as HTMLButtonElement & { dispatchClick: () => void };
  const root = makeRoot();
  createThemeController({
    toggle,
    root,
    prefersDarkMatcher: () => false,
  });
  toggle.dispatchClick();
  assert.equal(root.dataset.theme, "dark");
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
  toggle.dispatchClick();
  assert.equal(root.dataset.theme, "light");
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
});
