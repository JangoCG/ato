#!/bin/bash
# Download platform-specific Bun binaries for Tauri sidecar
# Tauri expects binaries named: bun-<target-triple>[.exe]

set -e

BUN_VERSION="1.1.43"  # Pin to a stable version
BINARIES_DIR="src-tauri/binaries"

mkdir -p "$BINARIES_DIR"

download_bun() {
    local platform=$1
    local arch=$2
    local target_triple=$3
    local ext=${4:-""}

    local bun_name="bun-${platform}-${arch}"
    local download_url="https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${bun_name}.zip"
    local target_name="bun-${target_triple}${ext}"

    echo "Downloading Bun for ${target_triple}..."

    # Download and extract
    local temp_dir=$(mktemp -d)
    curl -L -o "${temp_dir}/bun.zip" "$download_url"
    unzip -q "${temp_dir}/bun.zip" -d "${temp_dir}"

    # Find the bun binary (it's in a subdirectory)
    local bun_binary=$(find "${temp_dir}" -name "bun${ext}" -type f | head -1)

    if [ -z "$bun_binary" ]; then
        echo "Error: Could not find bun binary in archive"
        rm -rf "${temp_dir}"
        return 1
    fi

    # Copy to binaries directory with Tauri-expected name
    cp "$bun_binary" "${BINARIES_DIR}/${target_name}"
    chmod +x "${BINARIES_DIR}/${target_name}"

    rm -rf "${temp_dir}"
    echo "Downloaded: ${BINARIES_DIR}/${target_name}"
}

# Parse arguments
PLATFORMS="${1:-all}"

case "$PLATFORMS" in
    "all")
        download_bun "darwin" "aarch64" "aarch64-apple-darwin"
        download_bun "darwin" "x64" "x86_64-apple-darwin"
        download_bun "linux" "x64" "x86_64-unknown-linux-gnu"
        download_bun "windows" "x64" "x86_64-pc-windows-msvc" ".exe"
        ;;
    "macos"|"darwin")
        download_bun "darwin" "aarch64" "aarch64-apple-darwin"
        download_bun "darwin" "x64" "x86_64-apple-darwin"
        ;;
    "macos-arm"|"darwin-arm")
        download_bun "darwin" "aarch64" "aarch64-apple-darwin"
        ;;
    "macos-intel"|"darwin-x64")
        download_bun "darwin" "x64" "x86_64-apple-darwin"
        ;;
    "linux")
        download_bun "linux" "x64" "x86_64-unknown-linux-gnu"
        ;;
    "windows")
        download_bun "windows" "x64" "x86_64-pc-windows-msvc" ".exe"
        ;;
    *)
        echo "Usage: $0 [all|macos|macos-arm|macos-intel|linux|windows]"
        exit 1
        ;;
esac

echo ""
echo "Bun binaries downloaded to ${BINARIES_DIR}/"
ls -la "${BINARIES_DIR}/"
