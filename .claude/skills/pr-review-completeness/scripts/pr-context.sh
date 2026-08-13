#!/usr/bin/env bash
#
# Gather the stated intent for a pull request: its title, description and human
# comments, plus the same for every issue it references.
#
# Comments posted by bots are dropped. The count of dropped comments is always
# reported so the filtering is visible rather than silent.
#
# Usage: pr-context.sh [pr-number]
#   With no argument, resolves the PR from the current branch.

set -euo pipefail

die() {
  echo "pr-context.sh: $*" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || die "the gh CLI is not on PATH"

readonly HUMAN='[.comments[] | select(.author.login != "github-actions")]'

pr="${1:-}"
if [[ -z "$pr" ]]; then
  pr="$(gh pr view --json number --jq .number 2>/dev/null)" \
    || die "no PR number given, and no PR found for the current branch"
fi
[[ "$pr" =~ ^[0-9]+$ ]] || die "not a PR number: '$pr'"

print_comments() {
  local json total human
  json="$("$@" --json comments)" \
    || die "could not read comments (is gh authenticated for this repo?)"
  jq -r "$HUMAN"'[] | "[\(.author.login)] \(.body)"' <<<"$json"
  total="$(jq '.comments | length' <<<"$json")"
  human="$(jq "$HUMAN | length" <<<"$json")"
  echo "(${human} human comments; $((total - human)) bot comments dropped)"
}

echo "=== PR #${pr} ==="
gh pr view "$pr" --json title,baseRefName,headRefOid \
  --jq '"title: \(.title)\nbase:  \(.baseRefName)\nhead:  \(.headRefOid)"' \
  || die "could not read PR #${pr}"

echo
echo "--- description ---"
gh pr view "$pr" --json body --jq '.body // "(no description)"'

echo
echo "--- comments ---"
print_comments gh pr view "$pr"

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)" \
  || die "could not determine the repository for PR #${pr}"
closing="$(gh pr view "$pr" --json closingIssuesReferences --jq '.closingIssuesReferences[].url')" \
  || die "could not read linked issues for PR #${pr}"
issues="$(
  {
    [[ -z "$closing" ]] || echo "$closing"
    gh pr view "$pr" --json title --jq '.title' \
      | grep -oE '#[0-9]+' | grep -oE '[0-9]+' \
      | sed "s|^|https://github.com/${repo}/issues/|"
  } 2>/dev/null | sort -u || true
)"

echo
if [[ -z "$issues" ]]; then
  echo "--- linked issues: none ---"
  echo "No issue is referenced. The PR title and description are the sole"
  echo "statement of intent; say so explicitly in the report."
  exit 0
fi

echo "--- linked issues: $(echo "$issues" | grep -oE '[0-9]+$' | tr '\n' ' ')---"
for url in $issues; do
  echo
  echo "=== issue #${url##*/} (${url}) ==="
  if ! gh issue view "$url" --json title --jq '"title: \(.title)"' 2>/dev/null; then
    echo "(could not be read: no such issue, or not accessible)"
    continue
  fi
  echo
  echo "--- description ---"
  gh issue view "$url" --json body --jq '.body // "(no description)"'
  echo
  echo "--- comments ---"
  print_comments gh issue view "$url"
done
