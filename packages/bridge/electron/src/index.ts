/**
 * Placeholder for Electron bridge implementation.
 * Feature 0001では未実装のため、将来のIPC・lifecycle層をここへ追加する。
 */
export type ElectronBridge = {
    bootstrap: () => Promise<void>;
};

export function createElectronBridge(): ElectronBridge {
    throw new Error('bridge-electron is out of scope for Feature 0001');
}

