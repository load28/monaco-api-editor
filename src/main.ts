import "@codingame/monaco-vscode-rust-default-extension";
import "@codingame/monaco-vscode-python-default-extension";
import "@codingame/monaco-vscode-typescript-basics-default-extension";
import "@codingame/monaco-vscode-theme-defaults-default-extension";

import "./style.css";
import * as monaco from "monaco-editor";

import "vscode/localExtensionHost";
import { initialize } from "vscode/services";
import getLanguagesServiceOverride from "@codingame/monaco-vscode-languages-service-override";
import getThemeServiceOverride from "@codingame/monaco-vscode-theme-service-override";
import getTextMateServiceOverride from "@codingame/monaco-vscode-textmate-service-override";
import { initWebSocketAndStartClient } from "./lsp-client.ts";

export type WorkerLoader = () => Worker;
const workerLoaders: Partial<Record<string, WorkerLoader>> = {
  TextEditorWorker: () =>
    new Worker(
      new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url),
      { type: "module" },
    ),
  TextMateWorker: () =>
    new Worker(
      new URL(
        "@codingame/monaco-vscode-textmate-service-override/worker",
        import.meta.url,
      ),
      { type: "module" },
    ),
};

self.MonacoEnvironment = {
  getWorker(_workerId: any, label: string) {
    const workerFactory = workerLoaders[label];
    if (workerFactory != null) {
      return workerFactory();
    }
    throw new Error(`Worker ${label} not found`);
  },
};

async function initializeEditor() {
  try {
    await initialize({
      ...getThemeServiceOverride(),
      ...getLanguagesServiceOverride(),
      ...getTextMateServiceOverride(),
    });

    monaco.editor.create(document.getElementById("editor")!, {
      value: "",
      language: "rust",
      fontSize: 16,
      theme: "vs-dark",
      model: monaco.editor.createModel(
        "",
        "rust",
        monaco.Uri.parse(
          "file:///Users/seominyong/Downloads/source/my-monaco-api-editor/workspace/src/main.rs",
        ), // 명시적인 파일 URI 지정
      ),
    });
    monaco.editor.setTheme("vs-dark");

    initWebSocketAndStartClient("ws://localhost:5008/");
  } catch (error) {
    console.error("Editor initialization failed:", error);
    throw error;
  }
}

initializeEditor().catch(console.error);
