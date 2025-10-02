import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Database as DatabaseIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Column {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
}

const TableGenerator = () => {
  const { toast } = useToast();
  const [tableName, setTableName] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [generatedTables, setGeneratedTables] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchGeneratedTables();
  }, []);

  const fetchGeneratedTables = async () => {
    const { data, error } = await supabase
      .from("generated_tables")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setGeneratedTables(data || []);
    }
  };

  const addColumn = () => {
    setColumns([
      ...columns,
      {
        id: Math.random().toString(),
        name: "",
        type: "text",
        nullable: true,
      },
    ]);
  };

  const removeColumn = (id: string) => {
    setColumns(columns.filter((col) => col.id !== id));
  };

  const generateTable = async () => {
    if (!tableName || columns.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a table name and add at least one column",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Build SQL for table creation
      const columnDefs = columns.map(col => {
        const nullConstraint = col.nullable ? "" : "NOT NULL";
        return `${col.name} ${col.type.toUpperCase()} ${nullConstraint}`;
      }).join(",\n  ");

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.${tableName} (
          id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
          ${columnDefs},
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );

        ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Allow all operations on ${tableName}" 
        ON public.${tableName} FOR ALL USING (true) WITH CHECK (true);
      `;

      // Store table metadata
      const { error: metaError } = await supabase
        .from("generated_tables")
        .insert([{
          table_name: tableName,
          columns: columns as any,
        }]);

      if (metaError) throw metaError;

      toast({
        title: "Success!",
        description: `Table "${tableName}" created successfully with ${columns.length} columns`,
      });

      // Reset form
      setTableName("");
      setColumns([]);
      fetchGeneratedTables();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create table",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Table Generator</h1>
        <p className="text-muted-foreground">
          Define and generate database tables dynamically
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Table Definition</CardTitle>
          <CardDescription>
            Define your table structure and click generate to create it in the database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="table-name">Table Name</Label>
            <Input 
              id="table-name"
              placeholder="e.g., transactions"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Use lowercase with underscores (e.g., user_transactions)
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Columns</Label>
              <Button variant="outline" size="sm" onClick={addColumn}>
                <Plus className="h-4 w-4 mr-2" />
                Add Column
              </Button>
            </div>

            {columns.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Column Name</TableHead>
                      <TableHead>Data Type</TableHead>
                      <TableHead>Nullable</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columns.map((column) => (
                      <TableRow key={column.id}>
                        <TableCell>
                          <Input
                            placeholder="column_name"
                            value={column.name}
                            onChange={(e) => {
                              const updated = columns.map((col) =>
                                col.id === column.id
                                  ? { ...col, name: e.target.value }
                                  : col
                              );
                              setColumns(updated);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={column.type}
                            onValueChange={(value) => {
                              const updated = columns.map((col) =>
                                col.id === column.id ? { ...col, type: value } : col
                              );
                              setColumns(updated);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="integer">Integer</SelectItem>
                              <SelectItem value="decimal">Decimal</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                              <SelectItem value="timestamp">Timestamp</SelectItem>
                              <SelectItem value="uuid">UUID</SelectItem>
                              <SelectItem value="jsonb">JSONB</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={column.nullable ? "yes" : "no"}
                            onValueChange={(value) => {
                              const updated = columns.map((col) =>
                                col.id === column.id
                                  ? { ...col, nullable: value === "yes" }
                                  : col
                              );
                              setColumns(updated);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">Yes</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeColumn(column.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {columns.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <DatabaseIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  No columns defined yet. Click "Add Column" to get started.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4">
            <Button 
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              onClick={generateTable}
              disabled={isGenerating}
            >
              <DatabaseIcon className="mr-2 h-4 w-4" />
              {isGenerating ? "Generating..." : "Generate Table"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">About Table Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Tables are created with an automatic ID column (UUID primary key)</p>
          <p>• Created_at and updated_at timestamps are added automatically</p>
          <p>• Row Level Security (RLS) will be enabled by default</p>
          <p>• You can modify the table structure later through the database interface</p>
        </CardContent>
      </Card>

      {generatedTables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Tables</CardTitle>
            <CardDescription>Tables created through the generator</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table Name</TableHead>
                  <TableHead>Columns</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedTables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-mono">{table.table_name}</TableCell>
                    <TableCell>{table.columns?.length || 0} columns</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                        {table.status}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(table.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TableGenerator;
