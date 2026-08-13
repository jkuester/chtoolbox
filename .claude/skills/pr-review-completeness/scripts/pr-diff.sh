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

# Paths whose patch body is dropped, matched against the end of each path in
# the patch. Add generated or vendored paths here.
readonly EXCLUDE=(
  'package-lock.json'
)

die() {
  echo "pr-diff.sh: $*" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || die "the gh CLI is not on PATH"

pr="${1:-}"
[[ -z "$pr" || "$pr" =~ ^[0-9]+$ ]] || die "not a PR number: '$pr'"

# $pr is unquoted so that no argument leaves gh to resolve the current branch; it is either empty or digits.
patch="$(gh pr diff $pr 2>/dev/null)" \
  || die "could not read the diff for PR '${pr}' (does it exist, and is gh authenticated for this repo?)"
[[ -n "$patch" ]] || die "PR '${pr}' changes no files"

awk -v excl="$(printf '%s\n' "${EXCLUDE[@]}")" '
  BEGIN { n = split(excl, e, "\n") }
  # Both path and entry are "/"-prefixed, so one suffix test covers a top-level
  # file and a nested one.
  function excluded(path,   i) {
    path = "/" path
    for (i = 1; i <= n; i++)
      if (substr(path, length(path) - length(e[i]))  == "/" e[i]) return 1
  }
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
' <<< "$patch"
