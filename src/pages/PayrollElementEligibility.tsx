import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type Element = { id: string; code: string; name_en: string; name_ar?: string | null; element_type: string };
type Job = { id: string; position_name: string; position_name_ar?: string | null };
type Dept = { id: string; department_name: string | null; department_name_ar?: string | null };
type Row = {
  id: string;
  element_id: string;
  job_position_id: string | null;
  department_id: string | null;
};

export default function PayrollElementEligibility() {
  const { language } = useLanguage();
  const [elements, setElements] = useState<Element[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedElement, setSelectedElement] = useState<string>("");
  const [newJob, setNewJob] = useState<string>("any");
  const [newDept, setNewDept] = useState<string>("any");

  const load = async () => {
    const [e, j, d] = await Promise.all([
      supabase.from("payroll_elements").select("id, code, name_en, name_ar, element_type").eq("is_active", true).order("name_en"),
      supabase.from("job_positions").select("id, position_name, position_name_ar").order("position_name"),
      supabase.from("departments").select("id, department_name, department_name_ar").order("department_name"),
    ]);
    setElements((e.data || []) as Element[]);
    setJobs((j.data || []) as Job[]);
    setDepts((d.data || []) as Dept[]);
  };

  const loadRows = async () => {
    if (!selectedElement) {
      setRows([]);
      return;
    }
    const { data, error } = await supabase
      .from("payroll_element_eligibility")
      .select("*")
      .eq("element_id", selectedElement);
    if (error) toast({ title: language === "ar" ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    else setRows((data || []) as Row[]);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadRows(); }, [selectedElement]);

  const add = async () => {
    if (!selectedElement) return;
    if (newJob === "any" && newDept === "any") {
      toast({ title: language === "ar" ? "اختر عاملاً واحداً على الأقل (وظيفة أو قسم)" : "Pick at least one filter (job or department)", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("payroll_element_eligibility").insert({
      element_id: selectedElement,
      job_position_id: newJob === "any" ? null : newJob,
      department_id: newDept === "any" ? null : newDept,
    });
    if (error) toast({ title: language === "ar" ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    else {
      setNewJob("any");
      setNewDept("any");
      loadRows();
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("payroll_element_eligibility").delete().eq("id", id);
    if (error) toast({ title: language === "ar" ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    else loadRows();
  };

  const deptName = (id: string | null) => {
    if (!id) return language === "ar" ? "جميع الأقسام" : "All Departments";
    const d = depts.find((x) => x.id === id);
    return (language === "ar" ? d?.department_name_ar : d?.department_name) || d?.department_name || id;
  };
  const jobName = (id: string | null) => {
    if (!id) return language === "ar" ? "جميع الوظائف" : "All Jobs";
    const j = jobs.find((x) => x.id === id); return (language === "ar" ? j?.position_name_ar : j?.position_name) || j?.position_name || id;
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">{language === "ar" ? "أهلية العناصر للوظائف والأقسام" : "Element Eligibility for Jobs & Departments"}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "اختر العنصر" : "Select Element"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedElement} onValueChange={setSelectedElement}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder={language === "ar" ? "اختر عنصراً..." : "Pick an element..."} /></SelectTrigger>
            <SelectContent>
              {elements.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  [{e.element_type === "earning" ? (language === "ar" ? "استحقاق" : "earning") : e.element_type === "deduction" ? (language === "ar" ? "استقطاع" : "deduction") : e.element_type === "employer_contribution" ? (language === "ar" ? "مساهمة صاحب العمل" : "employer_contribution") : (language === "ar" ? "للمعلومات فقط" : e.element_type)}] {e.code} — {language === "ar" && e.name_ar ? e.name_ar : e.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedElement && (
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "قواعد الأهلية" : "Eligibility Rules"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 items-end p-3 border rounded-md bg-muted/30">
              <div>
                <Label>{language === "ar" ? "المنصب الوظيفي" : "Job Position"}</Label>
                <Select value={newJob} onValueChange={setNewJob}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{language === "ar" ? "جميع الوظائف" : "All Jobs"}</SelectItem>
                    {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{language === "ar" && j.position_name_ar ? j.position_name_ar : j.position_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{language === "ar" ? "القسم" : "Department"}</Label>
                <Select value={newDept} onValueChange={setNewDept}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{language === "ar" ? "جميع الأقسام" : "All Departments"}</SelectItem>
                    {depts.map((d) => <SelectItem key={d.id} value={d.id}>{language === "ar" && d.department_name_ar ? d.department_name_ar : d.department_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> {language === "ar" ? "إضافة" : "Add"}</Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "المنصب الوظيفي" : "Job Position"}</TableHead>
                  <TableHead>{language === "ar" ? "القسم" : "Department"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="outline">{jobName(r.job_position_id)}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{deptName(r.department_id)}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      {language === "ar" ? "لا توجد قواعد — العنصر لا ينطبق على أحد. أضف قواعد أعلاه." : "No rules — element applies to no one. Add rules above."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
