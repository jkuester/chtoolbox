#!/usr/bin/env bash
#
# Print the patch for a pull request, with the bodies of generated files
# replaced by a note.
#
# Excluded files keep their `diff --git` header, so an undisclosed change to
# one of them is still visible as a finding.
#
# Usage: pr-diff.sh [pr-number]
#   With no argument, resolves the PR from the current branch.

set -euo pipefail

die() {
  echo "pr-diff.sh: $*" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || die "the gh CLI is not on PATH"

# Paths whose patch body is dropped, matched against the end of each path in
# the patch. Add generated or vendored paths here.
readonly EXCLUDE=(
  'package-lock.json'
)

pr="${1:-}"
if [[ -z "$pr" ]]; then
  pr="$(gh pr view --json number --jq .number 2>/dev/null)" \
    || die "no PR number given, and no PR found for the current branch"
fi
[[ "$pr" =~ ^[0-9]+$ ]] || die "not a PR number: '$pr'"

patch="$(gh pr diff "$pr")" \
  || die "could not read the diff for PR #${pr} (is gh authenticated for this repo?)"
[[ -n "$patch" ]] || die "PR #${pr} changes no files"

printf '%s\n' "$patch" | awk -v excl="$(printf '%s\n' "${EXCLUDE[@]}")" '
  function excluded(path,   i, suffix) {
    for (i = 1; i <= n; i++) {
      if (path == e[i]) return 1
      suffix = "/" e[i]
      if (length(path) > length(suffix) \
        && substr(path, length(path) - length(suffix) + 1) == suffix) return 1
    }
    return 0
  }
  BEGIN { n = split(excl, e, "\n"); if (e[n] == "") n-- }
  # A malformed path here fails open: the file keeps its patch body, costing
  # tokens but never hiding a change from the review.
  /^diff --git / {
    path = $3
    sub(/^a\//, "", path)
    skip = excluded(path)
    print
    if (skip) print "(patch body excluded to save tokens: this file is generated)"
    next
  }
  !skip
'
