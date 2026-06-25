import sys
import re

def fix_accidental_js_replacements(content):
    content = content.replace('getFullYear{language === "ar" ? "السنة" : "Year"}', 'getFullYear')
    content = content.replace('getFull{language === "ar" ? "السنة" : "Year"}', 'getFullYear')
    content = content.replace('getMonth{language === "ar" ? "الشهر" : "Month"}', 'getMonth')
    content = content.replace('get{language === "ar" ? "الشهر" : "Month"}', 'getMonth')
    return content

with open('src/pages/PayrollMonthPreview.tsx', 'r') as f:
    content = f.read()
content = fix_accidental_js_replacements(content)
with open('src/pages/PayrollMonthPreview.tsx', 'w') as f:
    f.write(content)

with open('src/pages/PayrollVariableEntry.tsx', 'r') as f:
    content = f.read()
content = fix_accidental_js_replacements(content)
with open('src/pages/PayrollVariableEntry.tsx', 'w') as f:
    f.write(content)
