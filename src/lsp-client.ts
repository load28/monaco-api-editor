import {
  toSocket,
  WebSocketMessageReader,
  WebSocketMessageWriter,
} from "vscode-ws-jsonrpc";
import {
  CloseAction,
  ErrorAction,
  MessageTransports,
} from "vscode-languageclient/browser.js";
import { MonacoLanguageClient } from "monaco-languageclient";

export const initWebSocketAndStartClient = (url: string): WebSocket => {
  const webSocket = new WebSocket(url);
  webSocket.onopen = () => {
    const socket = toSocket(webSocket);
    const reader = new WebSocketMessageReader(socket);
    const writer = new WebSocketMessageWriter(socket);
    const languageClient = createLanguageClient({
      reader,
      writer,
    });
    languageClient.start();
    reader.onClose(() => languageClient.stop());
  };
  return webSocket;
};

const createLanguageClient = (
  messageTransports: MessageTransports,
): MonacoLanguageClient => {
  return new MonacoLanguageClient({
    name: "Rust Language Client",
    clientOptions: {
      documentSelector: ["rust"],
      errorHandler: {
        error: () => ({ action: ErrorAction.Continue }),
        closed: () => ({ action: CloseAction.DoNotRestart }),
      },
    },
    messageTransports,
  });
};
