Review guidance for this repo's mocha/chai/sinon specs (`test/**/*.spec.ts`).

These files are test code, not production code. Where the general checklist above was written for shipped application code it does not transfer, and this section takes precedence for these files:

- Hardcoded literals are the expected form for fixtures, expected values, and
  URLs in specs. Do not report them.
- Repeated arrange/setup across `it` blocks is acceptable when it keeps each
  test readable in isolation. Report duplication only when it hides a
  behavioral difference between two tests, or is large enough to obscure what
  is being asserted.
- A rejected promise or a thrown error is frequently the behavior under test;
  the absence of error handling in a spec is not a finding.
- `any` and non-null assertions in fixture and stub types are acceptable where
  they keep a test terse.

The rest of the general checklist still holds. Beyond that, report findings that mean a test is wrong, cannot fail, or asserts
the wrong thing.

#### Tests that cannot fail
- Assertions that are unreachable or never executed (inside a callback that
  the code under test never invokes, after an early `return`, or in a `catch`
  that only runs on failure without a fail-fast assertion).
- A missing `await` on the value returned by `Effect.runPromise` /
  `genWithLayer`, so the assertions run after the test has already passed.
- An `it` body that is `async` (or returns a promise) but whose promise is not
  returned or awaited.
- Expected-failure tests that never assert the failure: they must assert on the
  error via `Effect.either`, `Effect.exit`, `expect(...).to.be.rejected`, or an
  equivalent — not merely run the effect and pass.
- Assertions guaranteed true regardless of behavior (`expect(x).to.exist` on a
  literal, comparing a value to itself, asserting a stub was configured rather
  than called).

#### Wrong assertions
- Assertion asserts something other than what the test name claims.
- `expect(stub.args)` / `calledWith` checks that omit arguments the behavior
  depends on, or that assert the wrong call index.
- Deep-equality assertions that would pass for a wrong value (e.g. asserting a
  subset via `deep.include` where exact equality is what the test claims).
- Stubbing the very function under test, so the assertion verifies the stub
  rather than the real implementation.

#### Sinon and shared state
- Stubs created on existing objects using the shared `sandbox` from
  `test/utils/base.ts` — that sandbox is only `reset` after each test, never
  `restore`d, so it must be used exclusively for standalone stubs. Object
  methods must be stubbed with `sinon.stub(obj, 'fn')` so the global
  `sinon.restore()` in `mochaHooks.afterEach` undoes them.
- State mutated at `describe` scope (or on an imported module) that leaks
  between tests and makes them order-dependent.
- Stub behavior queued with `onCall`/`resolves` that does not match the number
  of calls the code under test actually makes, leaving a later call
  unstubbed.

#### Coverage without verification
This project enforces 100% coverage, so watch for tests added to satisfy the
gate rather than to verify behavior: a test that invokes a branch but asserts
nothing about its result, or asserts only that the call did not throw when the
branch has an observable outcome.

#### Missing cases for the changed source
When a spec accompanies a source change in the same diff, check that each new
branch, error path, and boundary in that source has a corresponding assertion.
Flag a specific untested behavior, not a general request for more tests.
