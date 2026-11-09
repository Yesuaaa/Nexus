# U00 baseline preservation report

Decision: **COMPLETED** after the checks recorded in [independent-verification.json](independent-verification.json). U01 and Phase 4.1 were not started.

## Destination and inventory

Original evidence: `test-results/phase2-audit/`. Preserved copies: `docs/testing/migrations/phase4/baseline/artifacts/`.

All 112 original files (25,070,969 bytes) were copied without rewriting their contents. The complete original/preserved inventory, repository-relative paths, sizes, required flags, and SHA-256 values are in [sha256-manifest.json](sha256-manifest.json). All copies remain required for future verification; six are the mandatory core baseline artifacts.

| Original relative filename      | Preserved relative filename                    | Purpose                                                 |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| report.md                       | artifacts/report.md                            | Required historical findings and limitations            |
| inventory.md                    | artifacts/inventory.md                         | Required original test inventory                        |
| coverage-matrix.md              | artifacts/coverage-matrix.md                   | Required coverage mapping                               |
| assertions.md                   | artifacts/assertions.md                        | Required assertion source identities                    |
| preservation-map.csv            | artifacts/preservation-map.csv                 | Required original migration ledger                      |
| baseline.json                   | artifacts/baseline.json                        | Required machine-readable baseline and source snapshots |
| discovery.json                  | artifacts/discovery.json                       | Historical expanded test identities                     |
| execution.json                  | artifacts/execution.json                       | Historical execution results                            |
| verification.json               | artifacts/verification.json                    | Historical source/artifact checksums                    |
| discovery-command.json          | artifacts/discovery-command.json               | Historical discovery command and exit code              |
| execution-command.json          | artifacts/execution-command.json               | Historical execution command and environment            |
| discovery.stderr.txt            | artifacts/discovery.stderr.txt                 | Historical discovery stderr, including empty bytes      |
| execution.log                   | artifacts/execution.log                        | Historical execution log                                |
| execution.stderr.txt            | artifacts/execution.stderr.txt                 | Historical execution warnings                           |
| test-index.txt                  | artifacts/test-index.txt                       | Historical identity index                               |
| run-artifacts/.last-run.json    | artifacts/run-artifacts/.last-run.json         | Historical runner completion record                     |
| run-artifacts/** (96 PNG files) | artifacts/run-artifacts/** (same 96 PNG paths) | Existing historical screenshots                         |

No new test reports were produced. `artifacts/` contains only copies of pre-existing Phase 2 evidence.

## Integrity and Git revision

Source revision: `2075d354d62dd15b6d34b53600416de336eca4d6`. This commit exists locally and matches HEAD, baseline.json, verification.json, and all 292 reconstructed original ledger identities.

- 35 spec files match the filesystem and source snapshots exactly, with no missing or unexpected specs.
- Independent TypeScript AST inspection confirms 157 executable declarations and 1,630 assertion sites, including source locations and expression text. Commented declarations are excluded.
- All 49 recorded source/dependency SHA-256 values match both raw Git blob bytes at the original revision and current filesystem bytes. Embedded source and declaration/assertion hashes also match.
- All 14 artifact size/checksum records in original verification.json match original files.
- The actual CSV ledger was parsed with multiline CSV support. All 4,211 mappings match baseline test/assertion ownership, source expressions, and hashes. All 292 original test identities and all 1,630 assertion identities are covered. Missing, duplicate, and unexpected identities/mappings: zero. Repeated test identities across different assertion rows are expected.
- All 292 expanded identities match both saved discovery and execution reports by Playwright ID, path, line, column, title, parent describes, and project.
- Historical execution.json records 287 passed, 0 failed, 5 skipped, with no retries or reported flaky results. These are independently checked recorded results; tests were not rerun.
- Each original and preserved artifact was hashed and compared as bytes. A second implementation, PowerShell Get-FileHash, recalculates both sides against the manifest in independent-verification.json.

Historical limitations remain unchanged: the pre-existing executed build `RkU8ojA1HJpcyeFNdw-6u` has an unverified source revision. Execution-to-source equivalence, backend behavior, runtime assertion invocation counts, and long-term flakiness are not established. Local artifacts are not externally signed historical attestations. U00 checks consistency and preserves the evidence; it does not strengthen those historical claims.

## Protection and repository conventions

The destination did not exist before U00 and was checked before copying. Files were created exclusively; no existing evidence was overwritten or merged. Every preserved file is visible to Git, including the execution log.

- Root `.prettierignore` adds only `docs/testing/migrations/phase4/baseline/artifacts/`, protecting copies from `pnpm format` and `pnpm format:check`. New U00 metadata remains format-checkable.
- Local `.gitattributes` sets `artifacts/** -text` to prevent Git's inherited text auto-detection and line-ending conversion from changing evidence during add/checkout.
- Local `.gitignore` re-includes only `artifacts/execution.log`, overriding the root `*.log` rule for this historical record.
- Inspected root/web/api package scripts, scripts/, apps/web/scripts/, .github/, Playwright config, formatter/ignore settings, and Git attributes. No configured destructive cleanup targets include this docs destination. Playwright outputs target test-results directories, separate from preservation storage. Standalone preparation copies only public/static files into .next.
- `pnpm format` broadly rewrites repository files and would rewrite unprotected Markdown/JSON evidence. Root `test:e2e` also starts backend regression tests; Playwright's default webServer command builds the application. None of these commands ran. Typecheck scripts generate Prisma/Next artifacts, so those were also excluded from this preservation-only task. Only new U00 metadata received a targeted format check/write; no original or preserved evidence was formatted.
- An explicit future delete targeting docs or `git clean -fd` can remove untracked preservation files. Keeping the directory in version control is the future protection requirement; no commit or push was made, as requested. No unrelated package scripts were changed.

## Files created and modified

Created: the 112 inventory entries under `artifacts/`, plus `.gitattributes`, `.gitignore`, `sha256-manifest.json`, `independent-verification.json`, and this `U00-report.md` (117 new files total).

Existing file modified: `.prettierignore`, one scoped exclusion only. No other tracked file changed. Temporary preflight metadata outside the baseline directory was removed after verification; no pre-existing untracked file was modified or removed.

The initial Git working tree was clean: no tracked modifications or untracked files. The final exact porcelain status and its comparison with the initial snapshot are captured in independent-verification.json. Expected final delta: `.prettierignore` modified and 117 new files in this preservation directory, with no staging, commit, push, deletion, or source change.

## Safety, prerequisites, and completion

All original Phase 2 artifacts remain present and unchanged. Copies match original bytes and recorded hashes. All 602 initially present tracked files were compared by filesystem SHA-256; the only permitted difference is the scoped `.prettierignore` addition. Application source, existing regression tests, and Playwright configuration remain unchanged.

No tests, Playwright discovery, production build, server startup, database command, or network/service access occurred during U00. Verification used local files, Git objects, CSV/JSON parsing, TypeScript AST reads, and hashing only.

Missing prerequisites: **none for U00**. Unverified historical build provenance remains explicitly recorded. U00 is complete when the independent verification file reports PASS for every copied artifact and the repository status comparison. Stop at U00; no migration work is authorized by this report.
