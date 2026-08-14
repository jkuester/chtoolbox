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

# Paths whose patch body is dropped, matched as regexes against the end of the
# post-image path in the patch, at a "/" boundary. Add generated or vendored
# paths here.
readonly EXCLUDE=(
  'package-lock\.json'
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

alternation="$(IFS='|'; echo "${EXCLUDE[*]}")"
# The "b/" path ends the header line, so anchoring to end-of-line reads it without
# splitting on whitespace, which would mangle a path containing a space. Git wraps
# the pair in double quotes when it has to escape a path, hence the optional quote.
exclude_re="/(${alternation})\"?\$"
EXCLUDE_RE="$exclude_re" awk '
  /^diff --git / {
    skip = ($0 ~ ENVIRON["EXCLUDE_RE"])
    print
    if (skip) print "(patch body excluded to save tokens: this file is generated)"
    next
  }
  !skip
' <<< "$patch"
