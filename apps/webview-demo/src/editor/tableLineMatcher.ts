// `apps/mac/src/app.ts` と同等のロジック。
// core 化は #130 系列の別 issue で扱う想定で、現時点では app 内に閉じる。
export function isTableLine(lineText: string): boolean {
  const line = lineText.trim();
  if (line.length === 0 || !line.includes("|")) {
    return false;
  }
  if (/^\|?[-:\s]+(\|[-:\s]+)+\|?$/u.test(line)) {
    return true;
  }
  return /^\|.*\|$/u.test(line);
}
