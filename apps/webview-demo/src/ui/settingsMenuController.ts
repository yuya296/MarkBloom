export type SettingsMenuController = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  destroy: () => void;
};

export type SettingsMenuControllerOptions = {
  toggle: HTMLButtonElement;
  panel: HTMLDivElement;
  firstFocusable: HTMLElement;
  doc?: Document;
};

export function createSettingsMenuController(
  options: SettingsMenuControllerOptions
): SettingsMenuController {
  const doc = options.doc ?? document;

  const isOpen = () => options.toggle.getAttribute("aria-expanded") === "true";

  const setOpen = (open: boolean) => {
    options.toggle.setAttribute("aria-expanded", open ? "true" : "false");
    options.panel.hidden = !open;
  };

  const open = () => {
    setOpen(true);
    options.firstFocusable.focus();
  };

  const close = () => {
    setOpen(false);
    options.toggle.focus();
  };

  const toggle = () => {
    if (isOpen()) {
      close();
    } else {
      open();
    }
  };

  const onToggleClick = () => toggle();

  const onPanelKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    close();
  };

  const onDocumentPointerDown = (event: PointerEvent) => {
    if (!isOpen()) {
      return;
    }
    const target = event.target;
    if (typeof Node !== "undefined" && !(target instanceof Node)) {
      return;
    }
    if (target === null) {
      return;
    }
    if (
      options.panel.contains(target as Node) ||
      options.toggle.contains(target as Node)
    ) {
      return;
    }
    event.preventDefault();
    close();
  };

  setOpen(false);
  options.toggle.addEventListener("click", onToggleClick);
  options.panel.addEventListener("keydown", onPanelKeydown);
  doc.addEventListener("pointerdown", onDocumentPointerDown);

  const destroy = () => {
    options.toggle.removeEventListener("click", onToggleClick);
    options.panel.removeEventListener("keydown", onPanelKeydown);
    doc.removeEventListener("pointerdown", onDocumentPointerDown);
  };

  return { open, close, toggle, isOpen, destroy };
}
