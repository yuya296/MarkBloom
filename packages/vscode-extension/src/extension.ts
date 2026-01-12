import * as vscode from "vscode";
import { promises as fs } from "node:fs";

type MarkBloomConfig = {
  livePreview: {
    enabled: boolean;
    inlineRadius: number;
  };
  table: {
    enabled: boolean;
  };
};

type HostMessage =
  | {
      type: "initDocument";
      uri: string;
      text: string;
      version: number;
    }
  | {
      type: "setConfig";
      config: MarkBloomConfig;
    };

type WebviewMessage =
  | { type: "ready" }
  | { type: "requestSave" }
  | {
      type: "didChangeText";
      uri: string;
      text: string;
      version: number;
    };

class MarkBloomEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly context: vscode.ExtensionContext;
  private readonly webviews = new Set<vscode.WebviewPanel>();
  private readonly applyingEdits = new Set<string>();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview"),
      ],
    };

    webviewPanel.webview.html = await this.getWebviewHtml(webviewPanel.webview);
    this.webviews.add(webviewPanel);

    const uriKey = document.uri.toString();
    let isReady = false;

    const postInit = () => {
      const initMessage: HostMessage = {
        type: "initDocument",
        uri: document.uri.toString(),
        text: document.getText(),
        version: document.version,
      };
      webviewPanel.webview.postMessage(initMessage);
    };

    const postConfig = () => {
      const configMessage: HostMessage = {
        type: "setConfig",
        config: this.readConfig(),
      };
      webviewPanel.webview.postMessage(configMessage);
    };

    const documentChangeSubscription = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (event.document.uri.toString() !== uriKey) {
          return;
        }
        if (this.applyingEdits.has(uriKey)) {
          return;
        }
        if (!isReady) {
          return;
        }
        postInit();
      }
    );

    webviewPanel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        switch (message.type) {
          case "ready":
            isReady = true;
            postInit();
            postConfig();
            return;
          case "didChangeText":
            if (message.uri !== uriKey) {
              return;
            }
            await this.applyDocumentEdits(document, message.text);
            return;
          case "requestSave":
            await document.save();
            return;
          default:
            return;
        }
      }
    );

    webviewPanel.onDidDispose(() => {
      this.webviews.delete(webviewPanel);
      documentChangeSubscription.dispose();
    });
  }

  broadcastConfig(): void {
    const configMessage: HostMessage = {
      type: "setConfig",
      config: this.readConfig(),
    };
    for (const webview of this.webviews) {
      webview.webview.postMessage(configMessage);
    }
  }

  private readConfig(): MarkBloomConfig {
    const config = vscode.workspace.getConfiguration("markbloom");
    return {
      livePreview: {
        enabled: config.get("livePreview.enabled", true),
        inlineRadius: config.get("livePreview.inlineRadius", 6),
      },
      table: {
        enabled: config.get("table.enabled", true),
      },
    };
  }

  private async applyDocumentEdits(
    document: vscode.TextDocument,
    text: string
  ): Promise<void> {
    const currentText = document.getText();
    if (currentText === text) {
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(currentText.length)
    );
    edit.replace(document.uri, fullRange, text);
    const uriKey = document.uri.toString();
    this.applyingEdits.add(uriKey);
    try {
      await vscode.workspace.applyEdit(edit);
    } finally {
      this.applyingEdits.delete(uriKey);
    }
  }

  private async getWebviewHtml(
    webview: vscode.Webview
  ): Promise<string> {
    const manifestPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "dist",
      "webview",
      ".vite",
      "manifest.json"
    );
    const manifestRaw = await fs.readFile(manifestPath.fsPath, "utf8");
    const manifest = JSON.parse(manifestRaw) as Record<
      string,
      { file: string; css?: string[] }
    >;

    const entry = manifest["index.html"] ?? manifest["src/main.ts"];
    if (!entry) {
      throw new Error("Webview manifest is missing entry assets.");
    }

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "webview",
        entry.file
      )
    );

    const cssUris = (entry.css ?? []).map((cssFile) =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          "dist",
          "webview",
          cssFile
        )
      )
    );

    const nonce = getNonce();

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https:; font-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}';"
    />
    ${cssUris.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n    ")}
    <title>MarkBloom Editor</title>
  </head>
  <body>
    <div id="app" class="webview-app">
      <main class="webview-main">
        <div id="editor" class="editor"></div>
      </main>
      <footer class="footer">
        <span id="change-info">No changes yet.</span>
      </footer>
    </div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new MarkBloomEditorProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider("markbloom.editor", provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("markbloom")) {
        provider.broadcastConfig();
      }
    })
  );
}

export function deactivate(): void {}

function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 16; i += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}
