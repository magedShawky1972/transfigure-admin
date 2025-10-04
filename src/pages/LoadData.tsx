import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const LoadData = () => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select an Excel file to upload",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Uploading file",
      description: `Processing ${selectedFile.name}...`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Load Data From Excel</h1>
        <p className="text-muted-foreground">
          Upload daily sales data to the system
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Excel File</CardTitle>
          <CardDescription>
            Select an Excel file with your daily sales data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border-2 border-dashed rounded-lg p-12 text-center space-y-4">
            <div className="flex justify-center">
              <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
            </div>
            <div>
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">Excel files (.xlsx, .xls)</p>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </Label>
            </div>
            {selectedFile && (
              <p className="text-sm text-primary font-medium">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <Button 
            onClick={handleUpload}
            disabled={!selectedFile}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload and Process
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoadData;
