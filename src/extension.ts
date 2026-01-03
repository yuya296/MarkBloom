import * as path from 'node:path';
import * as vscode from 'vscode';
import { ExtensionToWebviewMessage, WebviewToExtensionMessage } from './shared/messages';
import { generateNonce } from './utils/nonce';

class MarkdownPreviewManager {
    private panels = new Map<string, vscode.WebviewPanel>();
    private output = vscode.window.createOutputChannel('MarkBloom');

    constructor(private readonly context: vscode.ExtensionContext) { }

    activate() {
        this.context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.openIfMarkdown(editor.document);
                }
            }),
            vscode.workspace.onDidChangeTextDocument((event) => {
                this.renderIfTracked(event.document);
            }),
            vscode.workspace.onDidSaveTextDocument((document) => {
                this.renderIfTracked(document);
            }),
            vscode.workspace.onDidCloseTextDocument((document) => {
                this.disposePanel(document.uri);
            }),
            vscode.commands.registerCommand('markbloom.showPreview', () => {
                const document = vscode.window.activeTextEditor?.document;
                if (document) {
                    this.openPreview(document, { reveal: true });
                }
            })
        );

        const initial = vscode.window.activeTextEditor?.document;
        if (initial) {
            this.openIfMarkdown(initial);
        }
    }

    private openIfMarkdown(document: vscode.TextDocument) {
        if (this.isMarkdown(document)) {
            this.openPreview(document, { reveal: false });
        }
    }

    private isMarkdown(document: vscode.TextDocument) {
        return document.languageId === 'markdown';
    }

    private key(uri: vscode.Uri) {
        return uri.toString();
    }

    private renderIfTracked(document: vscode.TextDocument) {
        const key = this.key(document.uri);
        const panel = this.panels.get(key);
        if (panel) {
            this.renderDocument(panel, document);
        }
    }

    private disposePanel(uri: vscode.Uri) {
        const key = this.key(uri);
        const panel = this.panels.get(key);
        if (panel) {
            panel.dispose();
            this.panels.delete(key);
        }
    }

    private openPreview(document: vscode.TextDocument, options?: { reveal: boolean }) {
        if (!this.isMarkdown(document)) {
            return;
        }

        const key = this.key(document.uri);
        const existing = this.panels.get(key);
        if (existing) {
            if (options?.reveal) {
                existing.reveal(vscode.ViewColumn.Beside);
            }
            this.renderDocument(existing, document);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'markbloom.preview',
            `MarkBloom: ${path.basename(document.fileName)}`,
            { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
            }
        );

        panel.webview.html = this.buildHtml(panel.webview);

        panel.onDidDispose(() => {
            this.panels.delete(key);
        });

        panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
            if (message.type === 'ready') {
                this.renderDocument(panel, document);
            }

            if (message.type === 'log') {
                const detail = message.detail ? ` | detail: ${JSON.stringify(message.detail)}` : '';
                this.output.appendLine(`[${message.level}] ${message.message}${detail}`);
            }
        });

        this.panels.set(key, panel);
    }

    private renderDocument(panel: vscode.WebviewPanel, document: vscode.TextDocument) {
        const payload: ExtensionToWebviewMessage = {
            type: 'renderDocument',
            payload: {
                markdown: document.getText(),
                uri: document.uri.toString(),
                updatedAt: Date.now()
            }
        };

        panel.webview.postMessage(payload).then(
            undefined,
            (err: unknown) => this.output.appendLine(`[error] Failed to post renderDocument: ${String(err)}`)
        );
    }

    private buildHtml(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js'));
        const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.css'));
        const nonce = generateNonce();

        const csp = [
            `default-src 'none';`,
            `img-src ${webview.cspSource} https: data:;`,
            `script-src 'nonce-${nonce}';`,
            `style-src ${webview.cspSource} 'unsafe-inline';`,
            `font-src ${webview.cspSource} https: data:;`
        ].join(' ');

        return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="${stylesUri}" rel="stylesheet" />
    <title>MarkBloom</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const manager = new MarkdownPreviewManager(context);
    manager.activate();
}

export function deactivate() {
    // noop
}
