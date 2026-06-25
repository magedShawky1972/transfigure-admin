import sys
import re

def fix_month_preview(content):
    # Fix the accidental component name replacement
    content = content.replace('<{language === "ar" ? "تحديث" : "Refresh"}Cw', '<RefreshCw')
    return content

def fix_variable_entry(content):
    # Fix accidental setter replacements
    content = content.replace('set{language === "ar" ? "السنة" : "Year"}', 'setYear')
    content = content.replace('set{language === "ar" ? "الشهر" : "Month"}', 'setMonth')
    return content

with open('src/pages/PayrollMonthPreview.tsx', 'r') as f:
    content = f.read()
content = fix_month_preview(content)
with open('src/pages/PayrollMonthPreview.tsx', 'w') as f:
    f.write(content)

with open('src/pages/PayrollVariableEntry.tsx', 'r') as f:
    content = f.read()
content = fix_variable_entry(content)
with open('src/pages/PayrollVariableEntry.tsx', 'w') as f:
    f.write(content)
