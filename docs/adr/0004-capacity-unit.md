# ADR-004: Capacity unit

## Status

Proposed. Issue #4.

## Context

หน่วยรายวันละเอียดเกินจำเป็นสำหรับการวางแผน ส่วนรายเดือนหยาบจนซ่อน conflict

Options considered: hours per week; hours per day; FTE per month.

## Decision

เก็บเป็นชั่วโมงต่อสัปดาห์ แสดงผลเป็น % ของ capacity หักวันหยุดและวันลาอัตโนมัติ กำหนด WIP limit เริ่มต้น 2 โครงการพร้อมกันสำหรับ Key Resource

## Consequences

สอดคล้องกับ heatmap ของเครื่องมือสากล แต่ไม่เหมาะกับการจัดตารางงานรายชั่วโมง ซึ่งยังคงทำใน Jira หรือเครื่องมือเดิม
