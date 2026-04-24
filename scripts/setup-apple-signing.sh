#!/usr/bin/env bash
# setup-apple-signing.sh
#
# One-time helper: base64-encodes a Developer ID Application .p12 certificate
# and writes all six required Apple signing secrets into the GitHub repo so the
# CD pipeline can produce notarized macOS builds.
#
# Prerequisites
# ─────────────
#  • gh CLI authenticated (gh auth login) with repo secret write access
#  • A Developer ID Application .p12 certificate exported from Keychain Access
#  • An app-specific password from https://appleid.apple.com (Security → App Passwords)
#
# Usage
# ─────
#   chmod +x scripts/setup-apple-signing.sh
#   ./scripts/setup-apple-signing.sh
#
# The script will prompt for each value interactively; nothing is written to
# disk beyond what gh-cli sends directly to the GitHub API.

set -euo pipefail

REPO="mbao01/openworship"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       OpenWorship — Apple Signing Setup (one-time)          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. .p12 certificate file path ─────────────────────────────────────────────
echo "Step 1: Developer ID Application certificate (.p12)"
echo "  Export from: Keychain Access → My Certificates → right-click → Export"
echo ""
read -r -p "  Path to .p12 file: " P12_PATH

if [[ ! -f "$P12_PATH" ]]; then
  echo "Error: file not found: $P12_PATH" >&2
  exit 1
fi

# Base64-encode the certificate (portable between macOS and Linux)
APPLE_CERTIFICATE=$(base64 < "$P12_PATH" | tr -d '\n')
echo "  ✓ Certificate encoded (${#APPLE_CERTIFICATE} chars)"

# ── 2. Certificate password ────────────────────────────────────────────────────
echo ""
echo "Step 2: Certificate export password (set when exporting from Keychain)"
read -r -s -p "  Password: " APPLE_CERTIFICATE_PASSWORD
echo ""
echo "  ✓ Password captured"

# ── 3. Signing identity ────────────────────────────────────────────────────────
echo ""
echo "Step 3: Signing identity"
echo '  Example: "Developer ID Application: Your Name (XXXXXXXXXX)"'
echo "  Find it with: security find-identity -v -p codesigning"
echo ""
read -r -p "  Signing identity: " APPLE_SIGNING_IDENTITY

# ── 4. Apple ID ───────────────────────────────────────────────────────────────
echo ""
echo "Step 4: Apple ID (email used for Apple Developer Program)"
read -r -p "  Apple ID: " APPLE_ID

# ── 5. App-specific password ───────────────────────────────────────────────────
echo ""
echo "Step 5: App-specific password"
echo "  Generate at: https://appleid.apple.com → Security → App-Specific Passwords"
echo "  Format: xxxx-xxxx-xxxx-xxxx"
read -r -s -p "  App-specific password: " APPLE_PASSWORD
echo ""

# ── 6. Team ID ────────────────────────────────────────────────────────────────
echo ""
echo "Step 6: Team ID"
echo "  Find at: https://developer.apple.com/account → Membership → Team ID"
echo "  Format: 10-character alphanumeric string (e.g. XXXXXXXXXX)"
read -r -p "  Team ID: " APPLE_TEAM_ID

# ── Write secrets ─────────────────────────────────────────────────────────────
echo ""
echo "Writing 6 secrets to ${REPO} ..."

printf '%s' "$APPLE_CERTIFICATE"          | gh secret set APPLE_CERTIFICATE          -R "$REPO" --body -
printf '%s' "$APPLE_CERTIFICATE_PASSWORD" | gh secret set APPLE_CERTIFICATE_PASSWORD -R "$REPO" --body -
printf '%s' "$APPLE_SIGNING_IDENTITY"     | gh secret set APPLE_SIGNING_IDENTITY     -R "$REPO" --body -
printf '%s' "$APPLE_ID"                   | gh secret set APPLE_ID                   -R "$REPO" --body -
printf '%s' "$APPLE_PASSWORD"             | gh secret set APPLE_PASSWORD             -R "$REPO" --body -
printf '%s' "$APPLE_TEAM_ID"              | gh secret set APPLE_TEAM_ID              -R "$REPO" --body -

echo ""
echo "✓ All 6 secrets written."
echo ""
echo "Next steps:"
echo "  1. Push a test tag to trigger the CD pipeline:"
echo "       git tag v0.1.0-signing-test && git push origin v0.1.0-signing-test"
echo "  2. Watch the GitHub Actions run for the macOS build job"
echo "  3. Download the .dmg and verify: spctl --assess --verbose=4 OpenWorship.app"
echo "  4. Confirm no Gatekeeper warning on a clean macOS machine"
echo "  5. Delete the test tag when done: git push origin --delete v0.1.0-signing-test"
echo ""
