import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import DepartmentHierarchy from "@/components/DepartmentHierarchy";

interface Department {
  id: string;
  department_name: string;
  department_code: string;
  parent_department_id: string | null;
  is_active: boolean;
  description: string | null;
}

const CompanyHierarchy = () => {
  const { language } = useLanguage();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("department_name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getChildCount = (departmentId: string): number => {
    return departments.filter(d => d.parent_department_id === departmentId).length;
  };

  const getTotalDescendants = (departmentId: string): number => {
    const children = departments.filter(d => d.parent_department_id === departmentId);
    let count = children.length;
    children.forEach(child => {
      count += getTotalDescendants(child.id);
    });
    return count;
  };

  const rootDepartments = departments.filter(d => !d.parent_department_id && d.is_active);

  return (
    <div className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">
            {language === 'ar' ? 'الهيكل التنظيمي' : 'Company Hierarchy'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'عرض الهيكل التنظيمي للشركة والأقسام' 
              : 'View company organizational structure and departments'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {language === 'ar' ? 'إجمالي الأقسام' : 'Total Departments'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {departments.filter(d => d.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {language === 'ar' ? 'الأقسام الرئيسية' : 'Main Departments'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {rootDepartments.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {language === 'ar' ? 'الأقسام الفرعية' : 'Sub Departments'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {departments.filter(d => d.parent_department_id && d.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {language === 'ar' ? 'الهيكل التنظيمي' : 'Organizational Structure'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' 
                ? 'لا توجد أقسام. قم بإضافة أقسام من صفحة إدارة الأقسام.' 
                : 'No departments found. Add departments from Department Management page.'}
            </div>
          ) : (
            <div className="border rounded-lg p-4 max-h-[500px] overflow-y-auto">
              <DepartmentHierarchy
                departments={departments}
                showInactive={false}
                language={language}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyHierarchy;
