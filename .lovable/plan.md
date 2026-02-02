
# خطة إصلاح مشكلة عدم إغلاق الوردية

## ملخص المشكلة

في يوم 31 يناير، لم تتمكن الموظفة "جنه يحي" من إغلاق ورديتها، ولم يتمكن المشرف من الإغلاق القسري. بعد التحقيق، تم تحديد سببين رئيسيين:

### المشكلة الأولى: عدم رفع صور الإغلاق
- الوردية تتطلب رفع صور لـ **10 علامات تجارية** من فئة A
- الموظفة رفعت صورة واحدة فقط (زينا لايف)
- العلامات التجارية الناقصة: بينمو، سول فري، سيلا شات، صدى لايف، هوى شات، هيلا شات، يوهو، فور فن، ماسا

### المشكلة الثانية: خطأ في تصفية التواريخ (للإغلاق القسري)
- الوردية فُتحت في `2026-01-30 21:01:58 UTC` (= `2026-01-31 00:01:58 بتوقيت السعودية`)
- الكود يستخدم توقيت UTC بدلاً من توقيت السعودية عند البحث عن الورديات المفتوحة
- عند اختيار تاريخ `31-01-2026`، النظام يبحث في نطاق UTC الخاطئ ولا يجد الوردية

---

## الحل المقترح

### 1. إصلاح تصفية التواريخ في صفحة متابعة الورديات

**الملف:** `src/pages/ShiftFollowUp.tsx`

**التغيير:**
استبدال فلتر التاريخ بالتوقيت UTC في دوال `handleReopenShift` و `handleHardCloseShift` بدالة `isOnKSADate()` الموجودة.

```text
الوضع الحالي (خاطئ):
┌─────────────────────────────────────────────────┐
│ const selectedDateStart = new Date(             │
│   selectedDate + 'T00:00:00'                    │ ← UTC
│ );                                              │
│ const selectedDateEnd = new Date(               │
│   selectedDate + 'T23:59:59'                    │ ← UTC
│ );                                              │
│ // يقارن opened_at مع نطاق UTC                  │
└─────────────────────────────────────────────────┘

الوضع المصحح:
┌─────────────────────────────────────────────────┐
│ // استخدام دالة isOnKSADate للمقارنة الصحيحة    │
│ const sessionsForDate = normalizeSessionsToArray│
│   (assignment.shift_sessions).filter(session => │
│     session.opened_at &&                        │
│     isOnKSADate(session.opened_at, selectedDate)│
│   );                                            │
└─────────────────────────────────────────────────┘
```

### 2. إضافة ميزة الإغلاق القسري للمشرف بدون متطلبات

**الملف:** `src/pages/ShiftFollowUp.tsx`

**التغيير:**
الإغلاق القسري من المشرف يجب أن يتجاوز جميع المتطلبات (الصور، أرقام الطلبات) لأنه موجود لحالات الطوارئ.

### 3. إضافة تنبيهات وتحسينات للمستخدم

**الملفات:** `src/pages/ShiftSession.tsx`

**التغييرات:**
- عرض قائمة واضحة بالعلامات التجارية الناقصة عند محاولة الإغلاق
- إضافة مؤشر تقدم يوضح عدد الصور المرفوعة من الإجمالي المطلوب
- إضافة تنبيه للمشرف عند وجود وردية مفتوحة لفترة طويلة

### 4. إضافة آلية تنبيه تلقائي للورديات المتأخرة

**ملف جديد:** `supabase/functions/send-shift-overdue-reminder/index.ts`

**الوظيفة:**
- إرسال تذكير تلقائي إذا لم تُغلق الوردية خلال ساعة من وقت الانتهاء المحدد
- إشعار المشرفين بالورديات المتأخرة

---

## التفاصيل التقنية

### تعديل 1: إصلاح دالة handleHardCloseShift

```typescript
// في ShiftFollowUp.tsx

const handleHardCloseShift = async () => {
  if (!assignmentToHardClose) return;
  
  // استخدام isOnKSADate بدلاً من المقارنة اليدوية بـ UTC
  const sessionsForDate = normalizeSessionsToArray(
    assignmentToHardClose.shift_sessions
  ).filter(session => {
    if (!session.opened_at) return false;
    return isOnKSADate(session.opened_at, selectedDate);
  });
  
  // ... باقي الكود
};
```

### تعديل 2: إصلاح دالة handleReopenShift

```typescript
// نفس التعديل لدالة handleReopenShift
const handleReopenShift = async () => {
  if (!assignmentToReopen) return;
  
  const sessionsForDate = normalizeSessionsToArray(
    assignmentToReopen.shift_sessions
  ).filter(session => {
    if (!session.opened_at) return false;
    return isOnKSADate(session.opened_at, selectedDate);
  });
  
  // ... باقي الكود
};
```

### تعديل 3: إضافة مؤشر تقدم الصور

```typescript
// في ShiftSession.tsx - عرض التقدم
const uploadedCount = requiredBrands.filter(brand => 
  balances[brand.id]?.receipt_image_path
).length;

const totalRequired = requiredBrands.length;

// عرض: "تم رفع 1 من 9 صور مطلوبة"
```

### تعديل 4: Edge Function للتذكير بالورديات المتأخرة

```typescript
// supabase/functions/send-shift-overdue-reminder/index.ts
// يعمل كل 30 دقيقة عبر cron job
// يبحث عن الورديات المفتوحة التي تجاوزت وقت الانتهاء بساعة
// يرسل إشعارات للمشرفين والموظف المعني
```

---

## خطة التنفيذ

| الخطوة | الوصف | الأولوية |
|--------|-------|----------|
| 1 | إصلاح فلتر التاريخ في `handleHardCloseShift` | عالية |
| 2 | إصلاح فلتر التاريخ في `handleReopenShift` | عالية |
| 3 | إضافة مؤشر تقدم الصور | متوسطة |
| 4 | إضافة edge function للتذكير | متوسطة |
| 5 | تفعيل cron job للتذكير | متوسطة |
| 6 | إغلاق الوردية العالقة يدوياً | فورية |

---

## إجراء فوري مطلوب

لإغلاق الوردية العالقة حالياً للموظفة "جنه يحي"، يمكن تنفيذ أحد الخيارين:
1. استخدام الإغلاق القسري بعد تطبيق الإصلاح
2. تحديث حالة الوردية مباشرة عبر قاعدة البيانات (Cloud View → Run SQL)
