interface VSCodeAPI<T = unknown> {
    postMessage(message: unknown): void;
    setState(state: T): void;
    getState(): T | undefined;
}

declare function acquireVsCodeApi<T = unknown>(): VSCodeAPI<T>;

declare const MarkBloomCoreTest: {
    render(markdown: string): void;
    reset(): void;
};
