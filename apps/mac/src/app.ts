import type { Extension } from "@codemirror/state";
import { undo, redo } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { CheckMenuItem } from "@tauri-apps/api/menu/checkMenuItem";
import { Menu, Submenu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open, save } from "@tauri-apps/plugin-dialog";
import { diffGutter } from "@yuya296/cm6-diff-gutter";
import { livePreviewPreset, resolveImageBasePath } from "@yuya296/cm6-live-preview";
import initialText from "../assets/sample.md?raw";
import { createEditor } from "./createEditor";
import { editorTheme } from "./editorTheme";
import { editorHighlightStyle } from "./editorHighlightStyle";
import { resolveMermaidPreviewEnabled, resolvePreviewFeatureFlags } from "./featureFlags";

type AppMenuAction =
  | "open-file"
  | "save-file"
  | "new-file"
  | "find-replace"
  | "undo"
  | "redo";

type BuildExtensionOptions = {
  baselineText: string;
  wrapLines: boolean;
};

function isTableLine(lineText: string): boolean {
  const line = lineText.trim();
  if (line.length === 0 || !line.includes("|")) {
    return false;
  }
  if (/^\|?[-:\s]+(\|[-:\s]+)+\|?$/u.test(line)) {
    return true;
  }
  return /^\|.*\|$/u.test(line);
}

function buildExtensions({ baselineText, wrapLines }: BuildExtensionOptions): Extension[] {
  const extensions: Extension[] = [];
  const previewFeatureFlags = resolvePreviewFeatureFlags();

  extensions.push(
    diffGutter({
      baselineText,
      ignoreLine: isTableLine,
    }),
  );

  if (wrapLines) {
    extensions.push(EditorView.lineWrapping);
  }

  extensions.push(editorHighlightStyle());
  extensions.push(editorTheme());

  extensions.push(
    livePreviewPreset({
      livePreview: {
        blockRevealEnabled: true,
        imageBasePath: resolveImageBasePath(import.meta.env.BASE_URL),
        imageRawShowsPreview: true,
      },
      mermaid: resolveMermaidPreviewEnabled({
        livePreviewEnabled: true,
        featureFlags: previewFeatureFlags,
      }),
      table: true,
    }),
  );

  return extensions;
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

type AppMenuOptions = {
  actions: Record<AppMenuAction, () => void | Promise<void>>;
  initialWrapLines: boolean;
  onToggleWrapLines: (next: boolean) => void;
};

async function setupAppMenu({ actions, initialWrapLines, onToggleWrapLines }: AppMenuOptions) {
  if (!isTauri()) {
    return;
  }

  const appMenu = await Submenu.new({
    text: "MarkBloom",
    items: [
      { item: { About: null } },
      { item: "Separator" },
      { item: "Quit" },
    ],
  });

  const fileMenu = await Submenu.new({
    text: "File",
    items: [
      {
        id: "new-file",
        text: "New File",
        accelerator: "Cmd+N",
        action: () => {
          void actions["new-file"]();
        },
      },
      {
        id: "open-file",
        text: "Open...",
        accelerator: "Cmd+O",
        action: () => {
          void actions["open-file"]();
        },
      },
      {
        id: "save-file",
        text: "Save",
        accelerator: "Cmd+S",
        action: () => {
          void actions["save-file"]();
        },
      },
      { item: "Separator" },
      { item: "CloseWindow" },
    ],
  });

  const editMenu = await Submenu.new({
    text: "Edit",
    items: [
      {
        id: "undo",
        text: "Undo",
        accelerator: "Cmd+Z",
        action: () => {
          void actions.undo();
        },
      },
      {
        id: "redo",
        text: "Redo",
        accelerator: "Cmd+Shift+Z",
        action: () => {
          void actions.redo();
        },
      },
      { item: "Separator" },
      {
        id: "find-replace",
        text: "Find / Replace",
        accelerator: "Cmd+F",
        action: () => {
          void actions["find-replace"]();
        },
      },
      { item: "Separator" },
      { item: "Cut" },
      { item: "Copy" },
      { item: "Paste" },
      { item: "SelectAll" },
    ],
  });

  const wrapItem = await CheckMenuItem.new({
    id: "toggle-wrap-lines",
    text: "Toggle Line Wrap",
    accelerator: "Cmd+Alt+W",
    checked: initialWrapLines,
    action: () => {
      void (async () => {
        const next = await wrapItem.isChecked();
        onToggleWrapLines(next);
      })();
    },
  });

  const viewMenu = await Submenu.new({
    text: "View",
    items: [wrapItem],
  });

  const menu = await Menu.new({
    items: [appMenu, fileMenu, editMenu, viewMenu],
  });

  await menu.setAsAppMenu();
}

export function setupApp() {
  const editorHost = document.getElementById("editor");

  if (!(editorHost instanceof HTMLElement)) {
    throw new Error("Missing editor host element");
  }

  let currentFilePath: string | null = null;
  let currentFileLabel = "sample.md";
  let baselineText = initialText;
  let wrapLines = true;

  const handle = createEditor({
    parent: editorHost,
    initialText,
    extensions: buildExtensions({ baselineText, wrapLines }),
    onChange: () => {
      applyWindowTitle();
    },
  });

  const isDirty = () => handle.getText() !== baselineText;

  const applyWindowTitle = () => {
    if (!isTauri()) {
      return;
    }
    const dirty = isDirty() ? " •" : "";
    void getCurrentWindow().setTitle(`${currentFileLabel}${dirty} — MarkBloom`);
  };

  const applyExtensions = () => {
    handle.setExtensions(buildExtensions({ baselineText, wrapLines }));
  };

  const resetBaseline = (nextBaselineText: string) => {
    baselineText = nextBaselineText;
    applyExtensions();
  };

  const confirmDiscardIfDirty = (nextAction: string) => {
    if (!isDirty()) {
      return true;
    }
    return window.confirm(`You have unsaved changes. Discard them and ${nextAction}?`);
  };

  const handleOpenFile = async () => {
    if (!confirmDiscardIfDirty("open another file")) {
      return;
    }
    if (!isTauri()) {
      return;
    }

    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
      });
      if (typeof selected !== "string") {
        return;
      }
      await invoke("allow_markdown_path", { path: selected });
      const text = await invoke<string>("read_markdown_file", { path: selected });
      currentFilePath = selected;
      currentFileLabel = basename(selected);
      resetBaseline(text);
      handle.setText(text);
      applyWindowTitle();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveFile = async () => {
    if (!isTauri()) {
      return;
    }

    try {
      let targetPath = currentFilePath;
      if (!targetPath) {
        const selected = await save({
          filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
          defaultPath: "untitled.md",
        });
        if (typeof selected !== "string") {
          return;
        }
        targetPath = selected;
      }
      const text = handle.getText();
      await invoke("allow_markdown_path", { path: targetPath });
      await invoke("write_markdown_file", { path: targetPath, content: text });
      currentFilePath = targetPath;
      currentFileLabel = basename(targetPath);
      resetBaseline(text);
      applyWindowTitle();
    } catch (error) {
      console.error(error);
    }
  };

  const handleNewFile = () => {
    if (!isTauri()) {
      return;
    }
    void (async () => {
      try {
        const label = `untitled-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)
          .toString(36)
          .padStart(2, "0")}`;
        // Cascade the new window slightly down-right of the current one so
        // multiple New File presses produce a visible stack.
        let position: { x: number; y: number } | undefined;
        try {
          const pos = await getCurrentWindow().outerPosition();
          position = { x: pos.x + 28, y: pos.y + 28 };
        } catch {
          // best-effort; fall back to OS-default placement
        }
        const win = new WebviewWindow(label, {
          url: "/",
          title: "untitled.md — MarkBloom",
          width: 1120,
          height: 860,
          resizable: true,
          ...(position ? { x: position.x, y: position.y } : {}),
        });
        await win.once("tauri://error", (event) => {
          console.error("Failed to create new editor window", event);
        });
      } catch (error) {
        console.error(error);
      }
    })();
  };

  const handleFindReplace = () => {
    openSearchPanel(handle.view);
    handle.view.focus();
  };

  const handleUndo = () => {
    undo(handle.view);
    handle.view.focus();
  };

  const handleRedo = () => {
    redo(handle.view);
    handle.view.focus();
  };

  const handleToggleWrapLines = (next: boolean) => {
    wrapLines = next;
    applyExtensions();
    handle.view.focus();
  };

  const menuActions: Record<AppMenuAction, () => void | Promise<void>> = {
    "open-file": handleOpenFile,
    "save-file": handleSaveFile,
    "new-file": handleNewFile,
    "find-replace": handleFindReplace,
    undo: handleUndo,
    redo: handleRedo,
  };

  const installMenuForThisWindow = () => {
    void setupAppMenu({
      actions: menuActions,
      initialWrapLines: wrapLines,
      onToggleWrapLines: handleToggleWrapLines,
    }).catch((error) => {
      console.error("Failed to set up app menu", error);
    });
  };

  installMenuForThisWindow();

  // When this window gains focus, rebuild the app menu so its state
  // (e.g. View > Toggle Line Wrap checked) and action handlers reflect
  // *this* window — Tauri's app menu is process-global. (issue #104)
  if (isTauri()) {
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) {
          installMenuForThisWindow();
        }
      })
      .catch((error) => {
        console.error("Failed to subscribe to window focus", error);
      });
  }

  applyWindowTitle();

  return handle;
}
