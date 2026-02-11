export type DiffLineKind = "added" | "modified";

export type DiffLineKinds = Map<number, DiffLineKind>;

export type DiffComputeOptions = {
  ignoreLine?: (lineText: string) => boolean;
  maxCells?: number;
};

function markLine(
  markers: DiffLineKinds,
  lineNumber: number,
  kind: DiffLineKind,
  lineText: string,
  ignoreLine: (lineText: string) => boolean
) {
  if (ignoreLine(lineText)) {
    return;
  }
  const existing = markers.get(lineNumber);
  if (existing === "added") {
    return;
  }
  markers.set(lineNumber, kind);
}

function splitLines(text: string): string[] {
  if (text.length === 0) {
    return [""];
  }
  return text.split("\n");
}

function flushHunk(
  markers: DiffLineKinds,
  pendingDeletes: number,
  pendingInsertedLineNumbers: number[],
  currentLines: string[],
  ignoreLine: (lineText: string) => boolean
) {
  const replacementCount = Math.min(pendingDeletes, pendingInsertedLineNumbers.length);
  for (let index = 0; index < pendingInsertedLineNumbers.length; index += 1) {
    const lineNumber = pendingInsertedLineNumbers[index];
    const lineText = currentLines[lineNumber - 1] ?? "";
    const kind: DiffLineKind = index < replacementCount ? "modified" : "added";
    markLine(markers, lineNumber, kind, lineText, ignoreLine);
  }
}

function computeDiffLineKindsByLcs(
  baselineLines: string[],
  currentLines: string[],
  ignoreLine: (lineText: string) => boolean
): DiffLineKinds {
  const baselineCount = baselineLines.length;
  const currentCount = currentLines.length;
  const width = currentCount + 1;
  const table = new Uint32Array((baselineCount + 1) * width);
  const indexAt = (base: number, current: number) => base * width + current;

  for (let base = baselineCount - 1; base >= 0; base -= 1) {
    for (let current = currentCount - 1; current >= 0; current -= 1) {
      if (baselineLines[base] === currentLines[current]) {
        table[indexAt(base, current)] = table[indexAt(base + 1, current + 1)] + 1;
      } else {
        const skipBase = table[indexAt(base + 1, current)];
        const skipCurrent = table[indexAt(base, current + 1)];
        table[indexAt(base, current)] = skipBase >= skipCurrent ? skipBase : skipCurrent;
      }
    }
  }

  const markers: DiffLineKinds = new Map();
  let base = 0;
  let current = 0;
  let pendingDeletes = 0;
  let pendingInsertedLineNumbers: number[] = [];
  let currentLineNumber = 1;

  while (base < baselineCount || current < currentCount) {
    if (base < baselineCount && current < currentCount && baselineLines[base] === currentLines[current]) {
      flushHunk(markers, pendingDeletes, pendingInsertedLineNumbers, currentLines, ignoreLine);
      pendingDeletes = 0;
      pendingInsertedLineNumbers = [];
      base += 1;
      current += 1;
      currentLineNumber += 1;
      continue;
    }

    if (
      current < currentCount &&
      (base === baselineCount ||
        table[indexAt(base, current + 1)] >= table[indexAt(base + 1, current)])
    ) {
      pendingInsertedLineNumbers.push(currentLineNumber);
      current += 1;
      currentLineNumber += 1;
      continue;
    }

    if (base < baselineCount) {
      pendingDeletes += 1;
      base += 1;
    }
  }

  flushHunk(markers, pendingDeletes, pendingInsertedLineNumbers, currentLines, ignoreLine);
  return markers;
}

function computeDiffLineKindsByHeuristic(
  baselineLines: string[],
  currentLines: string[],
  ignoreLine: (lineText: string) => boolean
): DiffLineKinds {
  const markers: DiffLineKinds = new Map();
  const lookAhead = 48;
  let baseIndex = 0;
  let currentIndex = 0;

  while (baseIndex < baselineLines.length || currentIndex < currentLines.length) {
    if (baseIndex >= baselineLines.length) {
      while (currentIndex < currentLines.length) {
        markLine(
          markers,
          currentIndex + 1,
          "added",
          currentLines[currentIndex],
          ignoreLine
        );
        currentIndex += 1;
      }
      break;
    }

    if (currentIndex >= currentLines.length) {
      break;
    }

    const baselineLine = baselineLines[baseIndex];
    const currentLine = currentLines[currentIndex];

    if (baselineLine === currentLine) {
      baseIndex += 1;
      currentIndex += 1;
      continue;
    }

    const baselineNext = baselineLines[baseIndex + 1];
    const currentNext = currentLines[currentIndex + 1];

    if (baselineNext === currentLine) {
      baseIndex += 1;
      continue;
    }

    if (baselineLine === currentNext) {
      markLine(markers, currentIndex + 1, "added", currentLine, ignoreLine);
      currentIndex += 1;
      continue;
    }

    if (baselineNext === currentNext) {
      markLine(markers, currentIndex + 1, "modified", currentLine, ignoreLine);
      baseIndex += 1;
      currentIndex += 1;
      continue;
    }

    let baselineSync = -1;
    for (
      let candidate = baseIndex + 1;
      candidate < baselineLines.length && candidate <= baseIndex + lookAhead;
      candidate += 1
    ) {
      if (baselineLines[candidate] === currentLine) {
        baselineSync = candidate;
        break;
      }
    }

    let currentSync = -1;
    for (
      let candidate = currentIndex + 1;
      candidate < currentLines.length && candidate <= currentIndex + lookAhead;
      candidate += 1
    ) {
      if (currentLines[candidate] === baselineLine) {
        currentSync = candidate;
        break;
      }
    }

    if (currentSync !== -1 && (baselineSync === -1 || currentSync - currentIndex <= baselineSync - baseIndex)) {
      while (currentIndex < currentSync) {
        markLine(
          markers,
          currentIndex + 1,
          "added",
          currentLines[currentIndex],
          ignoreLine
        );
        currentIndex += 1;
      }
      continue;
    }

    if (baselineSync !== -1) {
      baseIndex = baselineSync;
      continue;
    }

    markLine(markers, currentIndex + 1, "modified", currentLine, ignoreLine);
    baseIndex += 1;
    currentIndex += 1;
  }

  return markers;
}

export function computeDiffLineKinds(
  baselineText: string,
  currentText: string,
  options: DiffComputeOptions = {}
): DiffLineKinds {
  const ignoreLine = options.ignoreLine ?? (() => false);
  const baselineLines = splitLines(baselineText);
  const currentLines = splitLines(currentText);
  const maxCells = options.maxCells ?? 4_000_000;

  if (baselineLines.length * currentLines.length > maxCells) {
    return computeDiffLineKindsByHeuristic(baselineLines, currentLines, ignoreLine);
  }

  return computeDiffLineKindsByLcs(baselineLines, currentLines, ignoreLine);
}
