import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { findHeadingLineForId } from "@yuya296/cm6-live-preview";

export type LinkClickIntent =
  | { kind: "anchor"; targetId: string }
  | { kind: "external"; url: string }
  | { kind: "ignore" };

export function resolveLinkClickIntent(href: string | undefined | null): LinkClickIntent {
  if (!href) {
    return { kind: "ignore" };
  }
  if (href.startsWith("#")) {
    const targetId = decodeURIComponent(href.slice(1));
    return { kind: "anchor", targetId };
  }
  return { kind: "external", url: href };
}

export type LinkClickHandlerOptions = {
  openExternal?: (url: string) => void;
};

function defaultOpenExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function linkClickHandler(options: LinkClickHandlerOptions = {}): Extension {
  const openExternal = options.openExternal ?? defaultOpenExternal;
  return EditorView.domEventHandlers({
    click: (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return false;
      }
      const link = event.target.closest(".mb-link[data-href]");
      if (!(link instanceof HTMLElement)) {
        return false;
      }
      const view = EditorView.findFromDOM(event.target);
      if (!view) {
        return false;
      }
      const intent = resolveLinkClickIntent(link.dataset.href);
      if (intent.kind === "ignore") {
        return false;
      }
      // ブラウザのフラグメント/外部ナビを早期に抑止する。
      // 旧実装では `#xxx` クリックでアンカー未解決でも preventDefault していたため、
      // 見出しが見つからないケースでも同等に抑止して回帰を避ける。
      event.preventDefault();
      event.stopPropagation();
      if (intent.kind === "anchor") {
        const targetLine = findHeadingLineForId(view.state.doc, intent.targetId);
        if (!targetLine) {
          return true;
        }
        view.dispatch({
          selection: { anchor: targetLine.from },
          scrollIntoView: true,
        });
        return true;
      }
      openExternal(intent.url);
      return true;
    },
  });
}
