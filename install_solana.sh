#!/bin/bash
set -e

echo "Updating APT..."
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libssl-dev gcc curl

echo "Installing Rust..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

echo "Installing Solana CLI..."
sh -c "$(curl -sSfL https://release.solana.com/v1.18.15/install)"
export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

echo "Installing AVM and Anchor..."
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

echo "Toolchain installed."
