export type RenderDocumentPayload = {
    markdown: string;
    uri: string;
    updatedAt: number;
};

export type ExtensionToWebviewMessage = {
    type: 'renderDocument';
    payload: RenderDocumentPayload;
};

export type WebviewToExtensionMessage =
    | { type: 'ready'; uri?: string }
    | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string; detail?: unknown };

export function isRenderDocumentMessage(
    message: unknown
): message is ExtensionToWebviewMessage {
    const candidate = message as ExtensionToWebviewMessage;
    return candidate?.type === 'renderDocument' && typeof candidate?.payload?.markdown === 'string';
}
