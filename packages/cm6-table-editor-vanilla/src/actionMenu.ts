import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  type Placement,
} from "@floating-ui/dom";

export type ActionItem = {
  label: string;
  onSelect?: () => void;
  submenu?: ActionItem[];
  disabled?: boolean;
};

type ActionMenuOptions = {
  items: ActionItem[];
  menuLabel: string;
  iconName?: string;
  closeAllMenus: () => void;
  signal?: AbortSignal;
};

type ActionMenu = {
  element: HTMLDivElement;
  close: () => void;
  destroy: () => void;
};

type PointerPosition = {
  x: number;
  y: number;
};

const SAFE_BUFFER = 8;
const SUBMENU_CLOSE_DELAY = 120;

const isWithinSafeZone = (
  point: PointerPosition,
  triggerRect: DOMRect,
  submenuRect: DOMRect
) => {
  const leftEdge = Math.min(triggerRect.left, submenuRect.left);
  const rightEdge = Math.max(triggerRect.right, submenuRect.right);
  const topEdge = Math.min(triggerRect.top, submenuRect.top);
  const bottomEdge = Math.max(triggerRect.bottom, submenuRect.bottom);

  let corridorLeft = leftEdge;
  let corridorRight = rightEdge;
  if (submenuRect.left >= triggerRect.right) {
    corridorLeft = triggerRect.right;
    corridorRight = submenuRect.left;
  } else if (triggerRect.left >= submenuRect.right) {
    corridorLeft = submenuRect.right;
    corridorRight = triggerRect.left;
  }

  return (
    point.x >= corridorLeft - SAFE_BUFFER &&
    point.x <= corridorRight + SAFE_BUFFER &&
    point.y >= topEdge - SAFE_BUFFER &&
    point.y <= bottomEdge + SAFE_BUFFER
  );
};

export const createActionMenu = ({
  items,
  menuLabel,
  iconName = "more_horiz",
  closeAllMenus,
  signal,
}: ActionMenuOptions): ActionMenu => {
  const container = document.createElement("div");
  container.className = "cm-table-action";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cm-table-action-button";
  button.setAttribute("aria-label", menuLabel);

  const icon = document.createElement("span");
  icon.className = "cm-table-icon material-symbols-outlined";
  icon.textContent = iconName;
  button.appendChild(icon);

  const menu = document.createElement("div");
  menu.className = "cm-table-action-menu";

  let menuCleanup: (() => void) | null = null;
  let pointer: PointerPosition | null = null;
  let submenuCloseTimeout: number | null = null;

  const handlePointerMove = (event: PointerEvent) => {
    pointer = { x: event.clientX, y: event.clientY };
  };

  const addPointerTracking = () => {
    document.addEventListener("pointermove", handlePointerMove, { passive: true, signal });
  };

  const removePointerTracking = () => {
    document.removeEventListener("pointermove", handlePointerMove);
    pointer = null;
  };

  const closeSubmenu = (wrapper: HTMLElement) => {
    (wrapper as unknown as { _cleanup?: () => void })._cleanup?.();
    wrapper.removeAttribute("data-open");
    wrapper.removeAttribute("data-placement");
    (wrapper as unknown as { _cleanup?: () => void })._cleanup = undefined;
  };

  const scheduleSubmenuClose = (wrapper: HTMLElement, trigger: HTMLElement, submenu: HTMLElement) => {
    if (submenuCloseTimeout) {
      window.clearTimeout(submenuCloseTimeout);
    }
    submenuCloseTimeout = window.setTimeout(() => {
      if (!pointer) {
        closeSubmenu(wrapper);
        return;
      }
      const triggerRect = trigger.getBoundingClientRect();
      const submenuRect = submenu.getBoundingClientRect();
      if (isWithinSafeZone(pointer, triggerRect, submenuRect)) {
        scheduleSubmenuClose(wrapper, trigger, submenu);
        return;
      }
      closeSubmenu(wrapper);
    }, SUBMENU_CLOSE_DELAY);
  };

  const positionFloating = async (
    reference: HTMLElement,
    floating: HTMLElement,
    placement: Placement
  ) => {
    const { x, y } = await computePosition(reference, floating, {
      placement,
      strategy: "fixed",
      middleware: [offset(6), flip(), shift({ padding: 6 })],
    });
    floating.style.position = "fixed";
    floating.style.left = `${x}px`;
    floating.style.top = `${y}px`;
  };

  const openMenu = () => {
    closeAllMenus();
    container.dataset.open = "true";
    positionFloating(button, menu, "bottom-start");
    menuCleanup = autoUpdate(button, menu, () => {
      positionFloating(button, menu, "bottom-start");
    });
    addPointerTracking();
  };

  const closeMenu = () => {
    if (menuCleanup) {
      menuCleanup();
      menuCleanup = null;
    }
    container.removeAttribute("data-open");
    Array.from(menu.querySelectorAll<HTMLElement>(".cm-table-action-item--submenu")).forEach(
      (wrapper) => closeSubmenu(wrapper)
    );
    removePointerTracking();
  };

  const destroy = () => {
    closeMenu();
  };

  const renderMenuItem = (item: ActionItem) => {
    if (item.submenu && item.submenu.length > 0) {
      const submenuWrapper = document.createElement("div");
      submenuWrapper.className = "cm-table-action-item cm-table-action-item--submenu";

      const submenuButton = document.createElement("button");
      submenuButton.type = "button";
      submenuButton.className = "cm-table-action-item-button";
      submenuButton.textContent = `${item.label} ▸`;
      submenuButton.disabled = Boolean(item.disabled);

      const submenu = document.createElement("div");
      submenu.className = "cm-table-action-submenu";

      const openSubmenu = () => {
        if (submenuWrapper.dataset.open === "true") {
          return;
        }
        submenuWrapper.dataset.open = "true";
        positionFloating(submenuButton, submenu, "right-start");
        const cleanup = autoUpdate(submenuButton, submenu, () => {
          positionFloating(submenuButton, submenu, "right-start");
        });
        (submenuWrapper as unknown as { _cleanup?: () => void })._cleanup = cleanup;
      };

      const handleSubmenuEnter = () => {
        if (submenuCloseTimeout) {
          window.clearTimeout(submenuCloseTimeout);
        }
        openSubmenu();
      };

      const handleSubmenuLeave = () => {
        if (submenuWrapper.dataset.open !== "true") {
          return;
        }
        scheduleSubmenuClose(submenuWrapper, submenuButton, submenu);
      };

      submenuWrapper.addEventListener("mouseenter", handleSubmenuEnter);
      submenuWrapper.addEventListener("mouseleave", handleSubmenuLeave);
      submenu.addEventListener("mouseenter", handleSubmenuEnter);
      submenu.addEventListener("mouseleave", handleSubmenuLeave);

      item.submenu.forEach((subItem) => {
        const subButton = document.createElement("button");
        subButton.type = "button";
        subButton.className = "cm-table-action-item-button";
        subButton.textContent = subItem.label;
        subButton.disabled = Boolean(subItem.disabled);
        subButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          subItem.onSelect?.();
          closeAllMenus();
        });
        submenu.appendChild(subButton);
      });

      submenuWrapper.appendChild(submenuButton);
      submenuWrapper.appendChild(submenu);
      return submenuWrapper;
    }

    const itemButton = document.createElement("button");
    itemButton.type = "button";
    itemButton.className = "cm-table-action-item-button";
    itemButton.textContent = item.label;
    itemButton.disabled = Boolean(item.disabled);
    itemButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      item.onSelect?.();
      closeAllMenus();
    });
    return itemButton;
  };

  items.forEach((item) => {
    menu.appendChild(renderMenuItem(item));
  });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (container.dataset.open === "true") {
      closeMenu();
      return;
    }
    openMenu();
  });

  container.appendChild(button);
  container.appendChild(menu);

  if (signal) {
    signal.addEventListener("abort", destroy, { once: true });
  }

  return { element: container, close: closeMenu, destroy };
};
