import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCheck, Eye } from "lucide-react";
import { format } from "date-fns";

interface SignedDocument {
  id: string;
  signed_at: string;
  document: {
    id: string;
    title: string;
    title_ar: string | null;
    content: string;
    content_ar: string | null;
  } | null;
}

interface Props {
  userId: string;
}

const EmployeeAcknowledgments = ({ userId }: Props) => {
  const { language } = useLanguage();
  const [signatures, setSignatures] = useState<SignedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<SignedDocument | null>(null);

  const t = {
    ar: {
      title: "الإقرارات الموقعة",
      documentTitle: "الإقرار",
      signedAt: "تاريخ التوقيع",
      status: "الحالة",
      signed: "موقع",
      view: "عرض",
      noSignatures: "لا توجد إقرارات موقعة",
    },
    en: {
      title: "Signed Acknowledgments",
      documentTitle: "Document",
      signedAt: "Signed At",
      status: "Status",
      signed: "Signed",
      view: "View",
      noSignatures: "No signed acknowledgments",
    },
  };

  const texts = t[language as keyof typeof t] || t.en;

  useEffect(() => {
    fetchSignatures();
  }, [userId]);

  const fetchSignatures = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("acknowledgment_signatures")
        .select(`
          id,
          signed_at,
          document:document_id (
            id,
            title,
            title_ar,
            content,
            content_ar
          )
        `)
        .eq("user_id", userId)
        .order("signed_at", { ascending: false });

      if (error) throw error;
      setSignatures(data as SignedDocument[] || []);
    } catch (error) {
      console.error("Error fetching signatures:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (sig: SignedDocument) => {
    setSelectedDoc(sig);
    setViewDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            {texts.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            {texts.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {signatures.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{texts.noSignatures}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{texts.documentTitle}</TableHead>
                  <TableHead>{texts.signedAt}</TableHead>
                  <TableHead>{texts.status}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signatures.map((sig) => (
                  <TableRow key={sig.id}>
                    <TableCell className="font-medium">
                      {sig.document
                        ? language === "ar" && sig.document.title_ar
                          ? sig.document.title_ar
                          : sig.document.title
                        : "-"}
                    </TableCell>
                    <TableCell>{format(new Date(sig.signed_at), "yyyy-MM-dd HH:mm")}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-500">
                        <FileCheck className="h-3 w-3 mr-1" />
                        {texts.signed}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleView(sig)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Document Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedDoc?.document &&
                (language === "ar" && selectedDoc.document.title_ar
                  ? selectedDoc.document.title_ar
                  : selectedDoc.document.title)}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[500px]">
            {selectedDoc?.document && (
              <div
                className="prose dark:prose-invert max-w-none p-4"
                dangerouslySetInnerHTML={{
                  __html:
                    language === "ar" && selectedDoc.document.content_ar
                      ? selectedDoc.document.content_ar
                      : selectedDoc.document.content,
                }}
              />
            )}
          </ScrollArea>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCheck className="h-4 w-4 text-green-500" />
            {texts.signedAt}: {selectedDoc && format(new Date(selectedDoc.signed_at), "yyyy-MM-dd HH:mm")}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmployeeAcknowledgments;
