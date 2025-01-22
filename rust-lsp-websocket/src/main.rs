use futures_util::stream::{Stream, StreamExt};
use futures_util::{SinkExt, StreamExt};
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::TcpListener;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tower_lsp::{LspService, Server};

struct WebSocketStream {
    reader: Pin<Box<dyn Stream<Item=std::io::Result<Vec<u8>>> + Send>>,
    writer: Pin<Box<dyn futures_util::Sink<Vec<u8>, Error=std::io::Error> + Send>>,
}

impl AsyncRead for WebSocketStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        match self.reader.as_mut().poll_next(cx) {
            Poll::Ready(Some(Ok(data))) => {
                let len = data.len().min(buf.remaining());
                buf.put_slice(&data[..len]);
                Poll::Ready(Ok(()))
            }
            Poll::Ready(Some(Err(e))) => Poll::Ready(Err(e)),
            Poll::Ready(None) => Poll::Ready(Ok(())),
            Poll::Pending => Poll::Pending,
        }
    }
}

impl AsyncWrite for WebSocketStream {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        match self.writer.as_mut().poll_ready(cx) {
            Poll::Ready(Ok(())) => {
                match self.writer.as_mut().start_send(buf.to_vec()) {
                    Ok(()) => Poll::Ready(Ok(buf.len())),
                    Err(e) => Poll::Ready(Err(e)),
                }
            }
            Poll::Ready(Err(e)) => Poll::Ready(Err(e)),
            Poll::Pending => Poll::Pending,
        }
    }

    fn poll_flush(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        self.writer.as_mut().poll_flush(cx)
    }

    fn poll_shutdown(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        self.writer.as_mut().poll_close(cx)
    }
}

#[derive(Debug)]
struct Backend {
    client: Option<tower_lsp::Client>,
}

#[tower_lsp::async_trait]
impl tower_lsp::LanguageServer for Backend {
    async fn initialize(&self, _: tower_lsp::lsp_types::InitializeParams) -> tower_lsp::jsonrpc::Result<tower_lsp::lsp_types::InitializeResult> {
        Ok(tower_lsp::lsp_types::InitializeResult {
            capabilities: tower_lsp::lsp_types::ServerCapabilities {
                text_document_sync: Some(tower_lsp::lsp_types::TextDocumentSyncCapability::Kind(
                    tower_lsp::lsp_types::TextDocumentSyncKind::INCREMENTAL,
                )),
                ..Default::default()
            },
            server_info: None,
        })
    }

    async fn initialized(&self, _: tower_lsp::lsp_types::InitializedParams) {
        println!("Language Server initialized!");
    }

    async fn shutdown(&self) -> tower_lsp::jsonrpc::Result<()> {
        Ok(())
    }
}

impl Backend {
    fn new() -> Self {
        Self { client: None }
    }

    fn set_client(&mut self, client: tower_lsp::Client) {
        self.client = Some(client);
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = "127.0.0.1:3000";
    let listener = TcpListener::bind(addr).await?;
    println!("WebSocket server listening on: {}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        tokio::spawn(async move {
            if let Ok(ws_stream) = accept_async(stream).await {
                println!("New WebSocket connection established");

                let (write, read) = ws_stream.split();

                let reader = read.map(|msg| match msg {
                    Ok(Message::Text(text)) => Ok(text.into_bytes()),
                    Ok(Message::Binary(binary)) => Ok(binary),
                    Ok(_) => Ok(vec![]),
                    Err(e) => Err(std::io::Error::new(std::io::ErrorKind::Other, e)),
                });

                let writer = futures_util::sink::unfold(
                    write,
                    |mut write, data: Vec<u8>| async move {
                        write.send(Message::Binary(data)).await?;
                        Ok::<_, std::io::Error>(write)
                    },
                );

                let ws_stream = WebSocketStream {
                    reader: Box::pin(reader),
                    writer: Box::pin(writer),
                };

                let (service, messages) = LspService::new(|client| {
                    let mut backend = Backend::new();
                    backend.set_client(client);
                    backend
                });

                let server = Server::new(ws_stream, ws_stream, messages);

                if let Err(e) = server.serve().await {
                    eprintln!("Error in LSP server: {}", e);
                }
            }
        });
    }

    Ok(())
}
