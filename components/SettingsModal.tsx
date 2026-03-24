"use client";

import { useState, useEffect } from "react";

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const [wallet, setWallet] = useState("");
  const [refreshInterval, setRefreshInterval] = useState("60");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setWallet(localStorage.getItem("manama_wallet") ?? "");
    setRefreshInterval(localStorage.getItem("manama_refresh") ?? "60");
  }, []);

  const handleSave = () => {
    localStorage.setItem("manama_wallet", wallet.trim());
    localStorage.setItem("manama_refresh", refreshInterval);
    setSaved(true);
    setTimeout(onClose, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-5">
          {/* Wallet Address */}
          <div className="space-y-2">
            <label className="block">
              <span className="text-sm font-medium text-text-primary">
                Ethereum Wallet Address
              </span>
              <p className="text-xs text-text-muted mt-0.5">
                Optional — paste your address to track on-chain positions
              </p>
            </label>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary placeholder:text-text-muted text-sm font-mono focus:outline-none focus:border-pm-purple transition-colors"
            />
          </div>

          {/* Refresh interval */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              Auto-refresh
            </span>
            <div className="flex gap-2">
              {[
                { value: "30", label: "30s" },
                { value: "60", label: "1m" },
                { value: "300", label: "5m" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setRefreshInterval(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    refreshInterval === value
                      ? "bg-pm-purple text-white"
                      : "border border-border text-text-secondary hover:border-pm-purple hover:text-pm-purple bg-background"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* About */}
          <div className="bg-background rounded-lg p-3 border border-border space-y-1">
            <p className="text-xs font-semibold text-text-secondary">Manama v0.1</p>
            <p className="text-xs text-text-muted">
              Crypto: CoinGecko &nbsp;|&nbsp; Polymarket: Gamma API &nbsp;|&nbsp;
              Fear & Greed: Alternative.me
            </p>
            <p className="text-xs text-text-muted">
              All data is free and public. No API keys needed.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2.5 rounded-lg bg-pm-purple text-white font-semibold hover:bg-pm-purple/90 transition-colors"
          >
            {saved ? "Saved! ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
