import React, { useState } from 'react';
import {
  Radio,
  QrCode,
  Smartphone,
  Laptop,
  RefreshCw,
  Zap,
  ArrowRight
} from 'lucide-react';

export const P2PSyncView: React.FC = () => {
  const [pairingCode] = useState<string>('849 201');
  const [scanning, setScanning] = useState<boolean>(false);
  const [opticalMode, setOpticalMode] = useState<boolean>(false);

  return (
    <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <Radio className="w-6 h-6 text-blue-400" />
          <span>Zero-Server P2P Sync & Sharing Center</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-xl">
          Direct device-to-device encrypted synchronization over local Wi-Fi / Hotspot or air-gapped optical QR streaming. Zero cloud relay, zero interception risk.
        </p>
      </div>

      {/* Pairing Methods Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Method 1: QR Code & LAN Noise Tunnel */}
        <div className="p-6 rounded-3xl bg-secondary/30 border border-border/80 flex flex-col justify-between gap-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Scan QR Code Pairing</h3>
              <p className="text-xs text-muted-foreground">Ephemeral X25519 + ChaCha20-Poly1305</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-background border border-border/70 text-center gap-3 shadow-inner">
            {/* High density QR simulation */}
            <div className="w-36 h-36 rounded-xl bg-white p-3 flex items-center justify-center shadow-md">
              <div className="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center text-white text-[10px] font-mono text-center p-2">
                [X25519-P2P-TUNNEL-AUTHENTICATED]
              </div>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              Scan with VaultZero Android App
            </span>
          </div>

          <button
            onClick={() => setOpticalMode(!opticalMode)}
            className="w-full py-2.5 px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs border border-border transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{opticalMode ? 'Air-gapped Optical Stream Active' : 'Switch to Air-gapped Optical QR Stream'}</span>
          </button>
        </div>

        {/* Method 2: SPAKE2 6-Digit Pairing */}
        <div className="p-6 rounded-3xl bg-secondary/30 border border-border/80 flex flex-col justify-between gap-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">6-Digit SPAKE2 Code</h3>
              <p className="text-xs text-muted-foreground">Zero-Knowledge mutual transcript</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-background border border-border/70 text-center gap-2 shadow-inner">
            <span className="text-xs text-muted-foreground font-mono">Your Device Pairing Code</span>
            <div className="text-3xl font-mono font-extrabold tracking-widest text-primary py-2">
              {pairingCode}
            </div>
            <p className="text-[11px] text-muted-foreground max-w-xs">
              Type this code on your phone when prompted to verify the local sync handshake.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter remote 6-digit code..."
              className="flex-1 p-2.5 rounded-xl bg-secondary/40 border border-border text-xs font-mono focus:outline-none"
            />
            <button className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all">
              Pair
            </button>
          </div>
        </div>
      </div>

      {/* Discovered LAN Peers */}
      <div className="flex flex-col gap-4 p-6 rounded-3xl bg-secondary/30 border border-border/80 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Laptop className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-foreground">Nearby VaultZero LAN Devices</h3>
          </div>
          <button
            onClick={() => setScanning(!scanning)}
            className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>Rescan LAN</span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-background border border-border/70 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                📱
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Tonmoy's Android (Pixel 8)</h4>
                <p className="text-[11px] text-muted-foreground font-mono">192.168.1.145 · CRDT Sync Ready</p>
              </div>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-sm hover:opacity-95 transition-all">
              <span>Sync Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
