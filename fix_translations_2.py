import sys
import re

def fix_month_preview(content):
    # Fix clearFilters
    content = content.replace('onClick={clear{language === "ar" ? "الفلاتر" : "Filters"}}', 'onClick={clearFilters}')
    
    # Fix nested loading translation
    content = content.replace('{loading ? "{language === "ar" ? "جاري التحميل..." : "Loading..."}"', '{loading ? (language === "ar" ? "جاري التحميل..." : "Loading...")')
    
    # Fix TOTAL if it was replaced incorrectly (it seems fine but good to check)
    # TOTAL was replaced by {language === "ar" ? "الإجمالي" : "TOTAL"} at line 448
    
    return content

def fix_variable_entry(content):
    # Fix nested loading translation
    content = content.replace('{loading ? "{language === "ar" ? "جاري التحميل..." : "Loading..."}"', '{loading ? (language === "ar" ? "جاري التحميل..." : "Loading...")')
    
    # Fix clearFilters
    content = content.replace('onClick={clear{language === "ar" ? "الفلاتر" : "Filters"}}', 'onClick={clearFilters}')
    
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
