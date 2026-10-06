# Architecture Decision Records

Format: Michael Nygard (Title, Status, Context, Decision, Consequences).
Status is one of Proposed, Accepted, Rejected, Superseded. Only Fero accepts.
Acceptance is recorded as his approving review on the ADR pull request, his comment "Accepted" on the ADR issue, or an explicit statement in chat.

Source: [HX Resource Management System, Research, Design & ADR](https://claude.ai/code/artifact/967e47fc-e50a-433e-b9d1-0a68bda3efe3)

| ADR | Decision | Status | Issue |
| --- | --- | --- | --- |
| [0001](0001-build-vs-buy.md) | Build in-house | Accepted | #1 |
| [0002](0002-booking-model.md) | Demand, Soft, Hard as the only path | Accepted | #2 |
| [0003](0003-conflict-resolution-rule.md) | One Portfolio Rank plus WSJF | Accepted | #3 |
| [0004](0004-capacity-unit.md) | Hours per week | Accepted | #4 |
| [0005](0005-architecture-and-stack.md) | Modular monolith on Cloudflare, portable to on-premise | Accepted | #5 |
| [0006](0006-conflict-detection.md) | Check inside the booking transaction, append-only audit | Accepted | #6 |
| [0007](0007-delivery-process.md) | ADR gate before every feature | Accepted | #7 |
| [0008](0008-voice-input-and-ai-extraction.md) | Cloud speech-to-text plus LLM extraction, human approves | Accepted | not yet created |
