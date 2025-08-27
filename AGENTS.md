AGENT QUICK REFERENCE (keep ~20 lines)

Build/Lint/Test:
- Install deps: npm ci (Node >=20). Type-check happens via lint.
- Lint & type + dead code check: npm run lint (tsgo, eslint, knip). Fix issues before commits.
- Full test suite with coverage (100% enforced): npm test (c8 + mocha).
- Single test file: npx mocha "test/path/to/file.spec.ts" --require test/utils/base.ts --node-option import=tsx
- Single test grep: npx mocha "test/**/*" --grep "pattern" --require test/utils/base.ts --node-option import=tsx
- Run specific test with line focus: add `it.only(...)` or `describe.only(...)`.

Code Style / Conventions:
- ESM only ("type":"module"); use explicit .js in emitted imports if rewriting; prefer relative imports with explicit extension when TS requires.
- Strict TS (extends strictest + node20); no implicit any; explicit return types for exported functions (@typescript-eslint/explicit-module-boundary-types enforced).
- Functional style favored (Effect library). Avoid side effects; compose Effects; provide layers in tests via genWithLayer helper.
- Naming: files kebab-case; types PascalCase; variables camelCase; constants UPPER_SNAKE only if truly constant; test files mirror source name.
- Prefer expressions over declarations (func-style=expression). Arrow functions where concise; keep arrow spacing.
- Error handling: return Effect<E, A>; avoid throwing; convert external promise rejections into Effects; use typed errors or discriminated unions; never swallow errors.
- Imports: group builtin/external/internal; no unused (eslint); avoid default export—prefer named.
- Formatting enforced by eslint rules: 1TBS braces, unix linebreaks, consistent newline for arrays/functions, no nested ternaries, dot-notation, spacing rules (arrow, comma, keyword, key, semi, template-curly, rest-spread no space).
- Testing: use chai + sinon + deep-equal-in-any-order + chai-exclude; reset sandbox afterEach (see test/utils/base.ts). Use Effect.runPromise for async.
- Coverage gates 100% (branches/lines/functions/statements) per .c8rc.json; add tests rather than lowering thresholds.
- Avoid editing generated or ignored paths: bin/index.js, dist/, .c8_output/.

CI: GitHub Actions runs lint & tests on Node 20/22/24; keep changes compatible. No Cursor/Copilot rule files present.
