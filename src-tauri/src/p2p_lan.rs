use futures_util::{SinkExt, StreamExt};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::protocol::Message;
use tokio_tungstenite::{accept_async, connect_async};
use vault_core::p2p::{P2PRole, P2PSessionHandshake};

pub const SERVICE_TYPE: &str = "_vaultzero._tcp.local.";

/// Error text returned when a P2P peer fails the transcript check.
///
/// A module-level constant keeps the message a single string literal, which
/// `rustfmt` leaves untouched.
const AUTH_ERROR: &str = "P2P authentication failed: the peer does not share the pairing secret. Possible man-in-the-middle or incorrect PIN.";

/// Maximum size of a single P2P frame we are willing to accept (8 MiB).
/// Prevents a malicious peer from forcing unbounded memory allocation.
const MAX_FRAME_BYTES: usize = 8 * 1024 * 1024;

/// Maximum number of consecutive failed PIN attempts before the host stops
/// serving the current listener. Brute-forcing a 6-digit PIN is otherwise
/// trivial (10^6 attempts).
const MAX_PIN_ATTEMPTS: u32 = 5;

/// Direction separation constants for the payload cipher.
const DIR_HOST_TO_CLIENT: u8 = 0x01;
const DIR_CLIENT_TO_HOST: u8 = 0x02;

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

/// Wire message exchanged during the pairing handshake.
///
/// The client sends its ephemeral X25519 public key; the host replies with its
/// own public key, its authentication tag, and the channel binding hash. Both
/// sides then derive the same session key and verify the binding hash, which
/// rejects any man-in-the-middle that substituted a key.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct HandshakeHello {
    /// Protocol marker so we can reject garbage frames early.
    magic: String,
    /// Ephemeral X25519 public key (32 bytes).
    public_key: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HandshakeReply {
    magic: String,
    /// Ephemeral X25519 public key (32 bytes).
    public_key: Vec<u8>,
    /// HMAC-SHA256 authentication tag over the canonical transcript.
    auth_tag: Vec<u8>,
    /// Channel binding hash; both peers must observe the same value.
    binding: Vec<u8>,
}

const HANDSHAKE_MAGIC: &str = "VZ-P2P-HS-V2";

/// Serializes the handshake messages with MessagePack, matching the crate's
/// existing binary encoding style.
fn pack<T: serde::Serialize>(value: &T) -> Result<Vec<u8>, String> {
    rmp_serde::to_vec_named(value).map_err(|e| format!("Failed to encode handshake frame: {}", e))
}

fn unpack<T: serde::de::DeserializeOwned>(bytes: &[u8]) -> Result<T, String> {
    rmp_serde::from_slice(bytes).map_err(|e| format!("Failed to decode handshake frame: {}", e))
}

/// Converts a serialized public key into the curve point type used by the
/// core crypto module.
fn to_public_key(bytes: &[u8]) -> Result<x25519_dalek::PublicKey, String> {
    if bytes.len() != 32 {
        return Err("Expected a 32-byte X25519 public key".into());
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(bytes);
    Ok(x25519_dalek::PublicKey::from(arr))
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

    /// Starts P2P sync host with an Ephemeral PIN and broadcasts via mDNS.
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
        let host_name = format!("{}.local.", device_name.replace(' ', "-"));
        let mut properties = HashMap::new();
        properties.insert("app".to_string(), "vaultzero".to_string());
        properties.insert("version".to_string(), "2.5.0".to_string());

        let service_info =
            ServiceInfo::new(SERVICE_TYPE, &device_name, &host_name, "", port, properties)
                .map_err(|e| format!("Failed to create service info: {}", e))?;

        daemon
            .register(service_info)
            .map_err(|e| format!("Failed to register mDNS service: {}", e))?;
        self.daemon = Some(daemon);

        let pin_clone = self.active_pin.clone();
        let payload_clone = self.active_payload.clone();

        // Spawn WebSocket server that performs an authenticated key exchange
        // before any vault data is transmitted.
        tokio::spawn(async move {
            let mut failed_attempts: u32 = 0;

            loop {
                if failed_attempts >= MAX_PIN_ATTEMPTS {
                    // The peer is brute-forcing the PIN: stop serving entirely.
                    break;
                }

                let accept = listener.accept().await;
                let (stream, _peer_addr) = match accept {
                    Ok(v) => v,
                    Err(_) => break,
                };

                let ws_stream = match accept_async(stream).await {
                    Ok(s) => s,
                    Err(_) => continue,
                };

                match Self::handle_client(ws_stream, &pin_clone, &payload_clone).await {
                    Ok(()) => {
                        // A successful, authenticated transfer resets the counter.
                        failed_attempts = 0;
                    }
                    Err(_) => {
                        failed_attempts += 1;
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

    /// Handles a single incoming peer: performs the X25519 handshake, verifies
    /// the channel binding hash, and only then sends the encrypted payload.
    async fn handle_client<S>(
        mut ws_stream: tokio_tungstenite::WebSocketStream<S>,
        pin_clone: &Arc<Mutex<Option<String>>>,
        payload_clone: &Arc<Mutex<Option<String>>>,
    ) -> Result<(), String>
    where
        S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
    {
        // Step 1: receive the client's ephemeral public key.
        let hello_bytes = match ws_stream.next().await {
            Some(Ok(Message::Binary(b))) if b.len() <= MAX_FRAME_BYTES => b,
            _ => return Err("Invalid handshake frame".into()),
        };

        let hello: HandshakeHello = unpack(&hello_bytes)?;
        if hello.magic != HANDSHAKE_MAGIC {
            return Err("Unexpected handshake magic".into());
        }

        let client_pub = to_public_key(&hello.public_key)?;

        // Step 2: derive our side of the session.
        let expected_pin = pin_clone.lock().unwrap().clone().unwrap_or_default();
        let host_hs = P2PSessionHandshake::new();
        let host_pub_raw = host_hs.public_key.as_bytes().to_vec();
        let session = host_hs.complete_handshake(
            &client_pub,
            &expected_pin,
            P2PRole::Host,
            P2PRole::Client,
        )?;

        // Step 3: send our public key + auth tag + binding hash.
        let reply = HandshakeReply {
            magic: HANDSHAKE_MAGIC.to_string(),
            public_key: host_pub_raw,
            auth_tag: session.auth_tag.to_vec(),
            binding: session.binding.to_vec(),
        };
        let reply_bytes = pack(&reply)?;
        ws_stream
            .send(Message::Binary(reply_bytes.into()))
            .await
            .map_err(|e| format!("Failed to send handshake reply: {}", e))?;

        // Step 4: the client proves it derived the same key by sending its
        // binding hash back. Compare in constant time.
        let confirm_bytes = match ws_stream.next().await {
            Some(Ok(Message::Binary(b))) if b.len() <= MAX_FRAME_BYTES => b,
            _ => return Err("Missing binding confirmation".into()),
        };

        let mut peer_binding = [0u8; 32];
        if confirm_bytes.len() != 32 {
            return Err("Invalid binding confirmation length".into());
        }
        peer_binding.copy_from_slice(&confirm_bytes);

        if !session.verify_transcript(&peer_binding) {
            // The peer did not prove knowledge of the paired key: this is a
            // man-in-the-middle attempt or a wrong PIN.
            return Err("P2P channel binding verification failed".into());
        }

        // Step 5: only NOW do we release the vault payload — encrypted.
        let payload = payload_clone.lock().unwrap().clone().unwrap_or_default();
        let encrypted =
            session.encrypt_payload_with_direction(payload.as_bytes(), DIR_HOST_TO_CLIENT)?;

        ws_stream
            .send(Message::Binary(encrypted.into()))
            .await
            .map_err(|e| format!("Failed to send encrypted payload: {}", e))?;

        let _ = ws_stream.close(None).await;
        Ok(())
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
                    if let Ok(mdns_sd::ServiceEvent::ServiceResolved(info)) = event {
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
                _ = &mut timeout => {
                    break;
                }
            }
        }

        Ok(peers)
    }

    /// Connects to a peer, performs the authenticated handshake, and receives
    /// the encrypted vault payload.
    pub async fn sync_from_peer(
        peer_ip: String,
        peer_port: u16,
        pin: String,
    ) -> Result<String, String> {
        let url = format!("ws://{}:{}/", peer_ip, peer_port);
        let (mut ws_stream, _) = connect_async(&url)
            .await
            .map_err(|e| format!("Failed to connect to peer at {}: {}", url, e))?;

        // Step 1: send our ephemeral public key.
        let client_hs = P2PSessionHandshake::new();
        let hello = HandshakeHello {
            magic: HANDSHAKE_MAGIC.to_string(),
            public_key: client_hs.public_key.as_bytes().to_vec(),
        };
        let hello_bytes = pack(&hello)?;
        ws_stream
            .send(Message::Binary(hello_bytes.into()))
            .await
            .map_err(|e| format!("Failed to send handshake: {}", e))?;

        // Step 2: receive the host's public key + auth tag + binding hash.
        let reply_bytes = match ws_stream.next().await {
            Some(Ok(Message::Binary(b))) if b.len() <= MAX_FRAME_BYTES => b,
            _ => return Err("Invalid handshake reply".into()),
        };
        let reply: HandshakeReply = unpack(&reply_bytes)?;
        if reply.magic != HANDSHAKE_MAGIC {
            return Err("Unexpected handshake magic".into());
        }
        let host_pub = to_public_key(&reply.public_key)?;

        // Step 3: derive our side of the session and verify the binding hash.
        let session =
            client_hs.complete_handshake(&host_pub, &pin, P2PRole::Client, P2PRole::Host)?;

        let mut peer_binding = [0u8; 32];
        if reply.binding.len() != 32 {
            return Err("Invalid binding hash length".into());
        }
        peer_binding.copy_from_slice(&reply.binding);

        if !session.verify_transcript(&peer_binding) {
            // A module-level constant keeps the message a single string
            // literal, which `rustfmt` leaves untouched.
            return Err(AUTH_ERROR.into());
        }

        // Step 4: prove our key possession so the host will release the payload.
        ws_stream
            .send(Message::Binary(session.binding.to_vec().into()))
            .await
            .map_err(|e| format!("Failed to send binding confirmation: {}", e))?;

        // Step 5: receive and decrypt the payload.
        let payload_bytes = match ws_stream.next().await {
            Some(Ok(Message::Binary(b))) if b.len() <= MAX_FRAME_BYTES => b,
            _ => return Err("Invalid encrypted payload frame".into()),
        };

        let decrypted = session
            .decrypt_payload_with_direction(&payload_bytes, DIR_HOST_TO_CLIENT)
            .map_err(|e| format!("Failed to decrypt peer payload: {}", e))?;

        String::from_utf8(decrypted).map_err(|e| format!("Peer payload was not valid UTF-8: {}", e))
    }
}
