# HX Resource Management

HarmonyX's internal system for ending cross-project resource contention.
PMs raise demand by role and skill, Resource Managers propose and confirm people,
and a single Portfolio Rank settles conflicts before they reach the CEO.

- Design, research and ADR source: [HX Resource Management System, Research, Design & ADR](https://claude.ai/code/artifact/967e47fc-e50a-433e-b9d1-0a68bda3efe3)
- Decisions: [`docs/adr/`](docs/adr/) (Michael Nygard format)
- Board: [GitHub Project 4](https://github.com/users/hx-natthawat/projects/4)

## How work moves

Research → Analysis → Design and Plan → ADR → Develop → Verify → Deliver.
No production code merges before its governing ADR is Accepted.
Nothing ships before Verify passes against the running feature with evidence on the issue.

## Run locally

```bash
pnpm install
pnpm dev     # http://localhost:3000
pnpm test    # unit tests and PostgreSQL integration tests
```

Stack and module layout follow ADR-005. Read `CLAUDE.md` before changing code.
