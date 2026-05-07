import initialText from "../assets/sample.md?raw";
import { createEditor } from "./createEditor";
import { buildExtensions } from "./editor/buildExtensions";
import {
  type ExtensionOptions,
  readExtensionOptionsFromControls,
} from "./editorSettings";
import { queryAppControls } from "./ui/controls";
import { createSettingsMenuController } from "./ui/settingsMenuController";
import { createThemeController } from "./ui/themeController";

export function setupApp() {
  const controls = queryAppControls();

  const getExtensionOptions = (): ExtensionOptions => {
    const nextOptions = readExtensionOptionsFromControls({
      showLineNumbers: controls.lineNumbers.checked,
      wrapLines: controls.wrap.checked,
      livePreviewEnabled: controls.livePreview.checked,
      blockRevealEnabled: controls.blockReveal.checked,
      tabSizeInput: controls.tabSize.value,
      diffBaselineText: initialText,
    });
    if (controls.tabSize.value !== nextOptions.normalizedTabSizeInput) {
      controls.tabSize.value = nextOptions.normalizedTabSizeInput;
    }
    return nextOptions;
  };

  createThemeController({ toggle: controls.themeToggle });

  const settingsMenu = createSettingsMenuController({
    toggle: controls.settingsToggle,
    panel: controls.settingsPanel,
    firstFocusable: controls.lineNumbers,
  });

  const editor = createEditor({
    parent: controls.editorHost,
    initialText,
    extensions: buildExtensions(getExtensionOptions()),
    onChange: (text) => {
      if (controls.status) {
        controls.status.textContent = `Length: ${text.length}`;
      }
      if (controls.changeInfo) {
        controls.changeInfo.textContent = `Last change at ${new Date().toLocaleTimeString()}`;
      }
    },
  });
  (window as Window & { __MB_EDITOR_VIEW__?: typeof editor.view }).__MB_EDITOR_VIEW__ =
    editor.view;

  controls.apply.addEventListener("click", () => {
    editor.setExtensions(buildExtensions(getExtensionOptions()));
    settingsMenu.close();
  });

  return editor;
}
