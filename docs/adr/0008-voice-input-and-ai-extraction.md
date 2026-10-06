# ADR-008: Voice input and AI extraction

## Status

Accepted. Fero accepted in chat on 2026-10-06 ("Approve all ADR"). Issue: not yet created.
Open item: audio retention period, to be set by HarmonyX's DPO before voice input goes live.

## Context

ผู้ใช้ส่วนใหญ่ทำงานบนมือถือและไม่มีเวลาพิมพ์ UX/UI ที่ได้รับการยืนยันแล้วจึงใช้เสียงเป็นช่องทางหลัก prototype `prototypes/ui-mobile-first` ใช้ Web Speech API ของเบราว์เซอร์ร่วมกับตัวแปลงแบบกฎ (rule-based) ซึ่งรองรับเบราว์เซอร์ไม่ครบ ตีความภาษาพูดได้จำกัด และยังไม่มีนโยบายเก็บไฟล์เสียง

Options considered:

1. Keep the browser Web Speech API and the rule-based extractor. No cost, but browser coverage is partial and audio goes to the browser vendor outside HarmonyX control.
2. A cloud speech-to-text service that supports Thai, then an LLM that extracts fields against the `DemandDraft` JSON schema. Accurate and works on every device; costs per use.
3. Self-hosted speech model and LLM. Fits government clients that forbid data leaving their network; highest operating cost.

## Decision

Option 2 for Release 2, behind two interfaces, `SpeechEngine` and `Extractor`, so option 3 can be swapped in for on-premise installs (ADR-005).

- Output keeps the `DemandDraft` shape. Every field carries its source: heard, inferred, account, or edited.
- Nothing is saved until a human approves on the review screen.
- Audio is stored encrypted, the user is told before recording, and audio is deleted after the period the DPO sets.

## Consequences

Positive:

- Works on every device and understands spoken Thai far better than the rule-based extractor.
- The human-approval step contains extraction errors before they reach bookings.

Negative and what becomes harder:

- A monthly usage cost.
- A PDPA impact assessment is required before go-live.
- A Thai test-utterance set must be maintained and run on every engine change to measure accuracy.
