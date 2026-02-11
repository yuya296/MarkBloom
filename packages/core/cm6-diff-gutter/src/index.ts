import {
  EditorState,
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
} from "@codemirror/state";
import { GutterMarker, gutter } from "@codemirror/view";
import { computeDiffLineKinds, type DiffComputeOptions, type DiffLineKind } from "./diff";

export type { DiffComputeOptions, DiffLineKind, DiffLineKinds } from "./diff";
export { computeDiffLineKinds } from "./diff";

export type DiffGutterOptions = DiffComputeOptions & {
  baselineText: string;
};

class DiffMarker extends GutterMarker {
  constructor(private readonly kind: DiffLineKind) {
    super();
  }

  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = `cm-diff-marker cm-diff-marker-${this.kind}`;
    marker.setAttribute("aria-hidden", "true");
    return marker;
  }
}

class DiffSpacerMarker extends GutterMarker {
  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = "cm-diff-marker cm-diff-marker-spacer";
    marker.setAttribute("aria-hidden", "true");
    return marker;
  }
}

const addedMarker = new DiffMarker("added");
const modifiedMarker = new DiffMarker("modified");
const spacerMarker = new DiffSpacerMarker();

type DiffMarkerState = {
  baselineText: string;
  markers: RangeSet<GutterMarker>;
};

export const setDiffBaseline = StateEffect.define<string>();

function buildMarkers(
  baselineText: string,
  currentState: EditorState,
  options: DiffComputeOptions
): RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>();
  const currentText = currentState.doc.toString();
  const lineKinds = computeDiffLineKinds(baselineText, currentText, options);

  if (lineKinds.size === 0) {
    return builder.finish();
  }

  for (let lineNumber = 1; lineNumber <= currentState.doc.lines; lineNumber += 1) {
    const markerKind = lineKinds.get(lineNumber);
    if (markerKind) {
      const line = currentState.doc.line(lineNumber);
      builder.add(
        line.from,
        line.from,
        markerKind === "added" ? addedMarker : modifiedMarker
      );
    }
  }

  return builder.finish();
}

export function diffGutter(options: DiffGutterOptions): Extension {
  const computeOptions: DiffComputeOptions = {
    ignoreLine: options.ignoreLine,
    maxCells: options.maxCells,
  };

  const diffField = StateField.define<DiffMarkerState>({
    create(state) {
      const baselineText = options.baselineText;
      return {
        baselineText,
        markers: buildMarkers(baselineText, state, computeOptions),
      };
    },
    update(value, tr) {
      let baselineText = value.baselineText;
      let shouldRecompute = tr.docChanged;

      for (const effect of tr.effects) {
        if (effect.is(setDiffBaseline) && effect.value !== baselineText) {
          baselineText = effect.value;
          shouldRecompute = true;
        }
      }

      if (!shouldRecompute) {
        return value;
      }

      return {
        baselineText,
        markers: buildMarkers(baselineText, tr.state, computeOptions),
      };
    },
  });

  return [
    diffField,
    gutter({
      class: "cm-diff-gutter",
      markers(view) {
        return view.state.field(diffField).markers;
      },
      initialSpacer() {
        return spacerMarker;
      },
    }),
  ];
}
