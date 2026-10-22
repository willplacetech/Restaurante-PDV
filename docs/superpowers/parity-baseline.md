# PDV-Cafe parity baseline

Recorded: 2026-10-22

## Repository state

| Project | Branch | Commit | Working tree |
|---|---|---|---|
| PDV-Cafe (read-only reference) | `feature/pwa-offline-sincronizacao` | `4475c86349a2f414c0084e8f7beb4d43384c1a5a` | Clean |
| Restaurante-PDV (destination) | `main` | `d3132ee2111270f1b20bf13d470eda921d2a262a` | Existing docs for the approved spec/plan plus this baseline; no product source changes |

At these commits, the reference contains 579 tracked files and the destination
contains 204 tracked files. File count is a scope indicator, not a measure of
functional parity.

The destination was already on `main` before baseline work. The user explicitly
requested implementation in this repository. No separate worktree tool was
available, so documentation-only baseline work proceeded in the existing
checkout. PDV-Cafe was not checked out, edited, installed, or used for
commands.

## Runtime and package scripts

- Node.js: `v24.19.0`
- npm: `11.17.0`
- Dependencies were already installed in `back-end/node_modules` and
  `front-end/node_modules`; no package installation was run.

| Project | Backend scripts | Frontend scripts |
|---|---|---|
| PDV-Cafe reference | `test` (`test:unit` + `test:integration`), `test:unit`, `test:integration`, `test:coverage` | `build`, `lint`, `test:unit`, `test:frontend` |
| Restaurante destination | root `npm test` (Jest); backend package lists `test`, `test:watch`, `test:coverage` | `build`, `lint`, `test:frontend` |

Root convenience scripts in Restaurante invoke frontend tools through a
Windows `cd front-end && ...` command. The root Cypress invocation did not
resolve the frontend-local executable in this environment; invoking the
frontend package script directly reached Cypress.

## Executed destination checks

| Check | Result | Evidence |
|---|---|---|
| `npm test` | Blocked, exit 1 | `cross-env` is not recognized. `back-end/node_modules/cross-env/src/bin/cross-env.js` is absent. |
| Direct Jest fallback: from `back-end`, set `NODE_ENV=test` and run `node node_modules/jest/bin/jest.js --verbose --runInBand` | Failed, exit 1: 51 passed, 2 failed, 53 total | Both failures are in `tests/integration/api.test.js`, expense recurrence due dates: expected Jan 31 2027, received Jan 10 2027; expected Oct 20 2026, received Oct 21 2026. Five suites passed, one failed. |
| `npm --prefix front-end run build` | Failed, exit 1 | Invalid JSX in `front-end/src/App.jsx:92` (`<Route path "/cozinha"...`) and NUL characters corrupt CSS at `front-end/src/styles/theme.css:1034`. Vite also reports the output glob is empty after build failure. |
| `npm --prefix front-end run lint` | Failed, exit 1 | ESLint reports 225 problems: 214 errors and 11 warnings. Examples include Cypress globals (`Cypress`, `cy`, `describe`, `it`) treated as undefined; parse errors and other frontend diagnostics are included in the full output. |
| `npm run test:frontend` | Blocked, exit 1 | Root script cannot resolve `cypress` from its current PATH. |
| Direct frontend script: `npm --prefix front-end run test:frontend` | Blocked, exit 1 | Cypress starts but cannot reach configured `http://localhost:5173`; frontend server was not running. No E2E assertions ran. |
| `git diff --check` | Passed | No whitespace errors in staged/tracked diffs at the time of the check. New documents were also checked directly for trailing whitespace. |

These are results reproduced on the baseline during this task, not inferred
from earlier reports. E2E execution remains unverified until the application
and required backend are started using the test configuration.

## Historical reports (not treated as current test results)

An earlier review reported 51 backend tests passing and 2 failing, build
failure in the same frontend files, and 79 lint errors with 11 warnings.
Current execution reproduces the two backend test failures and build blockers,
but the current lint count differs (214 errors, 11 warnings). Use the current
command output above for future comparisons.

## Safety and scope

- The reference repository remained at commit
  `4475c86349a2f414c0084e8f7beb4d43384c1a5a` with a clean working tree.
- No credentials, environment values, production data, or secret files were
  read into this record.
- No dependencies were installed, no migrations were run, and no deployment
  was attempted.
- Vite generated ignored build artifacts while attempting the failed build;
  no application source file was edited by that command.
