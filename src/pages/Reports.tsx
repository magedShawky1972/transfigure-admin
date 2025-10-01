import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Play, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Reports = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);

  const runReport = () => {
    toast({
      title: "Running Report",
      description: "Executing SQL query...",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Reports</h1>
          <p className="text-muted-foreground">
            Create and run custom SQL-based reports
          </p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Builder</CardTitle>
          <CardDescription>
            Write SQL queries to generate custom reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-name">Report Name</Label>
            <Input 
              id="report-name"
              placeholder="e.g., Monthly Transaction Summary"
              className="max-w-md"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-description">Description</Label>
            <Input 
              id="report-description"
              placeholder="Brief description of what this report shows"
              className="max-w-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sql-query">SQL Query</Label>
            <Textarea 
              id="sql-query"
              placeholder={`SELECT 
  date_trunc('month', created_at) as month,
  COUNT(*) as total_transactions,
  SUM(amount) as total_amount
FROM transactions
WHERE created_at >= NOW() - INTERVAL '6 months'
GROUP BY month
ORDER BY month DESC;`}
              className="font-mono text-sm min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Write a SELECT query to fetch data from your tables
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={runReport}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Run Query
            </Button>
            <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 gap-2">
              <Save className="h-4 w-4" />
              Save Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Query Results</CardTitle>
          <CardDescription>
            Results will appear here after running your query
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p>No query results yet</p>
            <p className="text-sm">Run a query to see the results</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Reports</CardTitle>
          <CardDescription>
            Your previously saved reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No saved reports yet</p>
              <p className="text-sm">Create your first report to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell>{report.description}</TableCell>
                    <TableCell>{report.lastRun}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Play className="h-4 w-4" />
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

export default Reports;
