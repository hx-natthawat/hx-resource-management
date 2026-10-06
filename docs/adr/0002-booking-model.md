# ADR-002: Booking model

## Status

Accepted. Fero accepted in chat on 2026-10-06 ("Approve all ADR"). Issue #2.

## Context

PM ขอคนกับตัวบุคคลโดยตรง ทำให้เกิดการจองซ้อนที่ไม่มีใครเห็นภาพรวม

Options considered: Demand then Soft then Hard; PMs book named people directly (status quo); single-step booking approved by the line manager.

## Decision

ทุกการใช้คนต้องเริ่มจาก Demand ตาม role/skill → RM เสนอชื่อ (Soft) → RM ยืนยัน (Hard) เท่านั้น เฉพาะ Hard booking ที่ตัด capacity ตามแนวทางของ Microsoft Project Operations และ ServiceNow

Booking states: Draft → Requested → Proposed (soft) → Confirmed (hard) → Released.

## Consequences

PM มีขั้นตอนเพิ่มขึ้น แต่คนไม่ถูกดึงหลายทาง ทุกทีมต้องมีผู้ทำหน้าที่ RM ที่ชัดเจน
