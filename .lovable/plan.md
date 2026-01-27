

## Summary

Change the Arabic label in the Expense Entry print signature section from "المحضر" (Prepared By) to "مقدم الطلب" (Requester/Applicant).

---

## Changes

### File: `src/components/ExpenseEntryPrint.tsx`

**Location**: Signature section (around line 184)

**Current text**:
```tsx
<p className="font-semibold">{isRtl ? "المحضر" : "Prepared By"}</p>
```

**Updated text**:
```tsx
<p className="font-semibold">{isRtl ? "مقدم الطلب" : "Prepared By"}</p>
```

This updates the first signature box label to reflect the correct Arabic terminology for "Requester" while keeping the English label as "Prepared By".

