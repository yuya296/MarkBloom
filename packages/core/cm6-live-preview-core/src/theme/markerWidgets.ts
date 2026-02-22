import { EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";

// cm-widget-measure: static
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

type ListMarkerKind = "bullet" | "ordered";

// cm-widget-measure: static
class ListMarkerWidget extends WidgetType {
  constructor(
    private readonly text: string,
    private readonly kind: ListMarkerKind
  ) {
    super();
  }

  eq(other: ListMarkerWidget): boolean {
    return this.text === other.text && this.kind === other.kind;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = `cm-lp-list-marker cm-lp-list-marker-${this.kind}`;
    span.textContent = this.text;
    return span;
  }
}

export function listMarkerReplace(
  kind: ListMarkerKind,
  rawText: string
): Decoration {
  const text = kind === "bullet" ? "\u2022" : rawText;
  return Decoration.replace({
    widget: new ListMarkerWidget(text, kind),
    inclusive: false,
  });
}

// cm-widget-measure: static
class TaskCheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly from: number,
    private readonly to: number
  ) {
    super();
  }

  eq(other: TaskCheckboxWidget): boolean {
    return (
      this.checked === other.checked &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-lp-task-checkbox";

    const input = document.createElement("input");
    input.className = "cm-lp-task-checkbox-input";
    input.type = "checkbox";
    input.checked = this.checked;
    input.tabIndex = -1;
    input.disabled = view.state.facet(EditorState.readOnly);
    input.setAttribute("aria-label", this.checked ? "Uncheck task" : "Check task");

    input.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    input.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    input.addEventListener("change", (event) => {
      event.stopPropagation();

      if (view.state.facet(EditorState.readOnly)) {
        input.checked = this.checked;
        view.focus();
        return;
      }

      const anchor = view.state.selection.main.head;
      view.dispatch({
        changes: {
          from: this.from,
          to: this.to,
          insert: this.checked ? "[ ]" : "[x]",
        },
        selection: { anchor },
      });
      view.focus();
    });

    wrapper.appendChild(input);
    return wrapper;
  }
}

export function taskCheckboxReplace(
  checked: boolean,
  from: number,
  to: number
): Decoration {
  return Decoration.replace({
    widget: new TaskCheckboxWidget(checked, from, to),
    inclusive: false,
  });
}
