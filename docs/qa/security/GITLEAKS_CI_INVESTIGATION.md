# Gitleaks CI Investigation

**Updated:** 2026-11-24  
**Report handling:** This document contains finding metadata and repository references only. It contains no secret values or raw finding excerpts.

## Status

GitHub Actions reported four findings across 414 scanned commits with Gitleaks v8.30.0. Phase 4 added four exact fingerprint entries in the local worktree. The isolated after-scan completed with zero findings. GitHub verification is pending. The earlier diagnostic workflow draft remains local and is outside the Phase 4 commit scope.

The original CI log did not identify the four findings because the command requested no report file. The isolated reproduction below identified all four as historical synthetic billing test fixtures. GitHub continues to use the original workflow.

## Isolated Reproduction and Classification

[CI run #299 on PR #308](https://github.com/Yesuaaa/Nexus/actions/runs/45400277275) reported four findings across 414 scanned commits and exited with code 1. Its checkout log identified the PR merge commit as `ab18f16f7488af3cbc09adce642e5c379b3b6bc4`. The local reproduction fetched current remote heads and tags into a disposable repository using the same refspecs as CI and checked out that exact merge commit. Remote refs are live, so this does not establish that every ref tip still matched the original runner snapshot.

The native Windows Gitleaks v8.30.0 release archive was verified against its published SHA-256 checksum. From the disposable checkout, with stdout and stderr captured privately, the command was:

```text
gitleaks git . --redact=100 --no-banner --log-opts=--all --gitleaks-ignore-path=.gitleaksignore --report-format=json --report-path=../findings.json
```

The scan reproduced **414 commits scanned, four findings, and exit code 1**. Each record used the built-in `generic-api-key` rule. All four records pointed to commit `7fbf2b2737051eea03ceabe6895da86f2e1c359f` in `apps/api/tests/features/billing/billing-read.test.ts`.

| StartLine | Classification              | Evidence                                                                                         |
| --------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| 99        | CONFIRMED SYNTHETIC FIXTURE | The detector matched the `idempotencyKey` property in a billing test fixture.                    |
| 274       | CONFIRMED SYNTHETIC FIXTURE | The detector matched another `idempotencyKey` property in the same test file.                    |
| 411       | CONFIRMED SYNTHETIC FIXTURE | The match was on the `idempotencyKey` property. Nearby authorization setup was a separate field. |
| 516       | CONFIRMED SYNTHETIC FIXTURE | The match was on the fixture's `idempotencyKey` property in the same test file.                  |

The file declares offline billing tests using PGlite. For all four records, the redacted match identifies the idempotency property used for request or record deduplication. The historical file is absent from both the PR merge tree and feature branch HEAD, and an automated comparison found none of the four exact historical lines in any tracked file in either tree. This does not establish that the same literals never appear in a different form elsewhere.

Credential rotation is not indicated for these fixtures. The deployed ignore file still lacks the four entries, so the GitHub Secret scan continues to report the historical fixtures until the changes are published.

## Phase 4 Exact Fingerprint Remediation

At task entry, branch `293-test-full-system-audit-for-verifying-recent-changes` was at `03340d6136ec7d6680b9bbc68fa5738370d29398`. The index was empty. The local CI draft, page-verification ledger, seven PG-013 documents, and this report were already present as worktree changes.

The earlier temporary report had been removed. A fresh checksum-verified Gitleaks v8.30.0 run supplied each exact `Fingerprint`, and each matched the scanner's commit, file, rule, and start line. In the finding tree, exact literal comparisons located only test uses. Each matched literal is an `idempotencyKey` field in the offline PGlite billing test. Exact literal comparisons found no matches in the current feature or PR merge tree. This is repository evidence of synthetic fixture use. No production credential exposure was found.

The four approved entries are:

```text
7fbf2b2737051eea03ceabe6895da86f2e1c359f:apps/api/tests/features/billing/billing-read.test.ts:generic-api-key:99
7fbf2b2737051eea03ceabe6895da86f2e1c359f:apps/api/tests/features/billing/billing-read.test.ts:generic-api-key:274
7fbf2b2737051eea03ceabe6895da86f2e1c359f:apps/api/tests/features/billing/billing-read.test.ts:generic-api-key:411
7fbf2b2737051eea03ceabe6895da86f2e1c359f:apps/api/tests/features/billing/billing-read.test.ts:generic-api-key:516
```

The three existing entries were preserved byte for byte. The final ignore file contains seven unique exact entries. The workflow was unchanged by Phase 4. Its pinned scanner, full checkout, `--all` scope, detection rules, and failure behavior remain in effect.

| Focused validation                                                                                                                                                      | Result                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `gitleaks version`                                                                                                                                                      | Exit 0, version 8.30.0.                                                                          |
| Baseline `gitleaks git . --redact=100 --no-banner --log-opts=--all --gitleaks-ignore-path=.gitleaksignore --report-format=json --report-path=../before.json`            | Exit 1, 414 commits and exactly four findings.                                                   |
| Same history scan with the revised ignore file and `--report-path=../after.json`                                                                                        | Exit 0, 414 commits and zero findings. The before and after ref manifests and merge SHA matched. |
| `gitleaks git . --staged --redact=100 --no-banner --gitleaks-ignore-path=.gitleaksignore --report-format=json --report-path=../control.json` in a disposable repository | Exit 1, one unrelated synthetic `generic-api-key` finding.                                       |

The test used the native Windows release with the exact merge SHA from run #299 and current remote refs fetched using the runner's refspecs. This reproduces the observed scan size and findings. The historical runner's complete ref-tip manifest and the next GitHub runner state remain unverified.

| Repository quality check | Exit | Result                                                                                                    |
| ------------------------ | ---- | --------------------------------------------------------------------------------------------------------- |
| `pnpm format`            | 0    | Applied repository formatting.                                                                            |
| `pnpm format:check`      | 0    | All matched files passed Prettier.                                                                        |
| `pnpm lint`              | 0    | ESLint passed with zero warnings.                                                                         |
| `pnpm typecheck`         | 0    | Web and API typechecks passed. The generated Next.js declaration was restored to its task-entry contents. |
| `git diff --check`       | 0    | No diff whitespace errors.                                                                                |

The disposable checkout, scanner, JSON reports, and captured logs were removed. No raw scan report was added to the repository.

For GitHub verification, publish only the two Phase 4 files after separate authorization. On the resulting PR run, confirm the original Secret scan executes with full history and succeeds. Investigate any new findings independently.

## Repository Baseline

| Item              | Value                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Branch            | `293-test-full-system-audit-for-verifying-recent-changes`                                             |
| HEAD              | `03340d6136ec7d6680b9bbc68fa5738370d29398`                                                            |
| Upstream          | `origin/293-test-full-system-audit-for-verifying-recent-changes`                                      |
| Remote            | `https://github.com/Yesuaaa/Nexus.git`                                                                |
| Local refs        | 219 total: 60 local branches, 150 `origin/*` refs, 8 `refs/codex/*`, and one stash ref; no local tags |
| Reachable commits | 658 with `git rev-list --count --all`; 655 from branches, remotes, and tags                           |

At the start of this investigation, the worktree already had a modified `docs/qa/page-verification/PHASE_2_PROGRESS_LEDGER.md` and untracked `docs/qa/page-verification/phase-2/PG-013/` content. These are unrelated user changes.

The current GitHub repository exposes 60 live branches. All 60 live branch tips match the local `origin/*` tips, but this clone also retains 90 additional remote-tracking refs, local Codex refs, and a stash ref. Therefore, a local `--all` scan would include refs that are not part of the current remote branch set. The local and CI reference sets are not equivalent.

## Workflow, Configuration, and Command

The `secrets` job in `.github/workflows/ci.yml` checks out full history with `fetch-depth: 0` and disables persisted checkout credentials. The Phase 2 local draft invocation was:

```bash
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$GITHUB_WORKSPACE:/repo:ro" \
  -v "$report_dir:/out:rw" \
  ghcr.io/gitleaks/gitleaks:v8.30.0 \
  git /repo --redact=100 --no-banner --log-opts="--all" \
  --gitleaks-ignore-path=/repo/.gitleaksignore \
  --report-format=json --report-path=/out/findings.json
```

The pinned tool version is **Gitleaks v8.30.0**. The command retains the full-history and `--all` scan scope and passes the repository's `.gitleaksignore` explicitly. Its stdout and stderr are suppressed; the workflow prints only the finding count and a JSON allowlist of `RuleID`, `Description`, `File`, `StartLine`, and `Commit`.

`.gitleaksignore` is the only Gitleaks-specific configuration found. The baseline ignore file contained three exact fingerprints, all for `generic-api-key` findings in test fixtures.

## Reproduction Results

The GitHub Actions run for the current HEAD is [CI run #298](https://github.com/Yesuaaa/Nexus/actions/runs/45384625637), triggered by a pull request on 2026-11-24. Its head SHA is `03340d6136ec7d6680b9bbc68fa5738370d29398`.

| Check               | Result                                                          |
| ------------------- | --------------------------------------------------------------- |
| Secret scan         | Failed; Gitleaks reported 4 findings across 414 scanned commits |
| Formatting          | Passed                                                          |
| Lint                | Passed                                                          |
| Typecheck and build | Passed                                                          |
| Dependency scan     | Passed                                                          |

During the initial investigation, the Docker client exited before starting a container because the Docker engine was unavailable. The later isolated reproduction used a verified temporary native executable, as documented above.

The Git graph count of 658 local reachable commits is not directly comparable to Gitleaks' “414 scanned commits” statistic; Gitleaks scans commit patches, while `git rev-list --count --all` counts reachable commit objects. The extra local refs nevertheless make the local `--all` reference set broader than the CI checkout's current live remote branches.

## Redacted Finding Inventory

### Four findings before the isolated reproduction

The job log provides the finding count and scan count only. It does not provide report records. These entries preserve the required inventory without inventing metadata:

| Finding | RuleID      | File        | Line        | Commit      | Detection category | Current source vs. history | Classification              |
| ------- | ----------- | ----------- | ----------- | ----------- | ------------------ | -------------------------- | --------------------------- |
| CI-1    | Not emitted | Not emitted | Not emitted | Not emitted | Not emitted        | Unresolved                 | Unresolved potential secret |
| CI-2    | Not emitted | Not emitted | Not emitted | Not emitted | Not emitted        | Unresolved                 | Unresolved potential secret |
| CI-3    | Not emitted | Not emitted | Not emitted | Not emitted | Not emitted        | Unresolved                 | Unresolved potential secret |
| CI-4    | Not emitted | Not emitted | Not emitted | Not emitted | Not emitted        | Unresolved                 | Unresolved potential secret |

Gitleaks v8.30.0's default summary logs the finding count. Finding records are written only when a report path is configured; the CI command supplies no `--report-path` or `--report-format`. The workflow therefore cannot support exact per-finding classification from its retained log. See the pinned [Gitleaks v8.30.0 command implementation](https://github.com/gitleaks/gitleaks/blob/v8.30.0/cmd/root.go#L1996-L2099).

### Existing exact ignores (separate from the four active CI findings)

These three fingerprints are already documented in `.gitleaksignore`. They are contextual known findings and must not be assumed to be the four unignored CI findings without matching report fingerprints.

| RuleID            | Finding commit                             | File and line                                        | Current-source analysis                                                                              | Classification and evidence                                                                                                            |
| ----------------- | ------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `generic-api-key` | `ba51e389f5576d73dbee28dc76f8df2b39072c7e` | `apps/api/src/client-requests.test.ts:205`           | Historical only; that file no longer exists at HEAD. The file and line exist at the recorded commit. | Synthetic request-deduplication UUID in an offline test fixture. The `.gitleaksignore` comment explicitly identifies it as non-secret. |
| `generic-api-key` | `69c99158869d54cf98b7c9969496f8e932324b1b` | `apps/api/tests/features/payroll/phase5.test.ts:389` | The test file exists at HEAD, and the historical fixture value remains in that file.                 | Synthetic payroll-simulator idempotency key in an offline test. The `.gitleaksignore` comment explicitly identifies it as non-secret.  |
| `generic-api-key` | `69c99158869d54cf98b7c9969496f8e932324b1b` | `apps/api/tests/features/payroll/phase5.test.ts:448` | The test file exists at HEAD, and the historical fixture value remains in that file.                 | Synthetic payroll-simulator idempotency key in an offline test. The `.gitleaksignore` comment explicitly identifies it as non-secret.  |

The workflow passes `/repo/.gitleaksignore` as the ignore path, and the entries use the exact-fingerprint form described by Gitleaks. The path and format are consistent with the v8.30.0 interface. The missing CI report prevents verifying which active fingerprints were considered or whether any new finding duplicates an existing fixture under a different fingerprint.

## Initial Root Cause and Security Impact Assessment

The immediate CI failure is four findings that were not excluded by the configured exact fingerprints. The available evidence does not establish whether these are real credentials, synthetic fixtures, or other false positives. The root cause of the diagnostic gap is that the workflow requests no structured report and retains only the aggregate count.

Until identified, each active finding should be treated as a potentially exposed credential. If a value is a valid credential, it may remain usable even if it exists only in history or has since been removed from the current tree. The CI result alone does not prove the values are active credentials.

## Initial Recommendations Before Classification

| Finding | Priority              | Recommended handling                                                                                                                                                                                                                                                                                                      |
| ------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI-1    | High until classified | Obtain redacted metadata; inspect the exact commit and source context. If it is a valid credential, revoke or rotate it with its provider and remove it from current source. If it is a proven synthetic fixture, retain only a narrowly scoped fingerprint exception or replace it with a clearly non-secret test value. |
| CI-2    | High until classified | Same verification path as CI-1; do not add an ignore before establishing that the value is synthetic or invalid.                                                                                                                                                                                                          |
| CI-3    | High until classified | Same verification path as CI-1; if historical-only but valid, revoke or rotate first, then decide separately whether history cleanup is needed.                                                                                                                                                                           |
| CI-4    | High until classified | Same verification path as CI-1; preserve the finding metadata and provider validation outcome in the incident record without storing the secret value.                                                                                                                                                                    |

Do not rewrite history as part of this investigation. If history cleanup is later judged necessary, plan it separately after any credential rotation and coordinate affected branches, forks, and collaborators.

The three existing test-fixture ignores are narrowly scoped and supported by source comments. No change to them is recommended from the evidence collected here. Avoid broad path, rule, or regex ignores.

## Phase 2 Diagnostic Design (Local Draft, Outside the Phase 4 Commit)

The Secret scan step now creates a mode-restricted directory under `RUNNER_TEMP`, binds it into the container as `/out:rw`, and keeps the checkout mounted at `/repo:ro`. The container runs as the runner UID/GID so the host runner can read and remove the report. Gitleaks writes JSON to `/out/findings.json` with `--redact=100`.

The step captures the container/Gitleaks exit status in an `if` statement, so exit status 1 for findings does not prevent summary generation. It validates the JSON report shape and required metadata field types, treats both an empty array and `null` as zero findings, then prints the count and only `RuleID`, `Description`, `File`, `StartLine`, and `Commit`. Docker stdout/stderr and `jq` parse errors are suppressed; matched text, secrets, and code snippets are never printed.

The report directory is removed by an EXIT trap after summary processing, including error paths. If the scan reports success but report generation or sanitization fails, the step exits nonzero. For any nonzero scan exit, the step returns that scan exit status after attempting the summary. No report artifact, cache, or persistent report location is configured. The Secret scan remains blocking; no `continue-on-error` was added.

### Security invariants preserved

- Gitleaks remains pinned to v8.30.0.
- `actions/checkout` retains `fetch-depth: 0` and `persist-credentials: false`.
- `--log-opts="--all"` and `/repo/.gitleaksignore` remain in the scan.
- The repository bind mount is read-only; only the runner temporary report mount is writable.
- No detection rules, ignore entries, application source, history, or CI enforcement behavior were changed.
- The raw JSON report is never printed, uploaded, cached, or committed.

### Phase 2 local validation

- PyYAML parsed the complete workflow, and `bash -n` accepted the extracted Gitleaks step.
- Mock-only shell simulations covered: findings (exit 1 preserved and summary emitted), no findings (`null` treated as zero and exit 0), a scan/container error (exit 2 preserved), and a zero exit with a missing report (converted to exit 2).
- The finding simulation verified the output had only `RuleID`, `Description`, `File`, `StartLine`, and `Commit`; the synthetic omitted-field marker did not appear. The report directory was removed in each scenario.
- The mock container wrote through the `/out:rw` mount and the workflow consumed the report from the mounted path. No Gitleaks scan was run locally.
- The modified workflow has not yet executed on GitHub. There is no Phase 2 CI result and no confirmed classification for the four findings.

### Classification plan

After the modified workflow runs, classify each finding without copying its secret value or matched line into logs or documentation:

| Finding | RuleID         | File           | Commit         | Current-source or historical-only | Classification              | Evidence                          | Rotation requirement                      | Proposed remediation                                                                       | Residual risk         |
| ------- | -------------- | -------------- | -------------- | --------------------------------- | --------------------------- | --------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------- |
| CI-1    | Pending report | Pending report | Pending report | Pending inspection                | UNRESOLVED POTENTIAL SECRET | Prior CI retained only the count. | None automated; rotate if confirmed real. | Inspect source/commit context after obtaining metadata; do not add an ignore before proof. | High until validated. |
| CI-2    | Pending report | Pending report | Pending report | Pending inspection                | UNRESOLVED POTENTIAL SECRET | Prior CI retained only the count. | None automated; rotate if confirmed real. | Inspect source/commit context after obtaining metadata; do not add an ignore before proof. | High until validated. |
| CI-3    | Pending report | Pending report | Pending report | Pending inspection                | UNRESOLVED POTENTIAL SECRET | Prior CI retained only the count. | None automated; rotate if confirmed real. | Inspect source/commit context after obtaining metadata; do not add an ignore before proof. | High until validated. |
| CI-4    | Pending report | Pending report | Pending report | Pending inspection                | UNRESOLVED POTENTIAL SECRET | Prior CI retained only the count. | None automated; rotate if confirmed real. | Inspect source/commit context after obtaining metadata; do not add an ignore before proof. | High until validated. |

Use one of these final classifications for each finding: `CONFIRMED REAL SECRET`, `CONFIRMED SYNTHETIC FIXTURE`, `CONFIRMED FALSE POSITIVE`, or `UNRESOLVED POTENTIAL SECRET`. For a confirmed real credential, determine validity with its owner and rotate/revoke as appropriate. For a synthetic fixture or false positive, record the evidence and propose any narrow exception separately; do not add exceptions during this diagnostic phase. If the value appears only in history, assess whether it remains valid before deciding whether history cleanup is necessary.

## Post-Classification Remediation Gate

After the four findings are identified and classified, propose remediation separately for review. For each confirmed real credential, coordinate with its owner and revoke or rotate it before considering any history cleanup. For proven fixtures or false positives, present the evidence and any narrowly scoped exception for separate approval. Then verify the chosen remediation with the pinned full-history CI scan. This diagnostic change does not authorize any of those actions.

## Initial Limitations Before the Isolated Reproduction

- The exact RuleID, file, line, commit, and detection category for CI-1 through CI-4 are unavailable from the retained run log.
- Their current-source versus historical-only status and credential validity are unresolved.
- Local execution was blocked before the Gitleaks container started because the Docker engine was unavailable; no local scan result can be compared to CI.
- The local clone contains extra refs, so its `--all` scan would not reproduce the CI reference set without isolating the CI-visible refs.
- The exact four finding fingerprints cannot be checked against `.gitleaksignore` until a redacted report is generated.

**Recommended next action:** after separate authorization, commit only `.gitleaksignore` and this report, then verify the existing GitHub Secret scan on the PR.
