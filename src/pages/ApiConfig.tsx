import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Play, Settings, Trash2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ApiConfig = () => {
  const { toast } = useToast();
  const [apis, setApis] = useState<any[]>([]);

  const testConnection = () => {
    toast({
      title: "Testing Connection",
      description: "Sending test request to API endpoint...",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">API Configuration</h1>
          <p className="text-muted-foreground">
            Configure external API endpoints and map data to your database
          </p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" />
          Add New API
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Endpoint Configuration</CardTitle>
          <CardDescription>
            Define your API connection details and authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-name">API Name</Label>
            <Input 
              id="api-name" 
              placeholder="e.g., Transaction API" 
              className="max-w-md"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-url">Endpoint URL</Label>
            <Input 
              id="api-url" 
              placeholder="https://api.example.com/transactions" 
              className="max-w-2xl"
            />
          </div>

          <Tabs defaultValue="headers" className="w-full">
            <TabsList>
              <TabsTrigger value="headers">Headers</TabsTrigger>
              <TabsTrigger value="body">Request Body</TabsTrigger>
              <TabsTrigger value="response">Response Mapping</TabsTrigger>
            </TabsList>
            
            <TabsContent value="headers" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="headers">Headers (JSON)</Label>
                <Textarea 
                  id="headers"
                  placeholder={`{\n  "Authorization": "Bearer YOUR_TOKEN",\n  "Content-Type": "application/json"\n}`}
                  className="font-mono text-sm"
                  rows={6}
                />
              </div>
            </TabsContent>

            <TabsContent value="body" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="body">Request Body (JSON)</Label>
                <Textarea 
                  id="body"
                  placeholder={`{\n  "startDate": "2024-01-01",\n  "endDate": "2024-12-31"\n}`}
                  className="font-mono text-sm"
                  rows={6}
                />
              </div>
            </TabsContent>

            <TabsContent value="response" className="space-y-4">
              <div className="space-y-2">
                <Label>Response Field Mapping</Label>
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">API Field</Label>
                      <Input placeholder="response.data.id" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Database Column</Label>
                      <Input placeholder="transaction_id" className="mt-1" />
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Plus className="h-3 w-3 mr-2" />
                    Add Field Mapping
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={testConnection}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Test Connection
            </Button>
            <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured APIs</CardTitle>
          <CardDescription>
            Manage your API endpoints and their data mappings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apis.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Cloud className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No APIs configured yet</p>
              <p className="text-sm">Add your first API endpoint to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>API Name</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apis.map((api) => (
                  <TableRow key={api.id}>
                    <TableCell className="font-medium">{api.name}</TableCell>
                    <TableCell className="font-mono text-xs">{api.endpoint}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Connected</span>
                      </div>
                    </TableCell>
                    <TableCell>{api.synced}</TableCell>
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

const Cloud = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </svg>
);

export default ApiConfig;
