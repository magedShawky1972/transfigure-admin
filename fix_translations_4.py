import sys
import re

def fix_template_literals(content):
    # PayrollMonthPreview line 372
    # Before: `${sorted.length} {language === "ar" ? "موظفين ×" : "employees ×"} ${visibleElements.length} {language === "ar" ? "عناصر —" : "elements —"} ${months[month - 1]} ${year}`
    content = content.replace('{language === "ar" ? "موظفين ×" : "employees ×"}', '${language === "ar" ? "موظفين ×" : "employees ×"}')
    content = content.replace('{language === "ar" ? "عناصر —" : "elements —"}', '${language === "ar" ? "عناصر —" : "elements —"}')
    content = content.replace('{language === "ar" ? "عناصر متغيرة —" : "variable elements —"}', '${language === "ar" ? "عناصر متغيرة —" : "variable elements —"}')
    return content

with open('src/pages/PayrollMonthPreview.tsx', 'r') as f:
    content = f.read()
content = fix_template_literals(content)
with open('src/pages/PayrollMonthPreview.tsx', 'w') as f:
    f.write(content)

with open('src/pages/PayrollVariableEntry.tsx', 'r') as f:
    content = f.read()
content = fix_template_literals(content)
with open('src/pages/PayrollVariableEntry.tsx', 'w') as f:
    f.write(content)
