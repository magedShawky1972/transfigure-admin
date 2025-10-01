import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Upload, Settings, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ExcelSheets = () => {
  const { toast } = useToast();
  const [sheets, setSheets] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Excel Sheet Management</h1>
          <p className="text-muted-foreground">
            Upload and configure Excel sheets with column mappings
          </p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" />
          Add New Sheet
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Excel Sheet</CardTitle>
          <CardDescription>
            Upload an Excel file and define its structure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sheet-code">Sheet Code</Label>
            <Input 
              id="sheet-code" 
              placeholder="e.g., TRANS_001" 
              className="max-w-md"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sheet-name">Sheet Name</Label>
            <Input 
              id="sheet-name" 
              placeholder="e.g., Monthly Transactions" 
              className="max-w-md"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-upload">Excel File</Label>
            <div className="flex items-center gap-4">
              <Input 
                id="file-upload" 
                type="file" 
                accept=".xlsx,.xls"
                className="max-w-md"
              />
              <Button variant="secondary">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </div>
          </div>

          <div className="pt-4">
            <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Sheets</CardTitle>
          <CardDescription>
            Manage your uploaded Excel sheets and their mappings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sheets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sheets configured yet</p>
              <p className="text-sm">Upload your first Excel sheet to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sheet Code</TableHead>
                  <TableHead>Sheet Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.map((sheet) => (
                  <TableRow key={sheet.id}>
                    <TableCell className="font-mono">{sheet.code}</TableCell>
                    <TableCell>{sheet.name}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                        Active
                      </span>
                    </TableCell>
                    <TableCell>{sheet.updated}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const FileSpreadsheet = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export default ExcelSheets;
