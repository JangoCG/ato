#!/bin/bash
# Sign all native binaries in qmd/node_modules before bundling
# This is required for macOS notarization - unsigned dylibs/so/node files will fail

set -e

IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
if [ -z "$IDENTITY" ]; then
  echo "APPLE_SIGNING_IDENTITY not set, skipping codesign"
  exit 0
fi

echo "Signing native binaries with identity: $IDENTITY"

# Find and sign all native binaries in qmd/node_modules
# beforeBundleCommand runs from project root, so use qmd/ not ../qmd/
find qmd/node_modules -type f \( -name "*.dylib" -o -name "*.so" -o -name "*.node" \) 2>/dev/null | while read file; do
  echo "Signing: $file"
  codesign --force --timestamp --sign "$IDENTITY" "$file"
done

echo "Native binary signing complete"
