import { Annotation } from "@codemirror/state";
import type { TableEditorOptions } from "./types";

// テーブル編集起因の dispatch を判別するためのアノテーション。
// 同じ doc 変更でも widget 由来かどうかを StateField 側で見分けるのに使う。
export const tableEditAnnotation = Annotation.define<boolean>();

// TableWidget からエディタへ「特定セルにフォーカスを戻したい」依頼を伝える DOM イベント名。
export const focusCellRequestEvent = "cm6-table-focus-cell-request";

export const defaultTableEditorOptions: Required<TableEditorOptions> = {
  enabled: true,
  renderMode: "widget",
};
