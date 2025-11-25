import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Key, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

interface ApiKey {
  id: string;
  api_key: string;
  description: string;
  is_active: boolean;
  allow_sales_header: boolean;
  allow_sales_line: boolean;
  allow_payment: boolean;
  allow_customer: boolean;
  allow_supplier: boolean;
  allow_supplier_product: boolean;
  allow_brand: boolean;
  allow_product: boolean;
  created_at: string;
}

const ApiConfig = () => {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState({
    allow_sales_header: false,
    allow_sales_line: false,
    allow_payment: false,
    allow_customer: false,
    allow_supplier: false,
    allow_supplier_product: false,
    allow_brand: false,
    allow_product: false,
  });

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load API keys",
        variant: "destructive",
      });
      return;
    }

    setApiKeys(data || []);
  };

  const generateApiKey = () => {
    return `ek_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  };

  const handleCreateApiKey = async () => {
    if (!description.trim()) {
      toast({
        title: "Error",
        description: "Please enter a description for the API key",
        variant: "destructive",
      });
      return;
    }

    const newApiKey = generateApiKey();

    const { error } = await supabase.from("api_keys").insert({
      api_key: newApiKey,
      description: description.trim(),
      ...permissions,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "API key created successfully",
    });

    setDescription("");
    setPermissions({
      allow_sales_header: false,
      allow_sales_line: false,
      allow_payment: false,
      allow_customer: false,
      allow_supplier: false,
      allow_supplier_product: false,
      allow_brand: false,
      allow_product: false,
    });
    loadApiKeys();
  };

  const handleDeleteApiKey = async (id: string) => {
    const { error } = await supabase.from("api_keys").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "API key deleted successfully",
    });

    loadApiKeys();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">API Key Management</h1>
          <p className="text-muted-foreground">
            Generate and manage API keys for E-Commerce integration
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate New API Key</CardTitle>
          <CardDescription>
            Create an API key with specific endpoint permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="e.g., Salla E-Commerce Integration"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="space-y-2">
            <Label>API Endpoint Permissions</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sales_header"
                  checked={permissions.allow_sales_header}
                  onCheckedChange={(checked) =>
                    setPermissions({ ...permissions, allow_sales_header: checked as boolean })
                  }
                />
                <Label htmlFor="sales_header" className="cursor-pointer text-sm">
                  Sales Header
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sales_line"
                  checked={permissions.allow_sales_line}
                  onCheckedChange={(checked) =>
                    setPermissions({ ...permissions, allow_sales_line: checked as boolean })
                  }
                />
                <Label htmlFor="sales_line" className="cursor-pointer text-sm">
                  Sales Line
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="payment"
                  checked={permissions.allow_payment}
                  onCheckedChange={(checked) =>
                    setPermissions({ ...permissions, allow_payment: checked as boolean })
                  }
                />
                <Label htmlFor="payment" className="cursor-pointer text-sm">
                  Payment
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customer"
                  checked={permissions.allow_customer}
                  onCheckedChange={(checked) =>
                    setPermissions({ ...permissions, allow_customer: checked as boolean })
                  }
                />
                <Label htmlFor="customer" className="cursor-pointer text-sm">
                  Customer
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="supplier"
                  checked={permissions.allow_supplier}
                  onCheckedChange={(checked) =>
                    setPermissions({ ...permissions, allow_supplier: checked as boolean })
                  }
                />
                <Label htmlFor="supplier" className="cursor-pointer text-sm">
                  Supplier
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="supplier_product"
                  checked={permissions.allow_supplier_product}
                  onCheckedChange={(checked) =>
                    setPermissions({ ...permissions, allow_supplier_product: checked as boolean })
                  }
                />
                <Label htmlFor="supplier_product" className="cursor-pointer text-sm">
                  Supplier Product
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="brand"
                  checked={permissions.allow_brand}
                  onCheckedChange={(checked) =>
                    setPermissions({ ...permissions, allow_brand: checked as boolean })
                  }
                />
                <Label htmlFor="brand" className="cursor-pointer text-sm">
                  Brand
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="product"
                  checked={permissions.allow_product}
                  onCheckedChange={(checked) =>
                    setPermissions({ ...permissions, allow_product: checked as boolean })
                  }
                />
                <Label htmlFor="product" className="cursor-pointer text-sm">
                  Product
                </Label>
              </div>
            </div>
          </div>

          <Button onClick={handleCreateApiKey} className="gap-2">
            <Key className="h-4 w-4" />
            Generate API Key
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated API Keys</CardTitle>
          <CardDescription>
            Manage your API keys and their permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys generated yet</p>
              <p className="text-sm">Create your first API key to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div key={key.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{key.description}</h3>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            key.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {key.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {key.api_key}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(key.api_key)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteApiKey(key.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {key.allow_sales_header && (
                      <span className="bg-primary/10 px-2 py-1 rounded">Sales Header</span>
                    )}
                    {key.allow_sales_line && (
                      <span className="bg-primary/10 px-2 py-1 rounded">Sales Line</span>
                    )}
                    {key.allow_payment && (
                      <span className="bg-primary/10 px-2 py-1 rounded">Payment</span>
                    )}
                    {key.allow_customer && (
                      <span className="bg-primary/10 px-2 py-1 rounded">Customer</span>
                    )}
                    {key.allow_supplier && (
                      <span className="bg-primary/10 px-2 py-1 rounded">Supplier</span>
                    )}
                    {key.allow_supplier_product && (
                      <span className="bg-primary/10 px-2 py-1 rounded">Supplier Product</span>
                    )}
                    {key.allow_brand && (
                      <span className="bg-primary/10 px-2 py-1 rounded">Brand</span>
                    )}
                    {key.allow_product && (
                      <span className="bg-primary/10 px-2 py-1 rounded">Product</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(key.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiConfig;
