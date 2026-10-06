# ADR-006: Conflict detection

## Status

Proposed. Issue #6.

## Context

การจองพร้อมกันสองรายการอาจผ่านการตรวจทั้งคู่แล้วเกิน capacity ร่วมกัน

Options considered: check inside the booking transaction with a row lock; periodic batch scan; application-level check without locks.

## Decision

ตรวจผลรวมชั่วโมงต่อคนต่อสัปดาห์ภายใน transaction เดียวกับการบันทึก booking โดย lock แถวของคนนั้น สร้าง materialized view สำหรับ heatmap และบันทึกทุกการเปลี่ยนแปลงเป็น audit event แบบ append-only

## Consequences

ตัวเลขถูกต้องเสมอแม้มีผู้ใช้พร้อมกัน และย้อนดูได้ว่าใครตัดสินอะไร แลกกับความซับซ้อนของ query ที่เพิ่มขึ้น

Note from ADR-005 research: Hyperdrive pools in transaction mode, so `SELECT ... FOR UPDATE` inside one transaction works. Advisory locks and `LISTEN/NOTIFY` are not available, so this ADR must rely on row locks only.
