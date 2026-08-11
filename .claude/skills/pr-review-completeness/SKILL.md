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

This is **not** a code-quality review. Do not report style issues, nitpicks, or bugs here unless they mean a stated requirement is not actually met.

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

Write out the concrete requirements from those sources as a bullet list, in your own words, including sub-tasks and acceptance criteria.

Derive a requirement only from a statement about **behaviour** — what the code will do, or an acceptance criterion. Descriptions also contain rationale, benefits, and motivation ("this is faster", "this makes batch jobs possible"); those are not requirements and must not be converted into one. Where you decline to treat a claim as a requirement, list it under "Claims not treated as requirements" so the reader can disagree with the call.

The title is a valid source of behavioural claims, not just the body — a title like `feat: add support for X` states that X now exists. Skip section 4 only when the title **and** the body both fail to yield a single behavioural claim; a thin body alongside a substantive title is not grounds for skipping.

If the sources are too vague to yield any concrete requirement, say so and skip to section 5 rather than guessing at intent.

## 3. Read the change, then follow it out of the diff

- `gh pr diff <pr>` for the change itself.
- Then read and search the working tree to follow the code **outward**: registration sites, exports, barrel files, command tables, call sites, and anything the new code must be wired into in order to actually run.
- A requirement counts as delivered only if the whole path from user entrypoint to new code is complete. New code that is never registered, exported, or called delivers nothing, even when it is correct in isolation.
- Where the PR adds user-facing surface (a command, endpoint, export, menu item), state in the report that you traced that path and cite the registration site. A diff-only reader cannot do this, so make it visible rather than leaving it implied by a citation.
- Where a requirement's delivery depends on a library or framework **default** rather than on code in the diff, do not assert the default from memory. Either cite documentation for it, or put the requirement in **Pending verification** and name the default you could not confirm.

## 4. Bucket every requirement

Put each requirement from section 2 into exactly one of these three buckets:

- **Delivered** — cite the `file:line` that satisfies it
- **Not delivered** — say what is missing
- **Pending verification** — a requirement whose delivery cannot be settled by reading code alone (e.g. behaviour against a live CouchDB, output rendering in a real terminal)

Then, separately, list **Preconditions to confirm**: operational facts the change depends on that are not requirements at all and belong to no bucket — a secret or environment variable that must exist, an external binary or service that must be reachable, a model or API version that must still be valid. These are a checklist for whoever merges. Do not count them as requirements, and do not fold them into the three buckets above.

## 5. Undisclosed changes

Does the PR change anything its description never mentions? Report both directions, but this one matters most: an unmentioned change is the finding a human reviewer is most likely to miss.

Do not limit this to source files. Walk the full file list from the diff and check the surfaces reviewers habitually skim, because that is where undisclosed scope survives:

## 6. Better approach

Does an existing module, helper, or established pattern in this repo already solve this, or could it be updated to solve it better (more efficiently/simply)? Cite it by path. "No better approach found" is a correct and expected answer — do not invent hypothetical designs to fill space.

## Output

Report sections 4, 5, and 6 under the headings "Requirements", "Undisclosed Changes", and "Alternative Approaches". Be brief and cite `file:line` for every claim.

Use GitHub flavored Markdown. Write impersonally. Report what the code does and what was checked; never narrate yourself ("I traced…", "I confirmed…"). This is published as a bot comment, not a message from a person.

Return the report as your response and stop there. If you could not establish the PR's intent (section 0 or 2), say so plainly as the report. That is a valid outcome, not a reason to return nothing.

Never modify files. This review only reads.
