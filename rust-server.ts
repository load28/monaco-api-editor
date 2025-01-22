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

// workspace 디렉토리 생성 및 Cargo.toml 파일 생성
const workspacePath = path.join(process.cwd(), "workspace");
if (!fs.existsSync(workspacePath)) {
  fs.mkdirSync(workspacePath, { recursive: true });
}

// Cargo.toml 파일이 없으면 생성
const cargoTomlPath = path.join(workspacePath, "Cargo.toml");
if (!fs.existsSync(cargoTomlPath)) {
  const cargoTomlContent = `[package]
name = "workspace"
version = "0.1.0"
edition = "2021"

[dependencies]
`;
  fs.writeFileSync(cargoTomlPath, cargoTomlContent);
}

// src 디렉토리와 main.rs 생성
const srcPath = path.join(workspacePath, "src");
if (!fs.existsSync(srcPath)) {
  fs.mkdirSync(srcPath, { recursive: true });

  const mainRsPath = path.join(srcPath, "main.rs");
  if (!fs.existsSync(mainRsPath)) {
    fs.writeFileSync(mainRsPath, "");
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
    const serverConnection = createServerProcess(
      "rust-analyzer",
      "rust-analyzer",
      [],
      {
        cwd: workspacePath,
      }, // 수정된 workspace 경로 사용
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
