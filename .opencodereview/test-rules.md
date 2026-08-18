#### General test review rules

Test code, not production code. These override the checklist above for these files:

- Hardcoded literals in fixtures, expected values, and URLs: expected here, never report.
- Repeated setup across `it` blocks: fine. Report duplication only when it hides a behavioral difference between tests or obscures what is asserted.
- Missing error handling: not a finding — rejections and throws are usually the behavior under test.
- `any` and non-null assertions in fixture and stub types: fine.

Otherwise the checklist above holds. Beyond it, report only what makes a test wrong, unable to fail, or asserting the wrong thing.

#### Tests that cannot fail
- Assertions never executed: in a callback the code under test never invokes, after an early `return`, or in a `catch` with no fail-fast assertion.
- Missing `await` on `Effect.runPromise` / `genWithLayer`, or an async `it` whose promise is neither returned nor awaited — the assertions run after the test has already passed.
- Expected-failure tests that never assert the error via `Effect.either`, `Effect.exit`, or `expect(...).to.be.rejected`, and merely run the effect.
- Assertions true regardless of behavior: `to.exist` on a literal, a value compared to itself, asserting a stub's configuration rather than its calls.

#### Wrong assertions
- Asserts something other than what the test name claims.
- `calledWith` / `stub.args` omitting arguments the behavior depends on, or checking the wrong call index.
- Subset assertions (`deep.include`) where the claim requires exact equality.
- Stubbing the function under test, so only the stub is verified.

#### Sinon and shared state
- The shared `sandbox` in `test/utils/base.ts` is `reset` but never `restore`d, so it is for standalone stubs only; object methods need `sinon.stub(obj, 'fn')` to be undone by `sinon.restore()` in `mochaHooks.afterEach`.
- `describe`-scope or imported-module state that leaks between tests and makes them order-dependent.
- `onCall`/`resolves` queues shorter than the number of calls the code under test makes, leaving a later call unstubbed.

#### Coverage without verification
Coverage is gated at 100%, so watch for tests written for the gate: a branch invoked but its result unasserted, or only "did not throw" asserted where the branch has an observable outcome.
