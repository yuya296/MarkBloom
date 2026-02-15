export const richLineStartBinding = {
  mac: "Ctrl-a",
  preventDefault: true,
} as const;

export function getRichLineStartOffset(lineText: string): number {
  const indentLength = lineText.match(/^\s*/u)?.[0].length ?? 0;
  const headingPrefix = lineText.slice(indentLength).match(/^(#{1,6}\s+)/u);
  if (headingPrefix) {
    return indentLength + headingPrefix[0].length;
  }
  return indentLength;
}
