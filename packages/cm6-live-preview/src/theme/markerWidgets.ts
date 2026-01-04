import { Decoration, WidgetType } from "@codemirror/view";

class MarkerWidget extends WidgetType {
  constructor(private readonly text: string, private readonly className: string) {
    super();
  }

  eq(other: MarkerWidget): boolean {
    return this.text === other.text && this.className === other.className;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = this.className;
    span.textContent = this.text;
    return span;
  }
}

export function markerReplace(text: string, className: string): Decoration {
  return Decoration.replace({
    widget: new MarkerWidget(text, className),
    inclusive: false,
  });
}
