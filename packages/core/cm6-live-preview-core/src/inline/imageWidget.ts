import { Decoration, EditorView, WidgetType } from "@codemirror/view";

// cm-widget-measure: dynamic
class ImageWidget extends WidgetType {
  constructor(private readonly src: string, private readonly alt: string) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return this.src === other.src && this.alt === other.alt;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-lp-image";

    const img = document.createElement("img");
    img.src = this.src;
    img.alt = this.alt;
    img.loading = "lazy";
    img.decoding = "async";
    const requestMeasure = () => {
      const view = EditorView.findFromDOM(span);
      if (!view) {
        return;
      }
      view.requestMeasure();
    };
    img.addEventListener("load", requestMeasure, { once: true });
    img.addEventListener("error", requestMeasure, { once: true });
    span.appendChild(img);

    return span;
  }
}

export function imageReplace(src: string, alt: string): Decoration {
  return Decoration.replace({
    widget: new ImageWidget(src, alt),
    inclusive: false,
  });
}

export function imageWidget(src: string, alt: string): Decoration {
  return Decoration.widget({
    widget: new ImageWidget(src, alt),
    side: 1,
  });
}
