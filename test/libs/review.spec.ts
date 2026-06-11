import { describe, it } from 'mocha';
import { Effect, Either } from 'effect';
import { expect } from 'chai';
import {
  decodeOcrResult,
  formatReport,
  parsePrTarget,
  type PrTarget,
  reportFileName,
} from '../../src/libs/review.ts';

const run = (test: Effect.Effect<void, Error>) => (): Promise<void> => Effect.runPromise(test);

const TARGET: PrTarget = { owner: 'medic', repo: 'cht-core', pullNumber: 11050 };

const PR_DATA = {
  title: 'Fix the thing',
  html_url: 'https://github.com/medic/cht-core/pull/11050',
  base: { ref: 'master' },
  head: { ref: 'fix/the-thing' },
} as Parameters<typeof formatReport>[1];

describe('Review libs', () => {
  describe('parsePrTarget', () => {
    it('parses org/repo#number shorthand', run(Effect.gen(function* () {
      const target = yield* parsePrTarget('medic/cht-core#11050');
      expect(target).to.deep.equal(TARGET);
    })));

    it('trims surrounding whitespace', run(Effect.gen(function* () {
      const target = yield* parsePrTarget('  medic/cht-core#11050  ');
      expect(target).to.deep.equal(TARGET);
    })));

    it('parses a full PR URL', run(Effect.gen(function* () {
      const target = yield* parsePrTarget('https://github.com/medic/cht-core/pull/11050');
      expect(target).to.deep.equal(TARGET);
    })));

    it('parses a PR URL with a trailing path', run(Effect.gen(function* () {
      const target = yield* parsePrTarget('https://github.com/medic/cht-core/pull/11050/files');
      expect(target).to.deep.equal(TARGET);
    })));

    [
      'not-a-pr',
      'medic/cht-core',
      'medic/cht-core#',
      'medic/cht-core#abc',
      'https://github.com/medic/cht-core/issues/11050',
    ].forEach(raw => it(`fails on invalid value: ${raw}`, run(Effect.gen(function* () {
      const either = yield* parsePrTarget(raw).pipe(Effect.either);
      if (Either.isRight(either)) {
        expect.fail('Expected a parse error');
      }
      expect(either.left).to.be.instanceOf(Error);
      expect(either.left.message).to.contain(raw);
    }))));
  });

  describe('decodeOcrResult', () => {
    it('decodes findings', run(Effect.gen(function* () {
      const raw = JSON.stringify({
        comments: [{ path: 'a.ts', start_line: 1, end_line: 2, content: 'oops' }],
        warnings: ['heads up'],
      });
      const result = yield* decodeOcrResult(raw);
      expect(result.comments).to.have.length(1);
      expect(result.comments[0]).to.include({ path: 'a.ts', start_line: 1, end_line: 2, content: 'oops' });
      expect(result.warnings).to.deep.equal(['heads up']);
    })));

    it('decodes a clean message result', run(Effect.gen(function* () {
      const result = yield* decodeOcrResult(JSON.stringify({ message: 'Looks good to me.' }));
      expect(result.comments).to.be.empty;
      expect(result.message).to.equal('Looks good to me.');
    })));

    it('ignores stray output around the JSON object', run(Effect.gen(function* () {
      const raw = `some log line\n${JSON.stringify({ message: 'ok' })}\ntrailing`;
      const result = yield* decodeOcrResult(raw);
      expect(result.message).to.equal('ok');
    })));

    it('treats empty output as an empty result', run(Effect.gen(function* () {
      const result = yield* decodeOcrResult('   ');
      expect(result.comments).to.be.empty;
      expect(result.warnings).to.be.empty;
    })));

    it('fails on malformed JSON', run(Effect.gen(function* () {
      const either = yield* decodeOcrResult('{ "comments": [ }').pipe(Effect.either);
      if (Either.isRight(either)) {
        expect.fail('Expected a decode error');
      }
      expect(either.left).to.be.instanceOf(Error);
    })));
  });

  describe('formatReport', () => {
    it('renders findings with before/after code blocks', run(Effect.gen(function* () {
      const result = yield* decodeOcrResult(JSON.stringify({
        comments: [
          {
            path: 'src/a.ts',
            start_line: 10,
            end_line: 12,
            content: 'Possible null deref',
            existing_code: 'foo.bar',
            suggestion_code: 'foo?.bar',
          },
        ],
        warnings: ['truncated diff'],
      }));

      const report = formatReport(TARGET, PR_DATA, result);

      expect(report).to.contain('# medic/cht-core#11050: Fix the thing');
      expect(report).to.contain('https://github.com/medic/cht-core/pull/11050');
      expect(report).to.contain('`master...fix/the-thing`');
      expect(report).to.contain('### `src/a.ts:10-12`');
      expect(report).to.contain('Possible null deref');
      expect(report).to.contain('**Before:**');
      expect(report).to.contain('foo.bar');
      expect(report).to.contain('**After:**');
      expect(report).to.contain('foo?.bar');
      expect(report).to.contain('## Warnings');
      expect(report).to.contain('- truncated diff');
    })));

    it('renders the clean message and omits the warnings section', run(Effect.gen(function* () {
      const result = yield* decodeOcrResult(JSON.stringify({ message: 'No comments generated.' }));
      const report = formatReport(TARGET, PR_DATA, result);
      expect(report).to.contain('No comments generated.');
      expect(report).to.not.contain('## Warnings');
    })));

    it('falls back to "No issues found." when there are no comments and no message', run(Effect.gen(function* () {
      const result = yield* decodeOcrResult(JSON.stringify({ comments: [] }));
      const report = formatReport(TARGET, PR_DATA, result);
      expect(report).to.contain('No issues found.');
    })));

    it('renders comments with partial/missing line info and applies field defaults', run(Effect.gen(function* () {
      const result = yield* decodeOcrResult(JSON.stringify({
        comments: [
          {},                                                  // all fields default (path '', lines 0, content '')
          { path: 'b.ts', end_line: 5, content: 'only end' },  // single line
          { path: 'c.ts', start_line: 7, end_line: 7, content: 'same line' },
        ],
      }));

      // defaults applied during decode
      expect(result.comments[0]).to.include({ path: '', start_line: 0, end_line: 0, content: '' });

      const report = formatReport(TARGET, PR_DATA, result);
      expect(report).to.contain('### ``');        // empty path/no line → just the (empty) path
      expect(report).to.contain('### `b.ts:5`');   // single line via end_line
      expect(report).to.contain('### `c.ts:7`');   // start_line === end_line collapses to one line
    })));
  });

  describe('reportFileName', () => {
    it('builds a per-PR filename', () => {
      expect(reportFileName(TARGET)).to.equal('medic-cht-core-pr11050.md');
    });
  });
});
