import { Decoration, WidgetType } from "@codemirror/view";

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
