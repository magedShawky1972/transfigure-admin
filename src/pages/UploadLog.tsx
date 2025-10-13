import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Calendar, FileSpreadsheet, User, AlertCircle, CheckCircle2 } from "lucide-react";

interface UploadLog {
  id: string;
  upload_date: string;
  file_name: string;
  user_name: string;
  status: string;
  records_processed: number;
  error_message: string | null;
  excel_dates: any;
  new_customers_count: number;
}

const UploadLog = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [showDatesDialog, setShowDatesDialog] = useState(false);

  useEffect(() => {
    loadUploadLogs();
  }, []);

  const loadUploadLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("upload_logs")
      .select("*")
      .order("upload_date", { ascending: false });

    if (error) {
      toast({
        title: "Error loading upload logs",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setLogs(data || []);
    }
    setIsLoading(false);
  };

  const showExcelDates = (dates: any) => {
    if (dates && Array.isArray(dates) && dates.length > 0) {
      setSelectedDates(dates);
      setShowDatesDialog(true);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "processing":
        return <Badge variant="secondary">Processing</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Upload Log</h1>
        <p className="text-muted-foreground">
          Track all Excel file uploads and their processing status
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload History</CardTitle>
          <CardDescription>
            View details of all uploaded Excel files
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading upload logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No uploads found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>New Customers</TableHead>
                    <TableHead>Excel Dates</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(log.upload_date), "MMM dd, yyyy HH:mm")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-primary" />
                          <span className="font-medium">{log.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {log.user_name}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        <span className="font-mono">{log.records_processed}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{log.new_customers_count || 0}</span>
                      </TableCell>
                      <TableCell>
                        {log.excel_dates && log.excel_dates.length > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => showExcelDates(log.excel_dates)}
                          >
                            View Dates ({log.excel_dates.length})
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">No dates</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.error_message ? (
                          <span className="text-destructive text-xs">{log.error_message}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDatesDialog} onOpenChange={setShowDatesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excel Sheet Dates</DialogTitle>
            <DialogDescription>
              All distinct dates found in the uploaded Excel file
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {selectedDates.map((date, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-md bg-secondary"
                >
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-mono text-sm">
                    {format(new Date(date), "MMM dd, yyyy")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UploadLog;
