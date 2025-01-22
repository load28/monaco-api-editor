import * as ws from "ws";
import {
  createServerProcess,
  createWebSocketConnection,
  forward,
} from "vscode-ws-jsonrpc/server";
import { IWebSocket } from "vscode-ws-jsonrpc";
import * as path from "node:path";
import * as fs from "fs";

const wss = new ws.Server({ port: 5008 });

// workspace 디렉토리 생성
const workspacePath = path.join(process.cwd(), "workspace");
if (!fs.existsSync(workspacePath)) {
  fs.mkdirSync(workspacePath, { recursive: true });
}

// tsconfig.json 파일이 없으면 생성
const tsconfigPath = path.join(workspacePath, "tsconfig.json");
if (!fs.existsSync(tsconfigPath)) {
  const tsconfigContent = {
    compilerOptions: {
      target: "es2020",
      module: "commonjs",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
  };
  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));
}

// src 디렉토리와 index.ts 생성
const srcPath = path.join(workspacePath, "src");
if (!fs.existsSync(srcPath)) {
  fs.mkdirSync(srcPath, { recursive: true });

  const indexTsPath = path.join(srcPath, "index.ts");
  if (!fs.existsSync(indexTsPath)) {
    fs.writeFileSync(indexTsPath, "");
  }
}

wss.on("connection", (socket: ws) => {
  const websocket: IWebSocket = {
    send: (content) => socket.send(content),
    onMessage: (cb) => socket.on("message", cb),
    onError: (cb) => socket.on("error", cb),
    onClose: (cb) => socket.on("close", cb),
    dispose: () => socket.close(),
  };

  try {
    console.log(workspacePath);

    // TypeScript Language Server 실행
    const serverConnection = createServerProcess(
      "typescript-language-server",
      "typescript-language-server",
      ["--stdio"],
      {
        cwd: workspacePath,
      },
    );

    if (!serverConnection) {
      console.error("Failed to create server connection");
      socket.close();
      return;
    }

    const socketConnection = createWebSocketConnection(websocket);

    forward(socketConnection, serverConnection);
  } catch (error) {
    console.error("Error setting up LSP connection:", error);
    socket.close();
  }
});

wss.on("error", (error) => {
  console.error("WebSocket server error:", error);
});
