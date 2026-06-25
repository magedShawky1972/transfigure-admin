import sys
import re

def translate_month_preview(content):
    content = content.replace('import { useEffect, useMemo, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";\nimport { useLanguage } from "@/contexts/LanguageContext";')
    content = content.replace('export default function PayrollMonthPreview() {', 'export default function PayrollMonthPreview() {\n  const { language } = useLanguage();')
    
    # Simple strings
    replacements = [
        ('toast({ title: "Exported" });', 'toast({ title: language === "ar" ? "تم التصدير" : "Exported" });'),
        ('placeholder="Search..."', 'placeholder={language === "ar" ? "بحث..." : "Search..."}'),
        ('No options', '{language === "ar" ? "لا توجد خيارات" : "No options"}'),
        ('Clear', '{language === "ar" ? "مسح" : "Clear"}'),
        ('<h1 className="text-2xl font-bold">Month Element Preview</h1>', '<h1 className="text-2xl font-bold">{language === "ar" ? "معاينة عناصر الشهر" : "Month Element Preview"}</h1>'),
        ('<p className="text-sm text-muted-foreground">Read-only view of all payroll elements per employee for the selected month, before running payroll.</p>', '<p className="text-sm text-muted-foreground">{language === "ar" ? "عرض للقراءة فقط لجميع عناصر الرواتب لكل موظف للشهر المحدد، قبل تشغيل الرواتب." : "Read-only view of all payroll elements per employee for the selected month, before running payroll."}</p>'),
        ('Refresh', '{language === "ar" ? "تحديث" : "Refresh"}'),
        ('Export Excel', '{language === "ar" ? "تصدير إكسل" : "Export Excel"}'),
        ('Total Earnings', '{language === "ar" ? "إجمالي المستحقات" : "Total Earnings"}'),
        ('Total Deductions', '{language === "ar" ? "إجمالي الاستقطاعات" : "Total Deductions"}'),
        ('Employer Contributions', '{language === "ar" ? "مساهمات صاحب العمل" : "Employer Contributions"}'),
        ('Net', '{language === "ar" ? "الصافي" : "Net"}'),
        ('Filters', '{language === "ar" ? "الفلاتر" : "Filters"}'),
        ('placeholder="Search (space separates terms: e.g. ahmed dev)"', 'placeholder={language === "ar" ? "بحث (المسافة تفصل بين المصطلحات: مثل أحمد مطور)" : "Search (space separates terms: e.g. ahmed dev)"}'),
        ('label="Employee"', 'label={language === "ar" ? "الموظف" : "Employee"}'),
        ('label="Department"', 'label={language === "ar" ? "القسم" : "Department"}'),
        ('label="Job"', 'label={language === "ar" ? "الوظيفة" : "Job"}'),
        ('label="Status"', 'label={language === "ar" ? "الحالة" : "Status"}'),
        ('label="Element Type"', 'label={language === "ar" ? "نوع العنصر" : "Element Type"}'),
        ('{ id: "earning", name: "Earning" }', '{ id: "earning", name: language === "ar" ? "مستحق" : "Earning" }'),
        ('{ id: "deduction", name: "Deduction" }', '{ id: "deduction", name: language === "ar" ? "استقطاع" : "Deduction" }'),
        ('{ id: "employer_contribution", name: "Employer Contribution" }', '{ id: "employer_contribution", name: language === "ar" ? "مساهمة صاحب العمل" : "Employer Contribution" }'),
        ('{ id: "information", name: "Information" }', '{ id: "information", name: language === "ar" ? "معلومات" : "Information" }'),
        ('label="Elements"', 'label={language === "ar" ? "العناصر" : "Elements"}'),
        ('Hide employees with no values', '{language === "ar" ? "إخفاء الموظفين الذين ليس لديهم قيم" : "Hide employees with no values"}'),
        ('Clear all', '{language === "ar" ? "مسح الكل" : "Clear all"}'),
        ('Loading...', '{language === "ar" ? "جاري التحميل..." : "Loading..."}'),
        ('employees ×', '{language === "ar" ? "موظفين ×" : "employees ×"}'),
        ('elements —', '{language === "ar" ? "عناصر —" : "elements —"}'),
        ('Employee {sortBadge("name")}', '{language === "ar" ? "الموظف" : "Employee"} {sortBadge("name")}'),
        ('Number {sortBadge("employee_number")}', '{language === "ar" ? "الرقم" : "Number"} {sortBadge("employee_number")}'),
        ('Department {sortBadge("dept")}', '{language === "ar" ? "القسم" : "Department"} {sortBadge("dept")}'),
        ('Job {sortBadge("job")}', '{language === "ar" ? "الوظيفة" : "Job"} {sortBadge("job")}'),
        ('Net {sortBadge("net")}', '{language === "ar" ? "الصافي" : "Net"} {sortBadge("net")}'),
        ('No employees match the filters', '{language === "ar" ? "لا يوجد موظفين يطابقون الفلاتر" : "No employees match the filters"}'),
        ('TOTAL', '{language === "ar" ? "الإجمالي" : "TOTAL"}'),
        ('Tip: click a column header to sort. Hold <kbd className="px-1 border rounded">Shift</kbd> to add a secondary sort. Variable entries for the selected month override the assigned amount.', '{language === "ar" ? "تلميح: انقر فوق رأس العمود للفرز. اضغط مع الاستمرار على Shift لإضافة فرز ثانوي. العناصر المتغيرة للشهر المحدد تلغي المبلغ المحدد." : "Tip: click a column header to sort. Hold <kbd className=\\"px-1 border rounded\\">Shift</kbd> to add a secondary sort. Variable entries for the selected month override the assigned amount."}'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    # Months array
    months_pattern = r'const months = \[\s*"January", "February", "March", "April", "May", "June",\s*"July", "August", "September", "October", "November", "December",\s*\];'
    months_replacement = """const months = language === "ar"
    ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];"""
    content = re.sub(months_pattern, months_replacement, content)
    
    return content

def translate_variable_entry(content):
    content = content.replace('import { useEffect, useMemo, useRef, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";\nimport { useLanguage } from "@/contexts/LanguageContext";')
    content = content.replace('export default function PayrollVariableEntry() {', 'export default function PayrollVariableEntry() {\n  const { language } = useLanguage();')
    
    replacements = [
        ('toast({ title: "No active variable elements" });', 'toast({ title: language === "ar" ? "لا توجد عناصر متغيرة نشطة" : "No active variable elements" });'),
        ('toast({ title: "Empty file", variant: "destructive" });', 'toast({ title: language === "ar" ? "ملف فارغ" : "Empty file", variant: "destructive" });'),
        ('title: "Imported",', 'title: language === "ar" ? "تم الاستيراد" : "Imported",'),
        ('description: `${touched} cell(s) marked. ${skippedEmps} unknown employees skipped.${unknownCols.length ? ` Unknown columns: ${unknownCols.join(", ")}` : ""} Click Save All to persist.`,', 'description: language === "ar" ? `${touched} خلايا تم تعليمها. ${skippedEmps} موظفون غير معروفين تم تجاهلهم.${unknownCols.length ? ` أعمدة غير معروفة: ${unknownCols.join(", ")}` : ""} انقر على حفظ الكل للاستمرار.` : `${touched} cell(s) marked. ${skippedEmps} unknown employees skipped.${unknownCols.length ? ` Unknown columns: ${unknownCols.join(", ")}` : ""} Click Save All to persist.`,'),
        ('toast({ title: "Import failed",', 'toast({ title: language === "ar" ? "فشل الاستيراد" : "Import failed",'),
        ('toast({ title: "No changes" });', 'toast({ title: language === "ar" ? "لا توجد تغييرات" : "No changes" });'),
        ('toast({ title: "Saved", description: `${dirty.length} cell(s) saved.` });', 'toast({ title: language === "ar" ? "تم الحفظ" : "Saved", description: language === "ar" ? `${dirty.length} خلايا تم حفظها.` : `${dirty.length} cell(s) saved.` });'),
        ('toast({ title: "Error",', 'toast({ title: language === "ar" ? "خطأ" : "Error",'),
        ('No options', '{language === "ar" ? "لا توجد خيارات" : "No options"}'),
        ('Clear', '{language === "ar" ? "مسح" : "Clear"}'),
        ('<h1 className="text-2xl font-bold">Variable Element Entry</h1>', '<h1 className="text-2xl font-bold">{language === "ar" ? "إدخال العناصر المتغيرة" : "Variable Element Entry"}</h1>'),
        ('Template', '{language === "ar" ? "نموذج" : "Template"}'),
        ('Import', '{language === "ar" ? "استيراد" : "Import"}'),
        ('Export', '{language === "ar" ? "تصدير" : "Export"}'),
        ('unsaved', '{language === "ar" ? "غير محفوظ" : "unsaved"}'),
        ('Saving...', '{language === "ar" ? "جاري الحفظ..." : "Saving..."}'),
        ('Save All', '{language === "ar" ? "حفظ الكل" : "Save All"}'),
        ('Period & Filters', '{language === "ar" ? "الفترة والفلاتر" : "Period & Filters"}'),
        ('Year', '{language === "ar" ? "السنة" : "Year"}'),
        ('Month', '{language === "ar" ? "الشهر" : "Month"}'),
        ('placeholder="Search (space separates terms)"', 'placeholder={language === "ar" ? "بحث (المسافة تفصل بين المصطلحات)" : "Search (space separates terms)"}'),
        ('label="Department"', 'label={language === "ar" ? "القسم" : "Department"}'),
        ('label="Job"', 'label={language === "ar" ? "الوظيفة" : "Job"}'),
        ('label="Status"', 'label={language === "ar" ? "الحالة" : "Status"}'),
        ('label="Elements"', 'label={language === "ar" ? "العناصر" : "Elements"}'),
        ('Clear all', '{language === "ar" ? "مسح الكل" : "Clear all"}'),
        ('Tip: click a column header to sort. Hold <kbd className="px-1 border rounded">Shift</kbd> while clicking to add a secondary sort.', '{language === "ar" ? "تلميح: انقر فوق رأس العمود للفرز. اضغط مع الاستمرار على Shift أثناء النقر لإضافة فرز ثانوي." : "Tip: click a column header to sort. Hold <kbd className=\\"px-1 border rounded\\">Shift</kbd> while clicking to add a secondary sort."}'),
        ('Loading...', '{language === "ar" ? "جاري التحميل..." : "Loading..."}'),
        ('employees ×', '{language === "ar" ? "موظفين ×" : "employees ×"}'),
        ('variable elements —', '{language === "ar" ? "عناصر متغيرة —" : "variable elements —"}'),
        ('Employee {sortBadge("name")}', '{language === "ar" ? "الموظف" : "Employee"} {sortBadge("name")}'),
        ('Number {sortBadge("employee_number")}', '{language === "ar" ? "الرقم" : "Number"} {sortBadge("employee_number")}'),
        ('Department {sortBadge("dept")}', '{language === "ar" ? "القسم" : "Department"} {sortBadge("dept")}'),
        ('Job {sortBadge("job")}', '{language === "ar" ? "الوظيفة" : "Job"} {sortBadge("job")}'),
        ('No employees match the filters', '{language === "ar" ? "لا يوجد موظفين يطابقون الفلاتر" : "No employees match the filters"}'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)

    # Months in Select
    months_select_pattern = r'\{Array\.from\(\{ length: 12 \}\)\.map\(\(_, i\) => \(\s*<SelectItem key=\{i \+ 1\} value=\{String\(i \+ 1\)\}>\{i \+ 1\}</SelectItem>\s*\)\)\}'
    months_select_replacement = """{Array.from({ length: 12 }).map((_, i) => {
                    const months = language === "ar"
                      ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
                      : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                    return (
                      <SelectItem key={i + 1} value={String(i + 1)}>{language === "ar" ? months[i] : i + 1}</SelectItem>
                    );
                  })}"""
    content = re.sub(months_select_pattern, months_select_replacement, content)

    return content

with open('src/pages/PayrollMonthPreview.tsx', 'r') as f:
    content = f.read()
content = translate_month_preview(content)
with open('src/pages/PayrollMonthPreview.tsx', 'w') as f:
    f.write(content)

with open('src/pages/PayrollVariableEntry.tsx', 'r') as f:
    content = f.read()
content = translate_variable_entry(content)
with open('src/pages/PayrollVariableEntry.tsx', 'w') as f:
    f.write(content)
