import sys
import re

def fix_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    # Fix function names and setters
    content = content.replace('download{language === "ar" ? "نموذج" : "Template"}', 'downloadTemplate')
    content = content.replace('set{language === "ar" ? "السنة" : "Year"}', 'setYear')
    content = content.replace('set{language === "ar" ? "الشهر" : "Month"}', 'setMonth')
    content = content.replace('clear{language === "ar" ? "الفلاتر" : "Filters"}', 'clearFilters')
    
    # Fix broken template literals (double nested ${})
    content = content.replace('${${language', '${language')
    
    # Fix loading ternary that might be double quoted or broken
    content = content.replace('"{language === "ar" ? "جاري التحميل..." : "Loading..."}"', '(language === "ar" ? "جاري التحميل..." : "Loading...")')
    
    # Fix saveAll strings
    content = content.replace('"{language === "ar" ? "جاري الحفظ..." : "Saving..."}"', '(language === "ar" ? "جاري الحفظ..." : "Saving...")')
    content = content.replace('"{language === "ar" ? "حفظ الكل" : "Save All"}"', '(language === "ar" ? "حفظ الكل" : "Save All")')

    with open(path, 'w') as f:
        f.write(content)

fix_file('src/pages/PayrollMonthPreview.tsx')
fix_file('src/pages/PayrollVariableEntry.tsx')
