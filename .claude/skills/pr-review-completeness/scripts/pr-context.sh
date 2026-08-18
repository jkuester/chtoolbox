#!/usr/bin/env bash
#
# Gather the stated intent for a pull request: its title, description and human
# comments, plus the same for every issue it references.
#
# Usage: pr-context.sh [pr-number]
#   With no argument, resolves the PR from the current branch.

set -euo pipefail

die() {
  echo "pr-context.sh: $*" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || die "the gh CLI is not on PATH"
command -v jq >/dev/null 2>&1 || die "jq is not on PATH"

gh_err="$(mktemp)"
trap 'rm -f "$gh_err"' EXIT
gh_error() { tr '\n' ' ' <"$gh_err"; }

pr="${1:-}"
[[ -z "$pr" || "$pr" =~ ^[0-9]+$ ]] || die "not a PR number: '$pr'"

# $pr is unquoted so that no argument leaves gh to resolve the current branch; it is either empty or digits.
pr_json="$(gh pr view $pr --json number,title,baseRefName,headRefOid,url,body,comments,closingIssuesReferences 2>"$gh_err")" \
  || die "could not read PR ${pr:+#}${pr:-for the current branch}: $(gh_error)"
pr="$(jq -r .number <<<"$pr_json")"

print_body_and_comments() {
  local json="$1"
  echo "--- description ---"
  jq -r 'if (.body // "") == "" then "(no description)" else .body end' <<<"$json"
  echo "--- comments ---"
  jq -r '[ (.comments // [])[]
    | select(((.author.login // "") | sub("\\[bot\\]$"; "")) != "github-actions")
    | "[\(.author.login // "deleted-user")] \(.body // "")" ]
    | if length == 0 then "(no comments)" else .[] end' <<<"$json"
}

echo "=== PR #${pr} ==="
jq -r '"title: \(.title)\nbase:  \(.baseRefName)\nhead:  \(.headRefOid)"' <<<"$pr_json"
print_body_and_comments "$pr_json"

issue_urls="$(jq -r '
  (.url | sub("/pull/[0-9]+$"; "")) as $repo
  | [ (.closingIssuesReferences // [])[].url,
      ((.title // "") | capture("^\\S+\\(#(?<num>[0-9]+)\\):") | "\($repo)/issues/\(.num)") ]
  | unique[]
' <<<"$pr_json")" || die "could not read the issue references of PR #${pr}"

issues=()
if [[ -n "$issue_urls" ]]; then
  mapfile -t issues <<<"$issue_urls"
fi

if (( ${#issues[@]} == 0 )); then
  echo "--- linked issues: none ---"
  echo "No issue is referenced. The PR title and description are the sole"
  echo "statement of intent; say so explicitly in the report."
  exit 0
fi

echo "--- linked issues ---"
for url in "${issues[@]}"; do
  echo "=== issue ${url} ==="
  if ! issue_json="$(gh issue view "$url" --json title,body,comments 2>"$gh_err")"; then
    echo "(could not be read: $(gh_error))"
    continue
  fi
  jq -r '"title: \(.title)"' <<<"$issue_json"
  print_body_and_comments "$issue_json"
done
