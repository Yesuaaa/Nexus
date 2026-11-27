# PG-021 atomic feature inventory

31 atomic behaviors and 31 unique cases. 19 new, 1 additional, 10 existing-sufficient, 1 contract-blocked. 30 implementable (Browser 17, Unit 2, API/PGlite 9, Integration 1, PostgreSQL 1). 19 planned declarations, one existing declaration to extend, one additive group and one extra browser instance from the two-width keyboard case. 11 abuse hypotheses.

| Atomic ID        | Behavior                                        | Source or test anchor                                                                          | Case                  |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------- |
| PG-021-F001-A001 | Portal entry                                    | route-policy.ts:581; auth/model/permissions.ts:56                                              | PG-021-F001-A001-T001 |
| PG-021-F001-A002 | Directory state                                 | department-management-page.tsx:20–25,96–109; department-table.tsx:323                          | PG-021-F001-A002-T001 |
| PG-021-F001-A003 | Directory filter, sort and pagination           | departments/department-management.spec.ts:27                                                   | PG-021-F001-A003-T001 |
| PG-021-F001-A004 | Additional table and URL boundaries             | department-table.tsx:72–220; department-management-page.tsx:96                                 | PG-021-F001-A004-T001 |
| PG-021-F001-A005 | Row actions and panel accessibility             | department-row-actions.tsx:33–84; department-management-page.tsx:113–149                       | PG-021-F001-A005-T001 |
| PG-021-F001-A006 | Create form validation and retry                | departments/department-management.spec.ts:102–270                                              | PG-021-F001-A006-T001 |
| PG-021-F001-A007 | Preset, color and edit form                     | department-form-panel.tsx:59–148,173–320                                                       | PG-021-F001-A007-T001 |
| PG-021-F001-A008 | Head options and unavailable state              | department-form-panel.tsx:74–87,264–300                                                        | PG-021-F001-A008-T001 |
| PG-021-F001-A009 | Department normalization and field allowlist    | departments.schema.ts:36–126                                                                   | PG-021-F001-A009-T001 |
| PG-021-F001-A010 | Directory and HR detail projections             | data-access.test.ts:72,124,150                                                                 | PG-021-F001-A010-T001 |
| PG-021-F001-A011 | Session and role lifecycle                      | departments.controller.ts:10; auth.middleware.ts                                               | PG-021-F001-A011-T001 |
| PG-021-F001-A012 | Head eligibility and replacement                | leadership.test.ts:174,216; management-attribution.test.ts:310                                 | PG-021-F001-A012-T001 |
| PG-021-F001-A013 | Department create/update and history atomicity  | management-attribution.test.ts:130,157,195,411,461                                             | PG-021-F001-A013-T001 |
| PG-021-F001-A014 | Members detail and local search                 | manage-members-drawer.tsx:83–93,189–202,621–892                                                | PG-021-F001-A014-T001 |
| PG-021-F001-A015 | Employee candidate ordering and pagination      | manage-members-drawer.tsx:210–279,1324–1445                                                    | PG-021-F001-A015-T001 |
| PG-021-F001-A016 | Employee options bounds and observational reads | departments.service.ts:100–190; read-integrity.test.ts:98,123                                  | PG-021-F001-A016-T001 |
| PG-021-F001-A017 | Assign and remove department members            | manage-members-drawer.tsx:376–458,1324–1445                                                    | PG-021-F001-A017-T001 |
| PG-021-F001-A018 | Member placement, replay and rollback           | member-attribution.test.ts:161,254,355,451,501,530                                             | PG-021-F001-A018-T001 |
| PG-021-F001-A019 | Edit member panel                               | manage-members-drawer.tsx:511–553; edit-member-form.tsx                                        | PG-021-F001-A019-T001 |
| PG-021-F001-A020 | Team create, assignment and removal             | shared/department-member-workflows.spec.ts:11–205                                              | PG-021-F001-A020-T001 |
| PG-021-F001-A021 | Team selection, failure and delete              | manage-members-drawer.tsx:352–375,460–510,892–1082,1116–1250,1457–1518                         | PG-021-F001-A021-T001 |
| PG-021-F001-A022 | Team validation and related writes              | team-attribution.test.ts:189,363,511,599                                                       | PG-021-F001-A022-T001 |
| PG-021-F001-A023 | Deletion confirmation and recovery              | delete-department-dialog.tsx:20–34; department-management-page.tsx:42–67                       | PG-021-F001-A023-T001 |
| PG-021-F001-A024 | Department deletion relationships               | deletion-attribution.test.ts:185,210,382,402,436                                               | PG-021-F001-A024-T001 |
| PG-021-F001-A025 | Real rewrite and membership round trip          | next.config.ts:62–72; departments-api.ts:275–294; playwright.pg020.config.ts                   | PG-021-F001-A025-T001 |
| PG-021-F001-A026 | Competing Head selection                        | departments.repository.ts:368–449; schema.prisma:451–457                                       | PG-021-F001-A026-T001 |
| PG-021-F001-A027 | Multi-member removal atomicity                  | manage-members-drawer.tsx:352–375                                                              | PG-021-F001-A027-T001 |
| PG-021-F001-A028 | Team and member identifier limits               | departments.schema.ts:128–224                                                                  | PG-021-F001-A028-T001 |
| PG-021-F001-A029 | Backend permission matrix and attribution       | member-attribution.test.ts:501; deletion-attribution.test.ts:402; team-attribution.test.ts:511 | PG-021-F001-A029-T001 |
| PG-021-F001-A030 | Text is rendered literally                      | department-table.tsx:340 onward; manage-members-drawer.tsx:704 onward                          | PG-021-F001-A030-T001 |
| PG-021-F001-A031 | Successful create refetch count                 | departments/department-management.spec.ts:102–270                                              | PG-021-F001-A031-T001 |
