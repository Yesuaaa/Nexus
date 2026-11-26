# PG-018 Regression Preservation

## Preservation method

Task-entry UTF-8 content and SHA-256 snapshots were captured before edits. TypeScript AST call sites were compared using tokenized expressions (ignoring whitespace only). Each original assertion expression must still exist with its original multiplicity; original test declaration titles remain. This proves source assertion retention, supplemented by runtime reruns of the complete existing Calendar selection. Counts alone are not the equivalence argument.

| File                              | Original/current source declarations | Original/current assertion sites | Result                                        |
| --------------------------------- | ------------------------------------ | -------------------------------- | --------------------------------------------- |
| `apps/api/tests/calendar.test.ts` | 1 / 1                                | 28 / 39                          | Every original expression and title preserved |
| `apps/web/e2e/calendar.spec.ts`   | 1 / 1                                | 14 / 33                          | Every original expression and title preserved |
| `apps/web/test/calendar.test.mjs` | 3 / 4                                | 7 / 10                           | Every original expression and title preserved |

The one browser source declaration still expands to eight cases (four roles x two widths). Existing API aggregation remains one declaration. Unit adds exactly one declaration. New API/browser/integration files add 5/10/1 respectively, totaling 17 new case declarations with the new unit. No scenario retired, renamed, skipped or quarantined; no timeout/retry increase for existing tests. Original browser fixtures remain unchanged until their original assertions finish: additionalEvents starts empty, then grows only for the added organization checks. API delegation is restored in finally before original revocation/group/inactive assertions continue.

## Original assertion expressions

Original entry line numbers are historical locations, not current links. Expressions below are token-normalized AST text, retaining all literals/operators/calls.

### apps/api/tests/calendar.test.ts

| Entry line | Preserved exact expression (tokens)                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 209        | `assert . equal ( mine . canViewTeam , false )`                                                                                                        |
| 210        | `assert . deepEqual ( mine . events . filter ( ( event ) => event . type === "task" ) . map ( ( event ) => event . title ) , [ "My deadline" ] , )`    |
| 216        | `assert . equal ( mine . events . find ( ( event ) => event . type === "task" ) ?. startsAt . toISOString ( ) , "2030-02-02T16:00:00.000Z" , )`        |
| 222        | `assert . equal ( mine . events . find ( ( event ) => event . type === "task" ) ?. href , `/project-workspace/ungrouped-project%3A${ project . id } `, |

    )` |

| 226 | `assert . equal ( mine . events . some ( ( event ) => event . type === "consultation" &#124;&#124; event . title === "Private deadline" , ) , false , )` |
| 233 | `assert . rejects ( listInternalCalendar ( staff . id , "team" ) , / Team calendar access / , )` |
| 247 | `assert . equal ( team . canViewTeam , true )` |
| 248 | `assert . equal ( team . events . find ( ( event ) => event . title === "Team deadline" ) ?. completed , true , )` |
| 252 | `assert . equal ( team . events . some ( ( event ) => event . title === "Private deadline" ) , false , )` |
| 257 | `assert . equal ( headCalendar . events . some ( ( event ) => event . id === `consultation-${ scheduled . id } `,
      ),
      true,
    )` |
| 263 | `assert . equal ( headCalendar . events . some ( ( event ) => event . id === `meeting-${ meeting . id } `),
      true,
    )` |
| 267 | `assert . equal ( headCalendar . events . filter ( ( event ) => event . type === "task" ) . length , 2 , )` |
| 273 | `assert . equal ( organization . organization , true )` |
| 274 | `assert . equal ( organization . events . some ( ( event ) => event . title === "Private deadline" ) , true , )` |
| 278 | `assert . equal ( organization . events . find ( ( event ) => event . id === `consultation-${ unassignedConsultation . id } `,
        )?.unassigned,
        true,
      )` |
| 284 | `assert . equal ( organization . events . every ( ( event ) => event . href === null && event . location === null , ) , true , )` |
| 290 | `assert . equal ( organization . events . filter ( ( event ) => event . type === "consultation" ) . length , 3 , )` |
| 296 | `assert . rejects ( listInternalCalendar ( client . id , "team" ) , / Internal calendar access / , )` |
| 300 | `assert . rejects ( listInternalCalendar ( staff . id , "other" ) , / valid calendar scope / , )` |
| 309 | `assert . equal ( formerHead . events . length , 0 )` |
| 310 | `assert . rejects ( listInternalCalendar ( head . id , "team" ) , / Team calendar access / , )` |
| 314 | `assert . equal ( ( await fetch ( `${ base } / api / projects / calendar `)).status, 401)` |
| 320 | `assert . equal ( clientResponse . status , 200 )` |
| 325 | `assert . equal ( clientEvents . some ( ( event ) => event . id === `consultation-${ scheduled . id } `),
      true,
    )` |
| 329 | `assert . equal ( clientEvents . find ( ( event ) => event . id === `consultation-${ scheduled . id } `)
        ?.completed,
      false,
    )` |
| 334 | `assert . equal ( clientEvents . some ( ( event ) => event . id . startsWith ( "task-" ) ) , false , )` |
| 343 | `assert . equal ( groupedCalendar . events . find ( ( event ) => event . type === "task" ) ?. href , `/project-workspace/group%3A${ project . id } `,
    )` |
| 351 | `assert . rejects ( listInternalCalendar ( staff . id , "mine" ) , / Internal calendar access / , )` |

### apps/web/e2e/calendar.spec.ts

| Entry line | Preserved exact expression (tokens)                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 82         | `expect ( main . getByRole ( "heading" , { name : "Calendar" , exact : true } ) , ) . toBeVisible ( )`                                                            |
| 85         | `expect ( main . getByRole ( "grid" ) ) . toBeVisible ( )`                                                                                                        |
| 87         | `expect ( day . getByText ( role === "USER" ? "Shared deliverable" : "Prepare designs" , { exact : true } , ) , ) . toBeVisible ( )`                              |
| 94         | `expect ( main . getByRole ( "link" , { name : "Book a consultation" } ) , ) . toBeVisible ( )`                                                                   |
| 97         | `expect ( main . getByRole ( "region" , { name : "Calendar filters" } ) , ) . toHaveCount ( 0 )`                                                                  |
| 101        | `expect ( main . getByRole ( "link" , { name : "Book a consultation" } ) , ) . toHaveCount ( 0 )`                                                                 |
| 109        | `expect ( day . getByText ( "Team deadline" , { exact : true } ) , ) . toBeVisible ( )`                                                                           |
| 112        | `expect ( day . getByRole ( "link" , { name : "View Prepare designs" } ) , ) . toHaveAttribute ( "href" , "/project-workspace/ungrouped-project%3Aproject-1" , )` |
| 119        | `expect ( day . getByRole ( "link" , { name : "View Prepare designs" } ) , ) . toHaveCount ( 0 )`                                                                 |
| 122        | `expect ( main . getByRole ( "combobox" , { name : "Departments" } ) , ) . toBeVisible ( )`                                                                       |
| 129        | `expect ( day . getByText ( "Prepare designs" , { exact : true } ) , ) . toBeVisible ( )`                                                                         |
| 135        | `expect ( day . getByText ( "No events on this day" ) ) . toBeVisible ( )`                                                                                        |
| 137        | `expect ( day . getByText ( "Prepare designs" , { exact : true } ) , ) . toBeVisible ( )`                                                                         |
| 141        | `expect ( await page . evaluate ( ( ) => document . documentElement . scrollWidth <= window . innerWidth , ) , ) . toBe ( true )`                                 |

### apps/web/test/calendar.test.mjs

| Entry line | Preserved exact expression (tokens)                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| 17         | `assert . equal ( calendarEventDate ( { allDay : true , startDate : date , startsAt : `${ date } T23 : 00 : 00 Z `, |

      }),
      date,
    )` |

| 29 | `assert . equal ( calendarEventStatus ( deadline , "2030-02-03" ) , null )` |
| 30 | `assert . equal ( calendarEventStatus ( deadline , "2030-02-04" ) , "Overdue" )` |
| 31 | `assert . equal ( calendarEventStatus ( { ... deadline , completed : true } , "2030-02-04" ) , "Completed" , )` |
| 35 | `assert . equal ( calendarEventStatus ( { ... deadline , deadline : false } , "2030-02-04" ) , null , )` |
| 65 | `assert . deepEqual ( [ ... calendarConflicts ( events , Date . parse ( "2030-02-01" ) ) ] . sort ( ) , [ "first" , "overlap" ] , )` |
| 69 | `assert . equal ( calendarConflicts ( events , Date . parse ( "2030-02-04" ) ) . size , 0 )` |

## Protected file hashes

| File                                                                          | Entry/final SHA-256                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/web/e2e/calendar/page-20-regression.spec.ts`                            | `385614697181a0a36163b22217acbf54cbac55007c87c5922e53c0913ad72f41` |
| `docs/qa/page-verification/phase-2/PG-018/PG-018_UNIT_API_E2E_PLAN.md`        | `bc4972274f8103fdf09edf04a2617cfc7e683c4e473c7bab4df10b099140370e` |
| `docs/qa/page-verification/phase-2/PG-018/PG-018_FUNCTIONAL_DISCOVERY.md`     | `8f1d05a2cb3c743b8890bc21a22f699dd53082af529cd62a22a188e48bc93a7f` |
| `apps/api/tests/calendar-regression.test.ts`                                  | `dd05b55081593caf2a313df8fa9d3202b87f8b57cfb629b37fdcefc7a45d0c7d` |
| `docs/qa/page-verification/phase-2/PG-018/PG-018_EDGE_CASE_MATRIX.md`         | `a277d74bb0cded29c654695f6821ec37663d2d8ba3b6d0e3e89c9d187f081942` |
| `apps/web/test/calendar-regression.test.mjs`                                  | `452f47d4f13e4a1901d1fb59a77ec1d43bee2bd757ae6c3573009fc97966c146` |
| `docs/qa/page-verification/phase-2/PG-018/PG-018_EXISTING_TEST_BASELINE.md`   | `a9cee42cfbe0153390ae5bf907892c2ab8969251014b91b9b95991d21e4d4e11` |
| `docs/qa/page-verification/QA_GATE_RECOVERY_STAGE_3_REPORT.md`                | `87a9562f819ea3557eec285f95d24027fbad286bea006e65d3c278f8ab6de839` |
| `docs/qa/page-verification/phase-2/PG-018/PG-018_TEST_CASE_SPECIFICATION.md`  | `d599d1eb01efe549510c9cd88f45d1609b543c429da99f5dc4430ec0f4caf19a` |
| `docs/qa/page-verification/phase-2/PG-018/PG-018_ATOMIC_FEATURE_INVENTORY.md` | `65f80fd8a21684b9cb72d1eae190a5ed2f1ffb3ddfbb588718b5601bab724f45` |
| `apps/web/e2e/attendance.spec.ts`                                             | `cc7224065bb9812cb13e0ea832aad83a414fb3778c88168bc6b752c0ea95d613` |
| `docs/qa/page-verification/phase-2/PG-018/PG-018_GAPS_AND_DEPENDENCIES.md`    | `673ebb01d9ce5d7520151e64895fc8ff630ce6a568985d59383d11dd7ffa31e7` |

All other tracked PG-001 through PG-017 tests/reports, Attendance split modules/fixtures, original maintenance reports and PG-017 design documents have no worktree diff. The cumulative ledger retains its entire entry content as a prefix; only the new PG-018 result is appended.

## Historical findings unchanged

- PG-004-D-001 shared keyboard row-action menu defect remains open across PG-004, PG-006, PG-008, PG-010, PG-011, PG-012 and PG-015. Existing failing regressions remain enabled.
- PG-016-D-001 proof-dialog Escape focus restoration defect remains open.
- PG-006 820px intermittency, PG-011 two transfer/reverification intermittent cases, PG-008 PostgreSQL assignment concurrency and PG-012 PostgreSQL overtime routing blockers retain their original classifications.
- PG-015 retains 44/45 implementable passes and its shared-menu failure; PG-016 retains 17/18 and its focus failure.
- PG-017 retains 32/32 implementable passes, its deferred deep-link focus contract and reported proxy/concurrency limitations. All Stage 3 architecture repairs and quality-gate reports are preserved.

No historical application defect was fixed or reclassified by this test-only Calendar task. The full Attendance or full repository regression suite was not run. Existing leave lifecycle source/fixture coverage is preserved unchanged; the new isolated leave matrix verifies Calendar projection without rerunning the entire leave workflow suite.
