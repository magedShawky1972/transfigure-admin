import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ProjectsTasksReport from "@/components/ProjectsTasksReport";
import { useLanguage } from "@/contexts/LanguageContext";

const ProjectsTasksReportPage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "تقرير المشاريع والمهام" : "Projects & Tasks Report"}
        </h1>
      </div>
      <ProjectsTasksReport />
    </div>
  );
};

export default ProjectsTasksReportPage;
