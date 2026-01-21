declare module "tabulator-tables" {
  export const TabulatorFull: new (
    element: HTMLElement,
    options: Record<string, unknown>
  ) => {
    setColumns: (columns: unknown[]) => void;
    setData: (data: unknown[]) => void;
    getColumns: () => unknown[];
    getData: () => unknown[];
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    destroy: () => void;
    deselectRow?: () => void;
  };
}
