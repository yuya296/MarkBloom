import * as vscode from "vscode";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

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
      type: "setDiffBaseline";
      uri: string;
      text: string;
      source: "git-head" | "fallback";
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

    const postDiffBaseline = async () => {
      const baseline = await this.readGitHeadBaseline(document);
      const baselineMessage: HostMessage = {
        type: "setDiffBaseline",
        uri: uriKey,
        text: baseline.text,
        source: baseline.source,
      };
      webviewPanel.webview.postMessage(baselineMessage);
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
        void postDiffBaseline();
      }
    );

    webviewPanel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        switch (message.type) {
          case "ready":
            isReady = true;
            postInit();
            postConfig();
            await postDiffBaseline();
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

  private async readGitHeadBaseline(document: vscode.TextDocument): Promise<{
    text: string;
    source: "git-head" | "fallback";
  }> {
    try {
      const gitContext = await this.resolveGitContext(document.uri);
      if (!gitContext) {
        return {
          text: document.getText(),
          source: "fallback",
        };
      }
      const { stdout } = await execFileAsync(
        "git",
        ["-C", gitContext.repoRoot, "show", `HEAD:${gitContext.relativePath}`],
        {
          maxBuffer: 10 * 1024 * 1024,
          encoding: "utf8",
        }
      );
      return {
        text: stdout,
        source: "git-head",
      };
    } catch {
      return {
        text: document.getText(),
        source: "fallback",
      };
    }
  }

  private async resolveGitContext(uri: vscode.Uri): Promise<{
    repoRoot: string;
    relativePath: string;
  } | null> {
    const documentPath = uri.fsPath;
    const cwd = path.dirname(documentPath);

    try {
      const { stdout } = await execFileAsync(
        "git",
        ["-C", cwd, "rev-parse", "--show-toplevel"],
        {
          encoding: "utf8",
        }
      );
      const repoRoot = stdout.trim();
      if (!repoRoot) {
        return null;
      }
      const relativePath = path.relative(repoRoot, documentPath);
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        return null;
      }
      return {
        repoRoot,
        relativePath: relativePath.split(path.sep).join("/"),
      };
    } catch {
      return null;
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
    <div id="app" class="webview-app" data-width="default" data-editable="true">
      <div class="webview-toolbar">
        <div class="toolbar-group">
          <button
            id="toggle-edit-mode"
            class="slide-toggle"
            type="button"
            title="Switch to view mode"
            aria-pressed="true"
            aria-label="Toggle edit mode"
          >
            <span class="slide-toggle-track" aria-hidden="true">
              <span class="slide-toggle-icon slide-toggle-icon--left material-symbols-outlined">
                visibility
              </span>
              <span class="slide-toggle-icon slide-toggle-icon--right material-symbols-outlined">
                edit
              </span>
              <span class="slide-toggle-thumb">
                <span class="material-symbols-outlined" data-thumb-icon="visibility">
                  visibility
                </span>
                <span class="material-symbols-outlined" data-thumb-icon="edit">
                  edit
                </span>
              </span>
            </span>
          </button>
          <button
            id="toggle-width"
            class="icon-button"
            type="button"
            title="Switch to wide layout"
            aria-pressed="false"
          >
            <span class="icon material-symbols-outlined" data-icon="width-normal" aria-hidden="true">
              arrow_range
            </span>
            <span class="icon material-symbols-outlined" data-icon="width-full" aria-hidden="true">
              arrow_range
            </span>
          </button>
        </div>
      </div>
      <main class="webview-main">
        <div class="editor-shell">
          <div id="editor" class="editor"></div>
        </div>
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

  const resolveCommandUri = (resource?: unknown): vscode.Uri | undefined => {
    if (resource instanceof vscode.Uri) {
      return resource;
    }
    if (
      resource &&
      typeof resource === "object" &&
      "uri" in resource &&
      (resource as { uri?: unknown }).uri instanceof vscode.Uri
    ) {
      return (resource as { uri: vscode.Uri }).uri;
    }
    return vscode.window.activeTextEditor?.document.uri;
  };

  const openWith = async (resource: unknown, viewType: string) => {
    const uri = resolveCommandUri(resource);
    if (!uri) {
      return;
    }
    await vscode.commands.executeCommand(
      "vscode.openWith",
      uri,
      viewType,
      vscode.ViewColumn.Active
    );
  };

  const getAssociationTarget = () =>
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;

  const syncEditorAssociation = async () => {
    const config = vscode.workspace.getConfiguration("markbloom");
    const openInMarkBloom = config.get("view.openInMarkBloomByDefault", true);
    const workbenchConfig = vscode.workspace.getConfiguration();
    const associations =
      workbenchConfig.get<Record<string, string>>("workbench.editorAssociations") ??
      {};

    if (Array.isArray(associations)) {
      return;
    }

    const nextAssociations = { ...associations };
    const current = nextAssociations["*.md"];
    let changed = false;

    if (openInMarkBloom) {
      if (current !== "markbloom.editor") {
        nextAssociations["*.md"] = "markbloom.editor";
        changed = true;
      }
    } else if (current === "markbloom.editor") {
      delete nextAssociations["*.md"];
      changed = true;
    }

    if (!changed) {
      return;
    }

    await workbenchConfig.update(
      "workbench.editorAssociations",
      nextAssociations,
      getAssociationTarget()
    );
  };

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider("markbloom.editor", provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("markbloom.openInMarkBloom", (resource) =>
      openWith(resource, "markbloom.editor")
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("markbloom.openSource", (resource) =>
      openWith(resource, "default")
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("markbloom")) {
        provider.broadcastConfig();
        if (event.affectsConfiguration("markbloom.view.openInMarkBloomByDefault")) {
          void syncEditorAssociation();
        }
      }
    })
  );

  void syncEditorAssociation();
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
