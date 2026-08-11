---
name: pr-review-completeness
description: Review whether a pull request completely delivers what its linked issue and its own description promise. Checks requirement-by-requirement delivery, undisclosed changes, and whether an existing pattern in the repo solves it better. Use when asked whether a PR addresses its issue, matches its description, or could be solved a better way. Does not review code correctness or style.
argument-hint: "[pr-number]"
# Keep these tools synced up with what is configured in the review.yml workflow
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh issue view:*)
  - Bash(git log:*)
  - Bash(git blame:*)
disallowed-tools:
  - Edit
  - Write
  - NotebookEdit
---

# PR review: completeness

Review whether a pull request completely delivers what it claims to deliver.

This is **not** a code-quality review. Do not report style issues, nitpicks, or bugs here unless hey mean a stated requirement is not actually met.

Requires the `gh` CLI, authenticated against this repository.

## 0. Establish the target PR

Use the PR number you were given. If you were not given one, resolve it from the current branch with `gh pr view --json number` - and if that finds nothing, stop and say so rather than reviewing an arbitrary PR.

Everything below refers to that PR as `<pr>`.

## 1. Gather the stated intent

- `gh pr view <pr> --json title,body,baseRefName`
- `gh pr view <pr> --comments`
- Extract every issue number referenced in the title or body. This repo puts it in the title, e.g. `feat(#315): support formatting xlsxform files`.
- Read each one with `gh issue view <number> --comments`.
- If no issue is referenced anywhere, treat the PR description as the sole statement of intent and say so explicitly in your output.

## 2. Restate the requirements

Write out the concrete requirements from those sources as a bullet list, in your own words, including sub-tasks and acceptance criteria. If the sources are too vague to yield any concrete requirement, say so and skip to section 5 rather than guessing at intent.

## 3. Read the change, then follow it out of the diff

- `gh pr diff <pr>` for the change itself.
- Then read and search the working tree to follow the code **outward**: registration sites, exports, barrel files, command tables, call sites, and anything the new code must be wired into in order to actually run.
- A requirement counts as delivered only if the whole path from user entrypoint to new code is complete. New code that is never registered, exported, or called delivers nothing, even when it is correct in isolation.

## 4. Bucket every requirement

Put each requirement from section 2 into exactly one bucket:

- **Delivered** — cite the `file:line` that satisfies it
- **Not delivered** — say what is missing
- **Needs human verification** — cannot be settled by reading code alone (e.g. behaviour against a live CouchDB, output rendering in a real terminal)

## 5. Undisclosed changes

Does the code do anything the PR description never mentions? Report both directions, but this one matters most: an unmentioned behavioural change is the finding a human reviewer is most likely to miss.

## 6. Better approach

Does an existing module, helper, or established pattern in this repo already solve this, or could it be updated to solve it better (more efficiently/simply)? Cite it by path. "No better approach found" is a correct and expected answer — do not invent hypothetical designs to fill space.

## Output

Report sections 4, 5, and 6 as headings, most important first. Be brief and cite `file:line` for every claim.

Return the report as your response and stop there. If you could not establish the PR's intent (section 0 or 2), say so plainly as the report. That is a valid outcome, not a reason to return nothing.

Never modify files. This review only reads.
