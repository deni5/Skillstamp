#!/bin/bash
# Skillstamp — Solana / Anchor development environment setup
# Run: bash setup.sh

set -e

echo ""
echo "=== Skillstamp Solana Setup ==="
echo ""

# 1. Rust
if ! command -v rustc &> /dev/null; then
  echo "[1/4] Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
else
  echo "[1/4] Rust already installed: $(rustc --version)"
fi

# 2. Solana CLI
if ! command -v solana &> /dev/null; then
  echo "[2/4] Installing Solana CLI..."
  sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
else
  echo "[2/4] Solana already installed: $(solana --version)"
fi

# 3. Anchor
if ! command -v anchor &> /dev/null; then
  echo "[3/4] Installing Anchor CLI..."
  cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
  avm install 0.30.1
  avm use 0.30.1
else
  echo "[3/4] Anchor already installed: $(anchor --version)"
fi

# 4. Configure Solana for Devnet
echo "[4/4] Configuring Solana Devnet..."
solana config set --url https://api.devnet.solana.com

# Generate keypair if not exists
if [ ! -f "$HOME/.config/solana/id.json" ]; then
  echo "Generating new keypair..."
  solana-keygen new --no-bip39-passphrase
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Wallet address: $(solana address)"
echo "Network: $(solana config get | grep 'RPC URL')"
echo ""
echo "Next: Run 'solana airdrop 2' to get Devnet SOL"
echo "Then: cd skillstamp-contracts && anchor build"
echo ""
