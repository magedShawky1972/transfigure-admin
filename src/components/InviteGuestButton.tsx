import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import InviteGuestDialog from "./InviteGuestDialog";
import { useLanguage } from "@/contexts/LanguageContext";

export default function InviteGuestButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <UserPlus className="h-4 w-4" />
        {language === "ar" ? "دعوة ضيف" : "Invite Guest"}
      </Button>
      <InviteGuestDialog open={open} onOpenChange={setOpen} projectId={projectId} projectName={projectName} />
    </>
  );
}
