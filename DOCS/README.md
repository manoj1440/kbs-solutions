# DOCS — map

| Folder / file | Purpose | Edit policy |
|---|---|---|
| `requirements/` | The PRD, verbatim, one file per section (`REQ-00` … `REQ-30`), plus the original `.docx` and full markdown export | Append-only engineering notes; never rewrite |
| `analysis/01-gap-analysis.md` | What the PRD lacks/ambiguates and our disposition for each (ADOPTED / CONFIGURABLE / BLOCKED) | Update when a disposition changes |
| `decisions/` | ADRs — how we build | Add/supersede, never delete |
| `architecture/` | System, monorepo, data model, API conventions, security | Keep in sync with code in the same commit |
| `features/` | Small feature files with status; `README.md` is the index and roadmap | Update status as you work |
| `conventions/` | Engineering, git, testing rules | |
| `runbooks/` | How to run / operate | |
| `PROGRESS.md` | Session memory — where we are, what is next | Update at end of **every** session |

Reading order for a new session: `../AGENTS.md` → `PROGRESS.md` → current feature file → its REQ refs.
