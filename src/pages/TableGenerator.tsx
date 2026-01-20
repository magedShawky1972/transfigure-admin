import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Database as DatabaseIcon, CheckCircle, Edit, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTableForEdit, setSelectedTableForEdit] = useState<any>(null);
  const [editTableColumns, setEditTableColumns] = useState<Column[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTableForDelete, setSelectedTableForDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadGeneratedTables();
  }, []);

  const loadGeneratedTables = async () => {
    const { data, error } = await supabase
      .from("generated_tables")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading tables:", error);
      return;
    }

    setGeneratedTables(data || []);
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
      const { data, error } = await supabase.functions.invoke("create-table", {
        body: {
          tableName,
          columns: columns.map((col) => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
          })),
        },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Table "${tableName}" has been created successfully`,
      });

      // Reset form
      setTableName("");
      setColumns([]);
      loadGeneratedTables();
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

  const handleOpenEditDialog = (table: any) => {
    setSelectedTableForEdit(table);
    const cols = table.columns.map((col: any) => ({
      id: Math.random().toString(),
      name: col.name,
      type: col.type,
      nullable: col.nullable ?? true,
    }));
    setEditTableColumns(cols);
    setEditDialogOpen(true);
  };

  const addEditColumn = () => {
    setEditTableColumns([
      ...editTableColumns,
      {
        id: Math.random().toString(),
        name: "",
        type: "text",
        nullable: true,
      },
    ]);
  };

  const removeEditColumn = (id: string) => {
    setEditTableColumns(editTableColumns.filter((col) => col.id !== id));
  };

  const handleOpenDeleteDialog = (table: any) => {
    setSelectedTableForDelete(table);
    setDeleteDialogOpen(true);
  };

  const handleDeleteTable = async () => {
    if (!selectedTableForDelete) return;

    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke("drop-table", {
        body: {
          tableName: selectedTableForDelete.table_name,
          tableId: selectedTableForDelete.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Table "${selectedTableForDelete.table_name}" has been deleted`,
      });

      setDeleteDialogOpen(false);
      setSelectedTableForDelete(null);
      loadGeneratedTables();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete table",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveTableEdit = async () => {
    if (!selectedTableForEdit || editTableColumns.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one column",
        variant: "destructive",
      });
      return;
    }

    try {
      // First, alter the actual database table structure
      const { error: alterError } = await supabase.functions.invoke("alter-table", {
        body: {
          tableName: selectedTableForEdit.table_name,
          oldColumns: selectedTableForEdit.columns,
          newColumns: editTableColumns.map((col) => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
          })),
        },
      });

      // If the table was deleted/didn't exist, recreate it with the current column set
      if (alterError) {
        const msg = String((alterError as any).message || alterError);
        if (msg.includes('TABLE_NOT_FOUND') || msg.toLowerCase().includes('does not exist')) {
          const { error: createError } = await supabase.functions.invoke("create-table", {
            body: {
              tableName: selectedTableForEdit.table_name,
              columns: editTableColumns.map((col) => ({
                name: col.name,
                type: col.type,
                nullable: col.nullable,
              })),
            },
          });
          if (createError) throw createError;
        } else {
          throw alterError;
        }
      }

      // Then update the generated_tables metadata
      const { error: updateError } = await supabase
        .from("generated_tables")
        .update({
          columns: editTableColumns.map((col) => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
          })),
        })
        .eq("id", selectedTableForEdit.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Table structure updated successfully in database",
      });

      setEditDialogOpen(false);
      loadGeneratedTables();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update table structure",
        variant: "destructive",
      });
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

      {generatedTables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Tables</CardTitle>
            <CardDescription>
              Tables that have been created in the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table Name</TableHead>
                  <TableHead>Columns</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedTables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-mono font-medium">{table.table_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {table.columns.length} columns
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">{table.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(table.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleOpenEditDialog(table)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleOpenDeleteDialog(table)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">About Table Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Tables are created with an automatic ID column (UUID primary key)</p>
          <p>• Created_at and updated_at timestamps are added automatically</p>
          <p>• Row Level Security (RLS) will be enabled by default</p>
          <p>• You can modify the table structure later through the backend</p>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Table Configuration</DialogTitle>
            <DialogDescription>
              {selectedTableForEdit?.table_name} - Modify table column definitions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label>Columns</Label>
              <Button variant="outline" size="sm" onClick={addEditColumn}>
                <Plus className="h-4 w-4 mr-2" />
                Add Column
              </Button>
            </div>

            {editTableColumns.length > 0 && (
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
                    {editTableColumns.map((column) => (
                      <TableRow key={column.id}>
                        <TableCell>
                          <Input
                            placeholder="column_name"
                            value={column.name}
                            onChange={(e) => {
                              const updated = editTableColumns.map((col) =>
                                col.id === column.id
                                  ? { ...col, name: e.target.value }
                                  : col
                              );
                              setEditTableColumns(updated);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={column.type}
                            onValueChange={(value) => {
                              const updated = editTableColumns.map((col) =>
                                col.id === column.id ? { ...col, type: value } : col
                              );
                              setEditTableColumns(updated);
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
                              const updated = editTableColumns.map((col) =>
                                col.id === column.id
                                  ? { ...col, nullable: value === "yes" }
                                  : col
                              );
                              setEditTableColumns(updated);
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
                            onClick={() => removeEditColumn(column.id)}
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

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveTableEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Table
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the table <strong>{selectedTableForDelete?.table_name}</strong>?
              <br /><br />
              This will permanently:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Drop the database table and all its data</li>
                <li>Remove the table configuration from the system</li>
                <li>Delete all related Excel sheet mappings</li>
              </ul>
              <br />
              <strong className="text-destructive">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTable}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Table"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TableGenerator;
