import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CoreApp } from '../core';
import {
    ExtensionToWebviewMessage,
    WebviewToExtensionMessage,
    isRenderDocumentMessage
} from '../shared/messages';

type DocumentState = {
    markdown: string;
    updatedAt: number;
    uri?: string;
};

type WebviewState = DocumentState;

const vscode = acquireVsCodeApi<WebviewState>();

function WebviewApp() {
    const initialState = vscode.getState() ?? {
        markdown: '# MarkBloom\n\nLoading preview...',
        updatedAt: Date.now()
    };

    const [documentState, setDocumentState] = useState<DocumentState>(initialState);

    useEffect(() => {
        const handler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
            const message = event.data;
            if (isRenderDocumentMessage(message)) {
                setDocumentState({
                    markdown: message.payload.markdown,
                    updatedAt: message.payload.updatedAt,
                    uri: message.payload.uri
                });
            }
        };

        window.addEventListener('message', handler);
        vscode.postMessage({ type: 'ready', uri: documentState.uri } satisfies WebviewToExtensionMessage);

        return () => {
            window.removeEventListener('message', handler);
        };
    }, [documentState.uri]);

    useEffect(() => {
        vscode.setState(documentState);
    }, [documentState]);

    const handleError = (message: string) => {
        vscode.postMessage({ type: 'log', level: 'error', message } satisfies WebviewToExtensionMessage);
    };

    return <CoreApp markdown={documentState.markdown} updatedAt={documentState.updatedAt} onError={handleError} />;
}

const root = document.getElementById('root');
if (root) {
    createRoot(root).render(<WebviewApp />);
}
