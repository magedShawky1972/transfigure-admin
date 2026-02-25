import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Download, Upload, Loader2, FileSpreadsheet, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx";

interface Department {
  id: string;
  department_name: string;
}

interface Profile {
  user_id: string;
  user_name: string;
}

interface Project {
  id: string;
  name: string;
}

interface ImportError {
  row: number;
  message: string;
}

interface ProjectTaskExcelImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: string;
  departments: Department[];
  users: Profile[];
  projects: Project[];
  selectedDepartment: string;
  currentUserId: string;
  onImportComplete: () => void;
}

type ImportMode = "tasks_only" | "projects_and_tasks";

export const ProjectTaskExcelImport = ({
  open,
  onOpenChange,
  language,
  departments,
  users,
  projects,
  selectedDepartment,
  currentUserId,
  onImportComplete,
}: ProjectTaskExcelImportProps) => {
  const [importMode, setImportMode] = useState<ImportMode>("tasks_only");
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAr = language === "ar";

  const t = {
    title: isAr ? "استيراد من Excel" : "Import from Excel",
    importMode: isAr ? "نوع الاستيراد" : "Import Mode",
    tasksOnly: isAr ? "مهام فقط" : "Tasks Only",
    projectsAndTasks: isAr ? "مشاريع ومهام" : "Projects & Tasks",
    downloadTemplate: isAr ? "تحميل القالب" : "Download Template",
    uploadFile: isAr ? "رفع الملف" : "Upload File",
    importing: isAr ? "جاري الاستيراد..." : "Importing...",
    close: isAr ? "إغلاق" : "Close",
    success: isAr ? "تم الاستيراد بنجاح" : "Import successful",
    errors: isAr ? "أخطاء الاستيراد" : "Import Errors",
    row: isAr ? "صف" : "Row",
    imported: isAr ? "تم استيراد" : "Imported",
    failed: isAr ? "فشل" : "Failed",
    instructions: isAr 
      ? "1. اختر نوع الاستيراد\n2. حمّل القالب\n3. املأ البيانات\n4. ارفع الملف" 
      : "1. Select import mode\n2. Download template\n3. Fill in data\n4. Upload file",
    instructionsTitle: isAr ? "التعليمات" : "Instructions",
    tasksOnlyNote: isAr 
      ? "استيراد مهام فقط - المشروع اختياري" 
      : "Import tasks only - project is optional",
    projectsAndTasksNote: isAr 
      ? "استيراد مشاريع جديدة مع مهامها - سيتم إنشاء المشاريع تلقائياً" 
      : "Import new projects with their tasks - projects will be created automatically",
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    if (importMode === "tasks_only") {
      const headers = [
        "project_name", "task_title", "description", "assigned_to_username",
        "priority", "status", "start_date", "deadline"
      ];
      const sampleData = [
        headers,
        ["My Project", "Design Homepage", "Create UI mockups", "john", "medium", "todo", "2026-03-01", "2026-03-15"],
        ["", "Build API", "Create REST endpoints", "jane", "high", "todo", "2026-03-05", "2026-03-20"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      ws["!cols"] = headers.map(() => ({ wch: 22 }));

      const instrData = [
        [isAr ? "تعليمات قالب استيراد المهام" : "Tasks Import Template Instructions"],
        [""],
        [isAr ? "الحقل" : "Field", isAr ? "مطلوب" : "Required", isAr ? "الوصف" : "Description"],
        ["project_name", isAr ? "لا" : "No", isAr ? "اسم المشروع الموجود - اتركه فارغاً إذا المهمة بدون مشروع" : "Existing project name - leave empty if task has no project"],
        ["task_title", isAr ? "نعم" : "Yes", isAr ? "عنوان المهمة" : "Task title"],
        ["description", isAr ? "لا" : "No", isAr ? "وصف المهمة" : "Task description"],
        ["assigned_to_username", isAr ? "نعم" : "Yes", isAr ? "اسم المستخدم المسند إليه" : "Username of assignee"],
        ["priority", isAr ? "لا" : "No", isAr ? "الأولوية: low, medium, high, urgent (الافتراضي: medium)" : "Priority: low, medium, high, urgent (default: medium)"],
        ["status", isAr ? "لا" : "No", isAr ? "الحالة: todo, in_progress, review, done (الافتراضي: todo)" : "Status: todo, in_progress, review, done (default: todo)"],
        ["start_date", isAr ? "لا" : "No", isAr ? "تاريخ البداية بصيغة YYYY-MM-DD" : "Start date in YYYY-MM-DD format"],
        ["deadline", isAr ? "لا" : "No", isAr ? "الموعد النهائي بصيغة YYYY-MM-DD" : "Deadline in YYYY-MM-DD format"],
      ];
      const instrWs = XLSX.utils.aoa_to_sheet(instrData);
      instrWs["!cols"] = [{ wch: 25 }, { wch: 10 }, { wch: 50 }];

      const projectNames = projects.map(p => [p.name]);
      const projectRefData = [[isAr ? "المشاريع المتاحة" : "Available Projects"], ...projectNames];
      const projectRefWs = XLSX.utils.aoa_to_sheet(projectRefData);

      const userNames = users.map(u => [u.user_name]);
      const userRefData = [[isAr ? "المستخدمون المتاحون" : "Available Users"], ...userNames];
      const userRefWs = XLSX.utils.aoa_to_sheet(userRefData);

      XLSX.utils.book_append_sheet(wb, ws, "Tasks");
      XLSX.utils.book_append_sheet(wb, instrWs, "Instructions");
      XLSX.utils.book_append_sheet(wb, projectRefWs, "Projects Reference");
      XLSX.utils.book_append_sheet(wb, userRefWs, "Users Reference");
      XLSX.writeFile(wb, "tasks_import_template.xlsx");
    } else {
      // Projects and tasks template
      const headers = [
        "project_name", "project_description", "project_status", "project_start_date", "project_end_date",
        "task_title", "task_description", "assigned_to_username",
        "priority", "status", "start_date", "deadline"
      ];
      const sampleData = [
        headers,
        ["New Project", "Project description", "active", "2026-03-01", "2026-06-30", "Task 1", "First task desc", "john", "high", "todo", "2026-03-01", "2026-03-15"],
        ["New Project", "", "", "", "", "Task 2", "Second task desc", "jane", "medium", "todo", "2026-03-05", "2026-03-20"],
        ["Another Project", "Another project desc", "active", "2026-04-01", "2026-09-30", "Task A", "Task A desc", "john", "low", "todo", "2026-04-01", "2026-04-15"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      ws["!cols"] = headers.map(() => ({ wch: 22 }));

      const instrData = [
        [isAr ? "تعليمات قالب استيراد المشاريع والمهام" : "Projects & Tasks Import Template Instructions"],
        [""],
        [isAr ? "الحقل" : "Field", isAr ? "مطلوب" : "Required", isAr ? "الوصف" : "Description"],
        ["project_name", isAr ? "نعم" : "Yes", isAr ? "اسم المشروع - المهام بنفس الاسم ستنتمي لنفس المشروع" : "Project name - tasks with same name belong to the same project"],
        ["project_description", isAr ? "لا" : "No", isAr ? "وصف المشروع (فقط في أول صف للمشروع)" : "Project description (only in first row of project)"],
        ["project_status", isAr ? "لا" : "No", isAr ? "حالة المشروع: active, completed, on_hold, cancelled (الافتراضي: active)" : "Project status: active, completed, on_hold, cancelled (default: active)"],
        ["project_start_date", isAr ? "لا" : "No", isAr ? "تاريخ بداية المشروع YYYY-MM-DD" : "Project start date YYYY-MM-DD"],
        ["project_end_date", isAr ? "لا" : "No", isAr ? "تاريخ نهاية المشروع YYYY-MM-DD" : "Project end date YYYY-MM-DD"],
        ["task_title", isAr ? "نعم" : "Yes", isAr ? "عنوان المهمة" : "Task title"],
        ["task_description", isAr ? "لا" : "No", isAr ? "وصف المهمة" : "Task description"],
        ["assigned_to_username", isAr ? "نعم" : "Yes", isAr ? "اسم المستخدم المسند إليه" : "Username of assignee"],
        ["priority", isAr ? "لا" : "No", isAr ? "الأولوية: low, medium, high, urgent (الافتراضي: medium)" : "Priority: low, medium, high, urgent (default: medium)"],
        ["status", isAr ? "لا" : "No", isAr ? "الحالة: todo, in_progress, review, done (الافتراضي: todo)" : "Status: todo, in_progress, review, done (default: todo)"],
        ["start_date", isAr ? "لا" : "No", isAr ? "تاريخ بداية المهمة YYYY-MM-DD" : "Task start date YYYY-MM-DD"],
        ["deadline", isAr ? "لا" : "No", isAr ? "الموعد النهائي YYYY-MM-DD" : "Deadline YYYY-MM-DD"],
      ];
      const instrWs = XLSX.utils.aoa_to_sheet(instrData);
      instrWs["!cols"] = [{ wch: 25 }, { wch: 10 }, { wch: 60 }];

      const userNames = users.map(u => [u.user_name]);
      const userRefData = [[isAr ? "المستخدمون المتاحون" : "Available Users"], ...userNames];
      const userRefWs = XLSX.utils.aoa_to_sheet(userRefData);

      XLSX.utils.book_append_sheet(wb, ws, "Projects & Tasks");
      XLSX.utils.book_append_sheet(wb, instrWs, "Instructions");
      XLSX.utils.book_append_sheet(wb, userRefWs, "Users Reference");
      XLSX.writeFile(wb, "projects_tasks_import_template.xlsx");
    }

    toast({ title: isAr ? "تم تحميل القالب" : "Template downloaded" });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setErrors([]);
    setImportResults(null);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (rows.length < 2) {
        toast({ title: isAr ? "الملف فارغ" : "File is empty", variant: "destructive" });
        return;
      }

      // Remove header row
      const headerRow = rows[0] as string[];
      const dataRows = rows.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ""));

      if (importMode === "tasks_only") {
        await importTasksOnly(headerRow, dataRows);
      } else {
        await importProjectsAndTasks(headerRow, dataRows);
      }

      onImportComplete();
    } catch (error: any) {
      console.error("Import error:", error);
      toast({ title: isAr ? "خطأ في الاستيراد" : "Import error", description: error.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getColumnIndex = (headers: string[], name: string): number => {
    return headers.findIndex(h => h?.toString().trim().toLowerCase() === name.toLowerCase());
  };

  const getCellValue = (row: any[], index: number): string => {
    if (index < 0 || index >= row.length) return "";
    const val = row[index];
    if (val === undefined || val === null) return "";
    return String(val).trim();
  };

  const parseExcelDate = (value: any): string | null => {
    if (!value) return null;
    // If it's a number (Excel serial date)
    if (typeof value === "number") {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
      }
    }
    // If it's a string, try to parse
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // Try other formats
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return null;
  };

  const findUser = (username: string): string | null => {
    if (!username) return null;
    const lower = username.toLowerCase();
    const user = users.find(u => u.user_name.toLowerCase() === lower);
    return user ? user.user_id : null;
  };

  const findProject = (projectName: string): string | null => {
    if (!projectName) return null;
    const lower = projectName.toLowerCase();
    const project = projects.find(p => p.name.toLowerCase() === lower);
    return project ? project.id : null;
  };

  const validPriorities = ["low", "medium", "high", "urgent"];
  const validStatuses = ["todo", "in_progress", "review", "done"];
  const validProjectStatuses = ["active", "completed", "on_hold", "cancelled"];

  const importTasksOnly = async (headers: string[], dataRows: any[][]) => {
    const colIdx = {
      project_name: getColumnIndex(headers, "project_name"),
      task_title: getColumnIndex(headers, "task_title"),
      description: getColumnIndex(headers, "description"),
      assigned_to: getColumnIndex(headers, "assigned_to_username"),
      priority: getColumnIndex(headers, "priority"),
      status: getColumnIndex(headers, "status"),
      start_date: getColumnIndex(headers, "start_date"),
      deadline: getColumnIndex(headers, "deadline"),
    };

    const importErrors: ImportError[] = [];
    let successCount = 0;
    const tasksToInsert: any[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;

      const projectName = getCellValue(row, colIdx.project_name);
      const taskTitle = getCellValue(row, colIdx.task_title);
      const assignedToName = getCellValue(row, colIdx.assigned_to);
      const priority = getCellValue(row, colIdx.priority).toLowerCase() || "medium";
      const status = getCellValue(row, colIdx.status).toLowerCase() || "todo";

      if (!taskTitle) {
        importErrors.push({ row: rowNum, message: isAr ? "عنوان المهمة مطلوب" : "Task title is required" });
        continue;
      }

      if (!assignedToName) {
        importErrors.push({ row: rowNum, message: isAr ? "اسم المستخدم المسند إليه مطلوب" : "Assigned to username is required" });
        continue;
      }

      const assignedToId = findUser(assignedToName);
      if (!assignedToId) {
        importErrors.push({ row: rowNum, message: isAr ? `المستخدم "${assignedToName}" غير موجود` : `User "${assignedToName}" not found` });
        continue;
      }

      // Project is optional - resolve if provided
      let projectId: string | null = null;
      if (projectName) {
        projectId = findProject(projectName);
        if (!projectId) {
          importErrors.push({ row: rowNum, message: isAr ? `المشروع "${projectName}" غير موجود` : `Project "${projectName}" not found` });
          continue;
        }
      }

      if (!validPriorities.includes(priority)) {
        importErrors.push({ row: rowNum, message: isAr ? `أولوية غير صالحة: ${priority}` : `Invalid priority: ${priority}` });
        continue;
      }

      if (!validStatuses.includes(status)) {
        importErrors.push({ row: rowNum, message: isAr ? `حالة غير صالحة: ${status}` : `Invalid status: ${status}` });
        continue;
      }

      const startDate = parseExcelDate(row[colIdx.start_date]);
      const deadline = parseExcelDate(row[colIdx.deadline]);

      tasksToInsert.push({
        title: taskTitle,
        description: getCellValue(row, colIdx.description) || null,
        project_id: projectId,
        department_id: selectedDepartment,
        assigned_to: assignedToId,
        created_by: currentUserId,
        priority,
        status,
        start_date: startDate,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      });
    }

    // Batch insert tasks
    if (tasksToInsert.length > 0) {
      const { error } = await supabase.from("tasks").insert(tasksToInsert);
      if (error) {
        importErrors.push({ row: 0, message: isAr ? `خطأ في قاعدة البيانات: ${error.message}` : `Database error: ${error.message}` });
      } else {
        successCount = tasksToInsert.length;
      }
    }

    setErrors(importErrors);
    setImportResults({ success: successCount, failed: importErrors.length });

    if (successCount > 0) {
      toast({ title: isAr ? `تم استيراد ${successCount} مهمة بنجاح` : `Successfully imported ${successCount} tasks` });
    }
  };

  const importProjectsAndTasks = async (headers: string[], dataRows: any[][]) => {
    const colIdx = {
      project_name: getColumnIndex(headers, "project_name"),
      project_description: getColumnIndex(headers, "project_description"),
      project_status: getColumnIndex(headers, "project_status"),
      project_start_date: getColumnIndex(headers, "project_start_date"),
      project_end_date: getColumnIndex(headers, "project_end_date"),
      task_title: getColumnIndex(headers, "task_title"),
      task_description: getColumnIndex(headers, "task_description"),
      assigned_to: getColumnIndex(headers, "assigned_to_username"),
      priority: getColumnIndex(headers, "priority"),
      status: getColumnIndex(headers, "status"),
      start_date: getColumnIndex(headers, "start_date"),
      deadline: getColumnIndex(headers, "deadline"),
    };

    const importErrors: ImportError[] = [];
    let successCount = 0;

    // Group tasks by project name
    const projectGroups = new Map<string, { projectData: any; tasks: { rowData: any; rowNum: number }[] }>();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;

      const projectName = getCellValue(row, colIdx.project_name);
      const taskTitle = getCellValue(row, colIdx.task_title);
      const assignedToName = getCellValue(row, colIdx.assigned_to);

      if (!projectName) {
        importErrors.push({ row: rowNum, message: isAr ? "اسم المشروع مطلوب" : "Project name is required" });
        continue;
      }

      if (!taskTitle) {
        importErrors.push({ row: rowNum, message: isAr ? "عنوان المهمة مطلوب" : "Task title is required" });
        continue;
      }

      if (!assignedToName) {
        importErrors.push({ row: rowNum, message: isAr ? "اسم المستخدم المسند إليه مطلوب" : "Assigned to username is required" });
        continue;
      }

      const assignedToId = findUser(assignedToName);
      if (!assignedToId) {
        importErrors.push({ row: rowNum, message: isAr ? `المستخدم "${assignedToName}" غير موجود` : `User "${assignedToName}" not found` });
        continue;
      }

      const priority = getCellValue(row, colIdx.priority).toLowerCase() || "medium";
      const status = getCellValue(row, colIdx.status).toLowerCase() || "todo";

      if (!validPriorities.includes(priority)) {
        importErrors.push({ row: rowNum, message: isAr ? `أولوية غير صالحة: ${priority}` : `Invalid priority: ${priority}` });
        continue;
      }

      if (!validStatuses.includes(status)) {
        importErrors.push({ row: rowNum, message: isAr ? `حالة غير صالحة: ${status}` : `Invalid status: ${status}` });
        continue;
      }

      if (!projectGroups.has(projectName)) {
        const projStatus = getCellValue(row, colIdx.project_status).toLowerCase() || "active";
        if (!validProjectStatuses.includes(projStatus)) {
          importErrors.push({ row: rowNum, message: isAr ? `حالة مشروع غير صالحة: ${projStatus}` : `Invalid project status: ${projStatus}` });
          continue;
        }

        projectGroups.set(projectName, {
          projectData: {
            name: projectName,
            description: getCellValue(row, colIdx.project_description) || null,
            status: projStatus,
            start_date: parseExcelDate(row[colIdx.project_start_date]),
            end_date: parseExcelDate(row[colIdx.project_end_date]),
            department_id: selectedDepartment,
            created_by: currentUserId,
          },
          tasks: [],
        });
      }

      const startDate = parseExcelDate(row[colIdx.start_date]);
      const deadline = parseExcelDate(row[colIdx.deadline]);

      projectGroups.get(projectName)!.tasks.push({
        rowNum,
        rowData: {
          title: taskTitle,
          description: getCellValue(row, colIdx.task_description) || null,
          assigned_to: assignedToId,
          priority,
          status,
          start_date: startDate,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          department_id: selectedDepartment,
          created_by: currentUserId,
        },
      });
    }

    // Create projects and their tasks
    for (const [projectName, group] of projectGroups) {
      try {
        // Check if project already exists
        let projectId = findProject(projectName);

        if (!projectId) {
          // Create new project
          const { data: newProject, error: projError } = await supabase
            .from("projects")
            .insert(group.projectData)
            .select("id")
            .single();

          if (projError) {
            importErrors.push({ row: group.tasks[0]?.rowNum || 0, message: isAr ? `خطأ في إنشاء المشروع "${projectName}": ${projError.message}` : `Error creating project "${projectName}": ${projError.message}` });
            continue;
          }
          projectId = newProject.id;
        }

        // Insert tasks for this project
        const tasksToInsert = group.tasks.map(t => ({
          ...t.rowData,
          project_id: projectId,
        }));

        const { error: taskError } = await supabase.from("tasks").insert(tasksToInsert);
        if (taskError) {
          importErrors.push({ row: group.tasks[0]?.rowNum || 0, message: isAr ? `خطأ في إنشاء مهام "${projectName}": ${taskError.message}` : `Error creating tasks for "${projectName}": ${taskError.message}` });
        } else {
          successCount += tasksToInsert.length;
        }
      } catch (err: any) {
        importErrors.push({ row: group.tasks[0]?.rowNum || 0, message: err.message });
      }
    }

    setErrors(importErrors);
    setImportResults({ success: successCount, failed: importErrors.length });

    if (successCount > 0) {
      toast({ title: isAr ? `تم استيراد ${successCount} مهمة بنجاح` : `Successfully imported ${successCount} tasks` });
    }
  };

  const handleClose = () => {
    setErrors([]);
    setImportResults(null);
    setSelectedProjectId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="rounded-md border p-3 bg-muted/50 text-sm">
            <p className="font-medium mb-1">{t.instructionsTitle}:</p>
            <pre className="whitespace-pre-wrap text-muted-foreground text-xs">{t.instructions}</pre>
          </div>

          {/* Import Mode Selection */}
          <div>
            <label className="text-sm font-medium">{t.importMode}</label>
            <Select value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tasks_only">{t.tasksOnly}</SelectItem>
                <SelectItem value="projects_and_tasks">{t.projectsAndTasks}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {importMode === "tasks_only" ? t.tasksOnlyNote : t.projectsAndTasksNote}
            </p>
          </div>

          {/* Download Template */}
          <Button variant="outline" className="w-full" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            {t.downloadTemplate}
          </Button>

          {/* Upload File */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {importing ? t.importing : t.uploadFile}
            </Button>
          </div>

          {/* Import Results */}
          {importResults && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex gap-4 text-sm">
                <span className="text-green-600 font-medium">
                  ✓ {t.imported}: {importResults.success}
                </span>
                {importResults.failed > 0 && (
                  <span className="text-destructive font-medium">
                    ✗ {t.failed}: {importResults.failed}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/50 p-3">
              <p className="text-sm font-medium text-destructive flex items-center gap-1 mb-2">
                <AlertCircle className="h-4 w-4" />
                {t.errors}
              </p>
              <ScrollArea className="max-h-40">
                <div className="space-y-1">
                  {errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {err.row > 0 && <span className="font-medium">{t.row} {err.row}: </span>}
                      {err.message}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
