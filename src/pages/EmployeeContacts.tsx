import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, Phone, Smartphone, Building2, Briefcase } from "lucide-react";

interface EmployeeRow {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  work_mobile: string | null;
  photo_url: string | null;
  department: { name: string; name_ar: string | null } | null;
  job_position: { title: string; title_ar: string | null } | null;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function EmployeeContacts() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [letter, setLetter] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, employee_number, first_name, last_name, first_name_ar, last_name_ar, email, phone, mobile, work_mobile, photo_url, department:departments(name, name_ar), job_position:job_positions(title, title_ar)"
        )
        .eq("employment_status", "active")
        .order("first_name", { ascending: true });
      if (!error && data) setEmployees(data as any);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const fullEn = `${e.first_name} ${e.last_name}`.toLowerCase();
      const fullAr = `${e.first_name_ar ?? ""} ${e.last_name_ar ?? ""}`.toLowerCase();
      if (letter && !e.first_name.toUpperCase().startsWith(letter)) return false;
      if (!q) return true;
      return (
        fullEn.includes(q) ||
        fullAr.includes(q) ||
        (e.email ?? "").toLowerCase().includes(q) ||
        (e.mobile ?? "").includes(q) ||
        (e.work_mobile ?? "").includes(q) ||
        (e.phone ?? "").includes(q) ||
        e.employee_number.toLowerCase().includes(q)
      );
    });
  }, [employees, search, letter]);

  return (
    <div className="container mx-auto p-6 space-y-6" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {isAr ? "دليل الموظفين" : "Employee Contacts"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "ابحث عن بيانات التواصل لأي موظف في الشركة"
              : "Search contact details for any employee in the company"}
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "بحث بالاسم أو البريد أو الجوال..." : "Search name, email or mobile..."}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Button
          variant={letter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setLetter(null)}
        >
          {isAr ? "الكل" : "All"}
        </Button>
        {ALPHABET.map((l) => (
          <Button
            key={l}
            variant={letter === l ? "default" : "outline"}
            size="sm"
            className="w-9 h-8 p-0"
            onClick={() => setLetter(letter === l ? null : l)}
          >
            {l}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-10">
          {isAr ? "جارٍ التحميل..." : "Loading..."}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-10">
          {isAr ? "لا توجد نتائج" : "No employees found"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((e) => {
            const name = isAr && e.first_name_ar
              ? `${e.first_name_ar} ${e.last_name_ar ?? ""}`
              : `${e.first_name} ${e.last_name}`;
            const initials = `${e.first_name?.[0] ?? ""}${e.last_name?.[0] ?? ""}`.toUpperCase();
            const dept = e.department ? (isAr && e.department.name_ar ? e.department.name_ar : e.department.name) : null;
            const job = e.job_position ? (isAr && e.job_position.title_ar ? e.job_position.title_ar : e.job_position.title) : null;
            return (
              <Card key={e.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14">
                      {e.photo_url && <AvatarImage src={e.photo_url} alt={name} />}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{name}</div>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {e.employee_number}
                      </Badge>
                    </div>
                  </div>

                  {(dept || job) && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {job && (
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{job}</span>
                        </div>
                      )}
                      {dept && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{dept}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t pt-3 space-y-2 text-sm">
                    {e.email ? (
                      <a
                        href={`mailto:${e.email}`}
                        className="flex items-center gap-2 hover:text-primary truncate"
                        dir="ltr"
                      >
                        <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{e.email}</span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4 shrink-0" />
                        <span className="italic text-xs">{isAr ? "غير متوفر" : "Not available"}</span>
                      </div>
                    )}
                    {e.work_mobile ? (
                      <a
                        href={`tel:${e.work_mobile}`}
                        className="flex items-center gap-2 hover:text-primary"
                        dir="ltr"
                      >
                        <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>{e.work_mobile}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {isAr ? "عمل" : "Work"}
                        </Badge>
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Smartphone className="h-4 w-4 shrink-0" />
                        <span className="italic text-xs">{isAr ? "جوال العمل غير متوفر" : "Work mobile N/A"}</span>
                      </div>
                    )}
                    {e.mobile ? (
                      <a
                        href={`tel:${e.mobile}`}
                        className="flex items-center gap-2 hover:text-primary"
                        dir="ltr"
                      >
                        <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>{e.mobile}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {isAr ? "خاص" : "Private"}
                        </Badge>
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4 shrink-0" />
                        <span className="italic text-xs">{isAr ? "الجوال الخاص غير متوفر" : "Private mobile N/A"}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
