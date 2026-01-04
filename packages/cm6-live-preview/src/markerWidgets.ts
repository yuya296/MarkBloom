import { Decoration, WidgetType } from "@codemirror/view";

class MarkerWidget extends WidgetType {
  constructor(
    private readonly text: string,
    private readonly className: string,
    private readonly color: string
  ) {
    super();
  }

  eq(other: MarkerWidget): boolean {
    return (
      this.text === other.text &&
      this.className === other.className &&
      this.color === other.color
    );
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = this.className;
    span.style.color = this.color;
    span.style.fontWeight = "400";
    span.style.fontStyle = "normal";
    span.textContent = this.text;
    return span;
  }
}

export function markerReplace(text: string, className: string, color: string): Decoration {
  return Decoration.replace({
    widget: new MarkerWidget(text, className, color),
    inclusive: false,
  });
}
