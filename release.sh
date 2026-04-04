#!/bin/bash
# Usage: ./release.sh 1.0.7
# Bumps version, commits, tags, and pushes — GitHub Actions does the rest.

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./release.sh <version>  (e.g. ./release.sh 1.0.7)"
  exit 1
fi

echo "Releasing v$VERSION..."

# Bump version in package.json
npm version "$VERSION" --no-git-tag-version

# Rebuild native modules for Electron (prevents NODE_MODULE_VERSION mismatch)
echo "Rebuilding native modules for Electron..."
./node_modules/.bin/electron-rebuild -f -w better-sqlite3

# Commit and tag
git add package.json
git commit -m "chore: bump version to $VERSION"
git tag "v$VERSION"
git push origin main
git push origin "v$VERSION"

echo ""
echo "✅ Tag v$VERSION pushed — GitHub Actions will build and publish the release automatically."
echo "   Watch progress at: https://github.com/manidanesh/HousePayroll/actions"
