import sys
import re

def fix_variable_entry(content):
    content = content.replace('onClick={download{language === "ar" ? "نموذج" : "Template"}}', 'onClick={downloadTemplate}')
    content = content.replace('"{language === "ar" ? "جاري الحفظ..." : "Saving..."}"', '(language === "ar" ? "جاري الحفظ..." : "Saving...")')
    content = content.replace('"{language === "ar" ? "حفظ الكل" : "Save All"}"', '(language === "ar" ? "حفظ الكل" : "Save All")')
    return content

with open('src/pages/PayrollVariableEntry.tsx', 'r') as f:
    content = f.read()
content = fix_variable_entry(content)
with open('src/pages/PayrollVariableEntry.tsx', 'w') as f:
    f.write(content)
