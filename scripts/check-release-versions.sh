#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Every place a version is written agrees, and agrees with the tag being released.
#
# A tag was once pushed before the release-prep merge had landed, so the tree it pointed at
# still said the previous version. The SDK job refused, correctly, but the release job had
# already created a GitHub release whose archive called itself the wrong version, and the
# cleanup needed a deleted release and a re-tag. The version lives in four places --
# package.json, package-lock.json (twice), sdk/package.json, and the CHANGELOG heading --
# and nothing checked that they moved together until the registry did.
#
# Usage:
#   scripts/check-release-versions.sh            all four places agree with package.json
#   scripts/check-release-versions.sh v1.2.3     ... and that version is the tag
#
# The release workflow runs the second form before it creates anything; CI runs the first
# on every pull request; RELEASING.md step 8 runs the second by hand before `git tag`.
set -euo pipefail
cd "$(dirname "$0")/.."

want="$(node -p "require('./package.json').version")"
problems=0
say() { echo "  ✗ $1"; problems=$((problems + 1)); }

if [ "${1:-}" != "" ]; then
  tag="$1"
  if [ "v${want}" != "$tag" ]; then
    say "package.json is ${want} but the tag is ${tag}"
  fi
fi

lock_root="$(node -p "require('./package-lock.json').version")"
lock_pkg="$(node -p "require('./package-lock.json').packages[''].version")"
sdk="$(node -p "require('./sdk/package.json').version")"
[ "$lock_root" = "$want" ] || say "package-lock.json version is ${lock_root}, package.json is ${want}"
[ "$lock_pkg" = "$want" ] || say "package-lock.json packages[\"\"].version is ${lock_pkg}, package.json is ${want}"
[ "$sdk" = "$want" ] || say "sdk/package.json is ${sdk}, package.json is ${want}"

# The places the version is written by hand for people who deploy: the API description, the
# chart, and the image tags in the manifest and the deployment guide. These sat at 0.1.0
# through two releases because nothing compared them.
openapi="$(sed -n 's/^  version: //p' docs/openapi.yaml | head -1)"
chart="$(sed -n 's/^appVersion: "\(.*\)"$/\1/p' deploy/helm/openresidency/Chart.yaml)"
[ "$openapi" = "$want" ] || say "docs/openapi.yaml info.version is ${openapi}, package.json is ${want}"
[ "$chart" = "$want" ] || say "deploy/helm/openresidency/Chart.yaml appVersion is ${chart}, package.json is ${want}"
for f in deploy/k8s/app.yaml docs/DEPLOY.md; do
  stale="$(grep -oE 'open-residency:v[0-9]+\.[0-9]+\.[0-9]+' "$f" | grep -vx "open-residency:v${want}" | sort -u | tr '\n' ' ' || true)"
  [ -z "$stale" ] || say "${f} names ${stale}but package.json is ${want}"
done

if ! grep -qE "^## ${want//./\\.} — [0-9]{4}-[0-9]{2}-[0-9]{2}" CHANGELOG.md; then
  say "CHANGELOG.md has no '## ${want} — <date>' section"
fi

if [ "$problems" -gt 0 ]; then
  echo
  echo "FAIL: ${problems} place(s) disagree about the version. RELEASING.md steps 6 and 7:"
  echo "  fold [Unreleased] into '## ${want} — <date>', and bump package.json, package-lock.json"
  echo "  and sdk/package.json together (npm version <x.y.z> --no-git-tag-version at the root"
  echo "  and in sdk/), in the release-prep pull request, BEFORE the tag."
  exit 1
fi
echo "OK: package.json, package-lock.json, sdk/package.json, CHANGELOG.md, the OpenAPI description, the chart and the image tags all say ${want}${1:+, and so does the tag}"
