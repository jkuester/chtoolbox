import { Array, Effect, Option, pipe, Schema, String } from 'effect';
import { type PullRequestData } from './github.js';
import { mapErrorToGeneric } from './core.js';

/**
 * A GitHub pull request to review, parsed from the `org/repo#number` shorthand (or a full PR URL).
 */
export interface PrTarget {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
}

const PR_SHORTHAND = /^([^/\s]+)\/([^/\s#]+)#(\d+)$/;
const PR_URL = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)(?:[/?#].*)?$/;

const toTarget = (match: RegExpMatchArray): PrTarget => ({
  owner: globalThis.String(match[1]),
  repo: globalThis.String(match[2]),
  pullNumber: Number(match[3]),
});

/**
 * Parses a value into a {@link PrTarget}. Accepts the `org/repo#number` shorthand (e.g. `medic/cht-core#11050`)
 * or a full pull request URL (e.g. `https://github.com/medic/cht-core/pull/11050`).
 */
export const parsePrTarget = (raw: string): Effect.Effect<PrTarget, Error> => pipe(
  String.trim(raw),
  trimmed => Option.fromNullable(PR_SHORTHAND.exec(trimmed) ?? PR_URL.exec(trimmed)),
  Option.map(toTarget),
  Option.map(Effect.succeed),
  Option.getOrElse(() => Effect.fail(new Error(
    `Invalid --pr value: "${raw}". Expected "org/repo#number" (e.g. medic/cht-core#11050) or a pull request URL.`
  ))),
);

/**
 * A single review comment emitted by the `ocr` command in its JSON output.
 */
export class OcrComment extends Schema.Class<OcrComment>('OcrComment')({
  path: Schema.optionalWith(Schema.String, { default: () => '' }),
  start_line: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  end_line: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  content: Schema.optionalWith(Schema.String, { default: () => '' }),
  existing_code: Schema.optional(Schema.String),
  suggestion_code: Schema.optional(Schema.String),
}) {}

/**
 * The top-level JSON document produced by `ocr review --format json`.
 */
export class OcrResult extends Schema.Class<OcrResult>('OcrResult')({
  comments: Schema.optionalWith(Schema.Array(OcrComment), { default: () => [] }),
  warnings: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  message: Schema.optional(Schema.String),
}) {}

const decodeResult = Schema.decodeUnknown(Schema.parseJson(OcrResult));

// `ocr` writes its JSON object to stdout; extract just the object so any stray output lines are ignored.
const extractJson = (raw: string): string => pipe(
  [raw.indexOf('{'), raw.lastIndexOf('}')] as const,
  ([start, end]) => start >= 0 && end >= start
    ? raw.slice(start, end + 1)
    : '{}',
);

/**
 * Parses the raw stdout from `ocr review --format json` into an {@link OcrResult}. Empty/whitespace output (or output
 * with no JSON object) decodes to an empty result.
 */
export const decodeOcrResult = (raw: string): Effect.Effect<OcrResult, Error> => pipe(
  extractJson(raw),
  decodeResult,
  mapErrorToGeneric,
);

const fence = (label: string, code: string): string => `**${label}:**\n\n\`\`\`\n${code}\n\`\`\`\n`;

const commentLocation = ({ path, start_line, end_line }: OcrComment): string => {
  if (start_line && end_line && start_line !== end_line) {
    return `${path}:${start_line.toString()}-${end_line.toString()}`;
  }
  const line = end_line || start_line;
  return line ? `${path}:${line.toString()}` : path;
};

const formatComment = (comment: OcrComment): string => pipe(
  [
    `### \`${commentLocation(comment)}\``,
    comment.content,
    comment.existing_code ? fence('Before', comment.existing_code) : '',
    comment.suggestion_code ? fence('After', comment.suggestion_code) : '',
  ],
  Array.filter(String.isNonEmpty),
  Array.join('\n\n'),
);

const commentsSection = (result: OcrResult): string => pipe(
  result.comments,
  Array.match({
    onEmpty: () => result.message ?? 'No issues found.',
    onNonEmpty: comments => pipe(comments, Array.map(formatComment), Array.join('\n\n---\n\n')),
  }),
);

const warningsSection = (warnings: readonly string[]): string => pipe(
  warnings,
  Array.match({
    onEmpty: () => '',
    onNonEmpty: ws => pipe(
      ws,
      Array.map(w => `- ${w}`),
      Array.join('\n'),
      list => `\n\n## Warnings\n\n${list}`,
    ),
  }),
);

/**
 * Compiles the `ocr` JSON result for a single PR into a readable markdown document.
 */
export const formatReport = (
  target: PrTarget,
  prData: Pick<PullRequestData, 'title' | 'html_url' | 'base' | 'head'>,
  result: OcrResult,
): string => pipe(
  [
    `# ${target.owner}/${target.repo}#${target.pullNumber.toString()}: ${prData.title}`,
    prData.html_url,
    `Reviewed \`${prData.base.ref}...${prData.head.ref}\` with open-code-review.`,
    `## Findings`,
    commentsSection(result),
  ],
  Array.join('\n\n'),
  report => `${report}${warningsSection(result.warnings)}\n`,
);

/**
 * The markdown filename for a PR's review report, e.g. `medic-cht-core-pr11050.md`.
 */
export const reportFileName = ({ owner, repo, pullNumber }: PrTarget): string =>
  `${owner}-${repo}-pr${pullNumber.toString()}.md`;
