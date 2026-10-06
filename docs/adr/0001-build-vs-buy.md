# ADR-001: Build vs Buy

## Status

Accepted. Fero accepted in chat on 2026-10-06 ("สร้างเอง"). Issue #1.

## Context

เครื่องมือ SaaS เช่น Runn และ Float ใช้งานได้ทันที ราคาเริ่มราว 7 USD ต่อผู้ใช้ต่อเดือน ([Capterra](https://www.capterra.com/p/202595/Runn/reviews/Capterra___6121549/)) ส่วน Planview และ Kantata ครบแต่หนักและแพง แต่ HarmonyX ต้องการใช้คนร่วมกันข้ามบริษัทในเครือ เชื่อมระบบภายใน และมีโอกาสนำระบบไปเสนอลูกค้าภาครัฐและองค์กร

Options considered: build in-house, buy SaaS (Runn or Float), pilot Runn for one quarter, do nothing.

## Decision

พัฒนาเองในขอบเขต MVP ที่เล็กที่สุด โดยออกแบบให้ต่อยอดเป็นผลิตภัณฑ์ได้

## Consequences

ได้ IP และควบคุม data model เอง แต่ใช้เวลาราว 8 สัปดาห์ก่อนใช้งานจริง และต้องมีทีมดูแลระยะยาว

What becomes harder: ทีมต้องรับภาระดูแลระบบระยะยาว และผู้ใช้ต้องรอ MVP แทนการเริ่มใช้เครื่องมือสำเร็จรูปทันที
