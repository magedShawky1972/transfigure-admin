import sys
import re

def fix_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    # Fix instances like "{language === 'ar' ? '...' : '...'}"
    # This happens in JS code when the script replaced a string literal but kept the outer quotes.
    # We want: language === 'ar' ? '...' : '...'
    
    pattern = r'"\{language === \\"ar\\" \? \\"(.+?)\\" : \\"(.+?)\\"\}"'
    content = re.sub(pattern, r'(language === "ar" ? "\1" : "\2")', content)
    
    # Also handle single quotes if any
    pattern2 = r'"{language === "ar" \? "(.+?)" : "(.+?)"}"'
    content = re.sub(pattern2, r'(language === "ar" ? "\1" : "\2")', content)

    # Fix loading/saving ternaries that might have been partially fixed
    content = content.replace('"{language === "ar" ? "جاري التحميل..." : "Loading..."}"', '(language === "ar" ? "جاري التحميل..." : "Loading...")')
    content = content.replace('"{language === "ar" ? "جاري الحفظ..." : "Saving..."}"', '(language === "ar" ? "جاري الحفظ..." : "Saving...")')
    content = content.replace('"{language === "ar" ? "حفظ الكل" : "Save All"}"', '(language === "ar" ? "حفظ الكل" : "Save All")')

    with open(path, 'w') as f:
        f.write(content)

fix_file('src/pages/PayrollMonthPreview.tsx')
fix_file('src/pages/PayrollVariableEntry.tsx')
