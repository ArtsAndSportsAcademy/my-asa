---
name: noticesTable enum values (type and urgency)
description: Valid enum values for notice type and urgency columns
---

## noticeTypeEnum (type column)
Valid: `"INFORMATIVE" | "IMPORTANT" | "PERSISTENT" | "ESCALATED"`

NOT valid: "CHANGE", "ALERT", "EMERGENCY" (these were wrong assumptions)

## noticeUrgencyEnum (urgency column)  
Valid: `"INFORMATIVE" | "IMPORTANT" | "CRITICAL"`

**Why:** Mismatched enum values cause TS2769 on `.insert(noticesTable).values({...})`.

**How to apply:** When inserting/updating notices in ASA tools or any route, use only these values.
