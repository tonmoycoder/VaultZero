use mdns_sd::{ServiceDaemon, ServiceInfo};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::protocol::Message;
use tokio_tungstenite::{accept_async, connect_async};
use futures_util::{SinkExt, StreamExt};

pub const SERVICE_TYPE: &str = "_vaultzero._tcp.local.";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredPeer {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2PHostInfo {
    pub port: u16,
    pub pin: String,
    pub device_name: String,
}

pub struct P2PManager {
    daemon: Option<ServiceDaemon>,
    active_pin: Arc<Mutex<Option<String>>>,
    active_payload: Arc<Mutex<Option<String>>>,
}

impl Default for P2PManager {
    fn default() -> Self {
        Self {
            daemon: None,
            active_pin: Arc::new(Mutex::new(None)),
            active_payload: Arc::new(Mutex::new(None)),
        }
    }
}

impl P2PManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Starts P2P sync host with an Ephemeral PIN and broadcasts via mDNS
    pub async fn start_host(
        &mut self,
        pin: String,
        payload: String,
        device_name: String,
    ) -> Result<P2PHostInfo, String> {
        let listener = TcpListener::bind("0.0.0.0:0")
            .await
            .map_err(|e| format!("Failed to bind TCP listener: {}", e))?;
        let port = listener
            .local_addr()
            .map_err(|e| format!("Failed to get local addr: {}", e))?
            .port();

        *self.active_pin.lock().unwrap() = Some(pin.clone());
        *self.active_payload.lock().unwrap() = Some(payload.clone());

        // Initialize mDNS daemon and register service
        let daemon = ServiceDaemon::new().map_err(|e| format!("Failed to init mDNS: {}", e))?;
        let host_name = format!("{}.local.", &device_name.replace(' ', "-"));
        let mut properties = HashMap::new();
        properties.insert("app".to_string(), "vaultzero".to_string());
        properties.insert("version".to_string(), "2.5.0".to_string());

        let service_info = ServiceInfo::new(
            SERVICE_TYPE,
            &device_name,
            &host_name,
            "",
            port,
            properties,
        )
        .map_err(|e| format!("Failed to create service info: {}", e))?;

        daemon
            .register(service_info)
            .map_err(|e| format!("Failed to register mDNS service: {}", e))?;
        self.daemon = Some(daemon);

        let pin_clone = self.active_pin.clone();
        let payload_clone = self.active_payload.clone();

        // Spawn lightweight WebSocket server for handshake & encrypted payload transfer
        tokio::spawn(async move {
            if let Ok((stream, _)) = listener.accept().await {
                if let Ok(mut ws_stream) = accept_async(stream).await {
                    // Step 1: Wait for PIN message from connecting peer
                    if let Some(Ok(Message::Text(incoming_pin))) = ws_stream.next().await {
                        let expected_pin = pin_clone.lock().unwrap().clone().unwrap_or_default();
                        // Constant-time check
                        if subtle::ConstantTimeEq::ct_eq(
                            incoming_pin.trim().as_bytes(),
                            expected_pin.trim().as_bytes(),
                        )
                        .into()
                        {
                            // PIN Matched: Send encrypted payload
                            let payload = payload_clone.lock().unwrap().clone().unwrap_or_default();
                            let _ = ws_stream
                                .send(Message::Text(format!("OK:{}", payload).into()))
                                .await;
                        } else {
                            let _ = ws_stream
                                .send(Message::Text("ERR:PIN_MISMATCH".into()))
                                .await;
                        }
                    }
                }
            }
        });

        Ok(P2PHostInfo {
            port,
            pin,
            device_name,
        })
    }

    /// Discovers active VaultZero peers on local network via mDNS
    pub async fn discover_peers() -> Result<Vec<DiscoveredPeer>, String> {
        let daemon = ServiceDaemon::new().map_err(|e| format!("Failed to init mDNS: {}", e))?;
        let receiver = daemon
            .browse(SERVICE_TYPE)
            .map_err(|e| format!("Failed to browse mDNS: {}", e))?;

        let mut peers = Vec::new();
        let timeout = tokio::time::sleep(Duration::from_millis(1500));
        tokio::pin!(timeout);

        loop {
            tokio::select! {
                event = receiver.recv_async() => {
                    if let Ok(event) = event {
                        if let mdns_sd::ServiceEvent::ServiceResolved(info) = event {
                            let addrs = info.get_addresses();
                            if let Some(addr) = addrs.iter().next() {
                                peers.push(DiscoveredPeer {
                                    id: info.get_fullname().to_string(),
                                    name: info.get_hostname().replace(".local.", ""),
                                    ip: addr.to_string(),
                                    port: info.get_port(),
                                });
                            }
                        }
                    }
                }
                _ = &mut timeout => {
                    break;
                }
            }
        }

        Ok(peers)
    }

    /// Connects to a peer, submits PIN, and receives encrypted vault payload
    pub async fn sync_from_peer(
        peer_ip: String,
        peer_port: u16,
        pin: String,
    ) -> Result<String, String> {
        let url = format!("ws://{}:{}/", peer_ip, peer_port);
        let (mut ws_stream, _) = connect_async(&url)
            .await
            .map_err(|e| format!("Failed to connect to peer at {}: {}", url, e))?;

        // Send PIN
        ws_stream
            .send(Message::Text(pin.trim().to_string().into()))
            .await
            .map_err(|e| format!("Failed to send PIN: {}", e))?;

        // Receive response
        if let Some(Ok(msg)) = ws_stream.next().await {
            match msg {
                Message::Text(txt) => {
                    if let Some(payload) = txt.strip_prefix("OK:") {
                        Ok(payload.to_string())
                    } else if txt == "ERR:PIN_MISMATCH" {
                        Err("Authentication failed: Ephemeral PIN mismatch".into())
                    } else {
                        Err(format!("Unexpected peer response: {}", txt))
                    }
                }
                _ => Err("Invalid response format from peer".into()),
            }
        } else {
            Err("Connection closed before response received".into())
        }
    }
}

