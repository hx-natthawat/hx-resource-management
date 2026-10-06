# ADR-007: Delivery process

## Status

Accepted. Fero accepted in chat on 2026-10-06 ("Approve all ADR"). Issue #7.

## Context

ต้องการให้ทุกฟีเจอร์ใหม่ผ่านการอนุมัติและตรวจสอบก่อนส่งมอบ

Options considered: fixed lifecycle with an ADR gate and a Verify gate; ad-hoc delivery without recorded decisions.

## Decision

ใช้วงจร Research → Analysis → Design and Plan → ADR → Develop → Verify → Deliver กับทุกงาน เก็บ ADR เป็นไฟล์ใน repository (`docs/adr`) และสรุปสถานะไว้ในเอกสารออกแบบ

## Consequences

เพิ่มเวลาต่อฟีเจอร์เล็กน้อย แต่ตรวจสอบย้อนหลังได้ทุกการตัดสินใจ งานเล็กมาก (แก้คำ แก้ bug) ใช้ Feature Decision Note หนึ่งย่อหน้าแทน ADR เต็ม
