#!/usr/bin/env bash
#
# Print the full list of files a pull request touches, then the patch with
# generated files excluded.
#
# Excluded files still appear in the file list above the patch, because an
# undisclosed change to one of them is a finding.
#
# Usage: pr-diff.sh [pr-number]
#   With no argument, resolves the PR from the current branch.

set -euo pipefail

die() {
  echo "pr-diff.sh: $*" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || die "the gh CLI is not on PATH"

# Files whose patch body is dropped. Add generated or vendored paths here.
readonly EXCLUDE='package-lock.json'

pr="${1:-}"
if [[ -z "$pr" ]]; then
  pr="$(gh pr view --json number --jq .number 2>/dev/null)" \
    || die "no PR number given, and no PR found for the current branch"
fi
[[ "$pr" =~ ^[0-9]+$ ]] || die "not a PR number: '$pr'"

files="$(gh pr diff "$pr" --name-only)" \
  || die "could not read the diff for PR #${pr} (is gh authenticated for this repo?)"
[[ -n "$files" ]] || die "PR #${pr} changes no files"

echo "=== files changed ($(echo "$files" | wc -l | tr -d ' ')) ==="
echo "$files" | awk -v excl="$EXCLUDE" '
  BEGIN { n = split(excl, e, ","); for (i = 1; i <= n; i++) ex[e[i]] = 1 }
  { print ($0 in ex) ? $0 "   [patch excluded below]" : $0 }
'

echo
echo "=== patch ==="
gh pr diff "$pr" | awk -v excl="$EXCLUDE" '
  BEGIN { n = split(excl, e, ","); for (i = 1; i <= n; i++) ex[e[i]] = 1 }
  # A malformed path here fails open: the file stays in the patch, costing
  # tokens but never hiding a change from the review.
  /^diff --git / {
    path = $3
    sub(/^a\//, "", path)
    skip = (path in ex)
    if (skip) dropped[path] = 1
  }
  !skip { print }
  END {
    for (p in dropped)
      print "(patch body excluded to save tokens: " p " - see the file list above)"
  }
'
