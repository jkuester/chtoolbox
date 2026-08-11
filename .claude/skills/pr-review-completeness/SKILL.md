---
name: pr-review-completeness
description: Review whether a pull request completely delivers what its linked issue and its own description promise. Checks requirement-by-requirement delivery, undisclosed changes, and whether an existing pattern in the repo solves it better. Use when asked whether a PR addresses its issue, matches its description, or could be solved a better way. Does not review code correctness or style. Requires the `gh` CLI. The results of the review are output to the current agent session. No comments are added to the PR.
argument-hint: "[pr-number]"
# Keep these tools synced up with what is configured in the review.yml workflow
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh issue view:*)
  - Bash(git diff:*)
disallowed-tools:
  - Edit
  - Write
  - NotebookEdit
---

# PR review: completeness

Review whether a pull request completely delivers what it claims to deliver.

This is **not** a code-quality review. Do not report style issues, nitpicks, or bugs here unless they mean a stated requirement is not actually met.

## 0. Establish the target PR

Use the PR number you were given. If you were not given one, resolve it from the current branch with `gh pr view --json number` - and if that finds nothing, stop and say so rather than reviewing an arbitrary PR.

Everything below refers to that PR as `<pr>`.

## 1. Gather the stated intent

Fetch the PR in one call, dropping bot comments — automated reviews get posted back to the PR, so an unfiltered fetch feeds you an earlier report on this same PR and you will anchor on it instead of re-deriving:

```
gh pr view <pr> --json title,body,baseRefName,headRefOid,comments \
  --jq '{title, body, baseRefName, headRefOid, comments: [.comments[] | select(.author.login | test("\\[bot\\]$") | not) | {author: .author.login, body}]}'
```

- Note `baseRefName` and `headRefOid` — section 3 needs both.
- Extract every issue number referenced in the title or body. This repo puts it in the title, e.g. `feat(#315): support formatting xlsxform files`.
- Read each one the same way: `gh issue view <number> --json title,body,comments --jq '{title, body, comments: [.comments[] | select(.author.login | test("\\[bot\\]$") | not) | {author: .author.login, body}]}'`
- If no issue is referenced anywhere, treat the PR title and description as the sole statement of intent and say so explicitly in your output.

## 2. Restate the requirements

Write out the concrete requirements from those sources as a bullet list, in your own words, including sub-tasks and acceptance criteria.

Derive a requirement only from a statement about **behaviour** — what the code will do, or an acceptance criterion. Rationale and motivation ("this is faster", "this makes batch jobs possible") are not requirements. List any claim you decline to treat as a requirement under "Claims not treated as requirements" so the reader can disagree with the call.

## 3. Read the change, then follow it out of the diff

Get the file list, then the patch with generated files excluded — `package-lock.json` alone is ~136k tokens when regenerated, and it carries nothing this review can use:

```
gh pr diff <pr> --name-only
git diff origin/<baseRefName>...<headRefOid> -- . ':(exclude)package-lock.json'
```

Use the name list, not the patch, to account for any excluded file in section 5. If `git diff` fails because the base ref is not available locally, fall back to `gh pr diff <pr>` and say in the report that the patch was read unfiltered.

- Then read and search the working tree to follow the code **outward**: registration sites, exports, barrel files, command tables, call sites, and anything the new code must be wired into in order to actually run.
- A requirement counts as delivered only if the whole path from user entrypoint to new code is complete. New code that is never registered, exported, or called delivers nothing, even when it is correct in isolation.
- Trace only requirements that add user-facing surface (a command, endpoint, export, menu item), and name the registration site in the report. Reach for `Grep` before `Read`, and stop at the first site that proves the path rather than mapping the whole call graph.
- Where a requirement's delivery depends on a library or framework **default** rather than on code in the diff, do not assert the default from memory. Either cite documentation for it, or put the requirement in **Pending verification** and name the default you could not confirm.

## 4. Bucket every requirement

Put each requirement from section 2 into exactly one of these three buckets:

- **Delivered** — cite the `file:line` that satisfies it
- **Not delivered** — say what is missing
- **Pending verification** — a requirement whose delivery cannot be settled by reading code alone (e.g. behaviour against a live CouchDB, output rendering in a real terminal)

Then, separately, list **Preconditions to confirm**: operational facts the change depends on that are not requirements and belong to no bucket — a secret or environment variable that must exist, an external binary or service that must be reachable, a model or API version that must still be valid. These are a checklist for whoever merges, never folded into the counts above.

## 5. Undisclosed changes

Does the PR change anything its description never mentions? Report both directions, but this one matters most: an unmentioned change is the finding a human reviewer is most likely to miss.

Do not limit this to source files. Walk the full `--name-only` list from section 3, including the files excluded from the patch.

## 6. Better approach

Does an existing module, helper, or established pattern in this repo already solve this, or could it be updated to solve it better (more efficiently/simply)? Cite it by path.

Answer from code you already read in sections 3 to 5; do not open a fresh search of the repo for this. "No better approach found" is a correct and expected answer — do not invent hypothetical designs to fill space.

## Output

Report sections 4, 5, and 6 under the headings "Requirements", "Undisclosed Changes", and "Alternative Approaches". Be brief and cite `file:line` for every claim.

Use GitHub flavored Markdown. Write impersonally — report what the code does and what was checked, never narrating yourself ("I traced…", "I confirmed…").

Return the report as your response and stop there. If you could not establish the PR's intent (section 0 or 2), say so plainly as the report.
