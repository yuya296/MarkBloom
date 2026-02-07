declare module "tabulator-tables" {
  type TabulatorRange = {
    remove: () => void;
  };

  export const TabulatorFull: new (
    element: HTMLElement,
    options: Record<string, unknown>
  ) => {
    setColumns: (columns: unknown[]) => void;
    setData: (data: unknown[]) => void;
    getColumns: () => unknown[];
    getRows: () => unknown[];
    getData: () => unknown[];
    getRanges: () => TabulatorRange[];
    addRange: (start: unknown, end?: unknown) => unknown;
    on: (event: string, callback: (...args: any[]) => void) => void;
    destroy: () => void;
    deselectRow?: () => void;
  };
}
