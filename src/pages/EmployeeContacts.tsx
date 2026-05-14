import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, Phone, Smartphone, Building2, Briefcase, UserPlus, Download } from "lucide-react";

function escapeVCard(v: string | null | undefined) {
  if (!v) return "";
  return String(v).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function buildVCard(e: {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  work_mobile: string | null;
  employee_number: string;
  department?: { department_name: string } | null;
  job_position?: { position_name: string } | null;
}) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`UID:edara-${e.id}`);
  lines.push(`N:${escapeVCard(e.last_name)};${escapeVCard(e.first_name)};;;`);
  lines.push(`FN:${escapeVCard(`${e.first_name} ${e.last_name}`.trim())}`);
  if (e.job_position?.position_name) lines.push(`TITLE:${escapeVCard(e.job_position.position_name)}`);
  if (e.department?.department_name) lines.push(`ORG:${escapeVCard(e.department.department_name)}`);
  if (e.work_mobile) lines.push(`TEL;TYPE=CELL,WORK:${escapeVCard(e.work_mobile)}`);
  if (e.mobile) lines.push(`TEL;TYPE=CELL:${escapeVCard(e.mobile)}`);
  if (e.phone) lines.push(`TEL;TYPE=WORK,VOICE:${escapeVCard(e.phone)}`);
  if (e.email) lines.push(`EMAIL;TYPE=WORK:${escapeVCard(e.email)}`);
  if (e.employee_number) lines.push(`NOTE:Employee #${escapeVCard(e.employee_number)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function downloadVCard(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".vcf") ? filename : `${filename}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  department: { department_name: string; department_name_ar: string | null } | null;
  job_position: { position_name: string; position_name_ar: string | null } | null;
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
          "id, employee_number, first_name, last_name, first_name_ar, last_name_ar, email, phone, mobile, work_mobile, photo_url, department:departments(department_name, department_name_ar), job_position:job_positions(position_name, position_name_ar)"
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "بحث بالاسم أو البريد أو الجوال..." : "Search name, email or mobile..."}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const vcf = filtered.map((e) => buildVCard(e as any)).join("\r\n");
              downloadVCard(`edara-contacts-${new Date().toISOString().slice(0, 10)}.vcf`, vcf);
            }}
            disabled={filtered.length === 0}
            title={isAr ? "افتح الملف على هاتفك لإضافة جميع جهات الاتصال" : "Open the file on your phone to import all contacts"}
          >
            <Download className="h-4 w-4 mr-2" />
            {isAr
              ? `تحميل الكل (${filtered.length})`
              : `Download all (${filtered.length})`}
          </Button>
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
            const dept = e.department ? (isAr && e.department.department_name_ar ? e.department.department_name_ar : e.department.department_name) : null;
            const job = e.job_position ? (isAr && e.job_position.position_name_ar ? e.job_position.position_name_ar : e.job_position.position_name) : null;
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
