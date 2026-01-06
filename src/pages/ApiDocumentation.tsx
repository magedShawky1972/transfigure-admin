import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Printer, Edit, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const API_ENDPOINTS = [
  {
    id: "salesheader",
    name: "Sales Order Header",
    endpoint: "https://edaraasus.com/api/v1/salesheader",
    method: "POST",
    description: "Create sales order headers with customer and transaction details",
    fields: [
      { name: "Order_Number", type: "Text", required: true, note: "Primary Key" },
      { name: "Customer_Phone", type: "Text", required: true, note: "Foreign Key" },
      { name: "Order_date", type: "DateTime", required: true, note: "" },
      { name: "Payment_Term", type: "Text", required: false, note: "immediate/15/30/60" },
      { name: "Sales_person", type: "Text", required: false, note: "Can be null" },
      { name: "Transaction_Type", type: "Text", required: false, note: "automatic/Manual" },
      { name: "Media", type: "Text", required: false, note: "Snap Chat/Google/Direct/LinkedIn" },
      { name: "Profit_Center", type: "Text", required: false, note: "WebApp/Salla/MobApp" },
      { name: "Company", type: "Text", required: true, note: "Asus/Purple/Ish7an" },
      { name: "Status", type: "Int", required: false, note: "" },
      { name: "Status_Description", type: "Text", required: false, note: "" },
      { name: "Customer_IP", type: "Text", required: false, note: "" },
      { name: "Device_Fingerprint", type: "Text", required: false, note: "Chrome/119 | Windows 10 or IOS" },
      { name: "Transaction_Location", type: "Text", required: false, note: "KSA, CAIRO" },
      { name: "Register_User_ID", type: "Text", required: false, note: "" },
    ],
  },
  {
    id: "salesline",
    name: "Sales Order Line",
    endpoint: "https://edaraasus.com/api/v1/salesline",
    method: "POST",
    description: "Create sales order line items with product details",
    fields: [
      { name: "Order_Number", type: "Text", required: true, note: "Primary Key" },
      { name: "Line_Number", type: "Int", required: true, note: "Primary Key" },
      { name: "Line_Status", type: "Int", required: true, note: "0 For Cancel/ 1 Confirm" },
      { name: "Product_SKU", type: "Text", required: false, note: "" },
      { name: "Product_Id", type: "BigInt", required: false, note: "" },
      { name: "Quantity", type: "Decimal", required: false, note: "" },
      { name: "Unit_price", type: "Decimal", required: false, note: "" },
      { name: "Total", type: "Decimal", required: false, note: "" },
      { name: "Coins_Number", type: "Decimal", required: false, note: "" },
      { name: "Cost_Price", type: "Decimal", required: false, note: "" },
      { name: "Total_Cost", type: "Decimal", required: false, note: "" },
      { name: "Point", type: "Decimal", required: false, note: "" },
    ],
  },
  {
    id: "payment",
    name: "Payment",
    endpoint: "https://edaraasus.com/api/v1/payment",
    method: "POST",
    description: "Record payment transactions with payment method details",
    fields: [
      { name: "Order_number", type: "Text", required: true, note: "Primary Key" },
      { name: "Payment_method", type: "Text", required: true, note: "hyperpay/ecom_payment/salla" },
      { name: "Payment_brand", type: "Text", required: true, note: "APPLEPAY-MADA/MASTER/VISA/KNET/MADA/MASTER/STC_PAY/URPAY/VISA" },
      { name: "Payment_Amount", type: "Decimal", required: false, note: "" },
      { name: "Payment_reference", type: "Text", required: false, note: "" },
      { name: "Payment_Card_Number", type: "Text", required: false, note: "Last 4 digits" },
      { name: "Bank_Transaction_Id", type: "Text", required: false, note: "" },
      { name: "Redemption_IP", type: "Text", required: false, note: "" },
      { name: "Payment_Location", type: "Text", required: false, note: "" },
    ],
  },
  {
    id: "customer",
    name: "Customers",
    endpoint: "https://edaraasus.com/api/v1/customer",
    method: "POST",
    description: "Manage customer master data including contact and status information",
    fields: [
      { name: "Customer_Phone", type: "Text", required: true, note: "Primary Key" },
      { name: "Customer_name", type: "Text", required: true, note: "" },
      { name: "Customer_email", type: "Text", required: false, note: "" },
      { name: "Customer_group", type: "Text", required: false, note: "Can be null" },
      { name: "Status", type: "Bit", required: false, note: "Active/Suspended" },
      { name: "Is_blocked", type: "Bit", required: false, note: "0/1" },
      { name: "Block_reason", type: "Text", required: false, note: "" },
      { name: "Register_date", type: "DateTime", required: false, note: "" },
      { name: "Last_transaction", type: "DateTime", required: false, note: "" },
    ],
  },
  {
    id: "supplier",
    name: "Suppliers",
    endpoint: "https://edaraasus.com/api/v1/supplier",
    method: "POST",
    description: "Manage supplier master data including contact information",
    fields: [
      { name: "Supplier_code", type: "Text", required: true, note: "Primary Key" },
      { name: "Supplier_name", type: "Text", required: true, note: "" },
      { name: "Supplier_email", type: "Text", required: false, note: "" },
      { name: "Supplier_phone", type: "Text", required: false, note: "" },
      { name: "Status", type: "Bit", required: false, note: "Active/Suspended" },
    ],
  },
  {
    id: "supplierproduct",
    name: "Supplier Products",
    endpoint: "https://edaraasus.com/api/v1/supplierproduct",
    method: "POST",
    description: "Manage supplier product pricing with date ranges",
    fields: [
      { name: "Supplier_code", type: "Text", required: true, note: "Primary Key" },
      { name: "SKU", type: "Text", required: true, note: "Foreign Key" },
      { name: "Date_From", type: "Date", required: false, note: "" },
      { name: "Date_To", type: "Date", required: false, note: "" },
      { name: "Price", type: "Decimal", required: false, note: "" },
    ],
  },
  {
    id: "brand",
    name: "Brand (Product Category)",
    endpoint: "https://edaraasus.com/api/v1/brand",
    method: "POST",
    description: "Manage product brand and category information",
    fields: [
      { name: "Brand_Code", type: "Text", required: true, note: "Primary Key" },
      { name: "Brand_Name", type: "Text", required: true, note: "" },
      { name: "Brand_Parent", type: "Text", required: false, note: "" },
      { name: "Status", type: "Bit", required: false, note: "Active/Suspended" },
    ],
  },
  {
    id: "product",
    name: "Product",
    endpoint: "https://edaraasus.com/api/v1/product",
    method: "POST",
    description: "Manage product master data including inventory and pricing",
    fields: [
      { name: "Product_id", type: "BigInt", required: true, note: "Primary Key" },
      { name: "SKU", type: "Text", required: true, note: "Primary Key" },
      { name: "Name", type: "Text", required: true, note: "" },
      { name: "UOM", type: "Text", required: false, note: "" },
      { name: "Brand_Code", type: "Text", required: false, note: "Foreign Key" },
      { name: "Reorder_Point", type: "Decimal", required: false, note: "" },
      { name: "Minimum_order", type: "Decimal", required: false, note: "" },
      { name: "Maximum_order", type: "Decimal", required: false, note: "" },
      { name: "Cost_price", type: "Decimal", required: false, note: "" },
      { name: "Sales_Price", type: "Decimal", required: false, note: "" },
      { name: "AR_Meta_Title", type: "Text", required: false, note: "" },
      { name: "AR_Meta_Keywords", type: "Text", required: false, note: "" },
      { name: "AR_Meta_Description", type: "Text", required: false, note: "" },
      { name: "ENG_Meta_Title", type: "Text", required: false, note: "" },
      { name: "ENG_Meta_Keywords", type: "Text", required: false, note: "" },
      { name: "ENG_Meta_Description", type: "Text", required: false, note: "" },
    ],
  },
  {
    id: "zkattendance",
    name: "ZK Attendance",
    endpoint: "https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1/api-zk-attendance",
    method: "POST",
    description: "Receive attendance data from ZK time attendance machines. Requires x-api-key header with ZK Attendance permission enabled.",
    fields: [
      { name: "records", type: "Array", required: true, note: "Array of attendance records" },
      { name: "records[].employee_code", type: "Text", required: true, note: "Employee code from ZK machine" },
      { name: "records[].date", type: "Text", required: true, note: "Date in YYYY-MM-DD format" },
      { name: "records[].time", type: "Text", required: true, note: "Time in HH:MM or HH:MM:SS format" },
      { name: "records[].record_type", type: "Text", required: false, note: "entry/exit/unknown" },
    ],
  },
];

interface ApiFieldConfig {
  id: string;
  api_endpoint: string;
  field_name: string;
  field_type: string;
  is_required: boolean;
  field_note: string | null;
  field_order: number;
}

const ApiDocumentation = () => {
  const [selectedApis, setSelectedApis] = useState<string[]>(API_ENDPOINTS.map(api => api.id));
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [apiConfigs, setApiConfigs] = useState<ApiFieldConfig[]>([]);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    const fetchApiConfigs = async () => {
      const { data, error } = await supabase
        .from('api_field_configs')
        .select('*')
        .order('api_endpoint')
        .order('field_order');

      if (error) {
        console.error('Error fetching API configs:', error);
        toast({
          title: "Error",
          description: "Failed to load API configurations",
          variant: "destructive",
        });
        return;
      }

      setApiConfigs(data || []);
    };

    fetchApiConfigs();
  }, [toast]);

  const handleApiToggle = (apiId: string) => {
    setSelectedApis(prev =>
      prev.includes(apiId) ? prev.filter(id => id !== apiId) : [...prev, apiId]
    );
  };

  const handleRequiredToggle = (configId: string, currentValue: boolean) => {
    setEditedConfigs(prev => ({
      ...prev,
      [configId]: !currentValue
    }));
  };

  const handleSaveConfigs = async () => {
    try {
      const updates = Object.entries(editedConfigs).map(([id, isRequired]) => ({
        id,
        is_required: isRequired
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('api_field_configs')
          .update({ is_required: update.is_required })
          .eq('id', update.id);

        if (error) throw error;
      }

      // Refresh the configs
      const { data, error } = await supabase
        .from('api_field_configs')
        .select('*')
        .order('api_endpoint')
        .order('field_order');

      if (error) throw error;

      setApiConfigs(data || []);
      setEditedConfigs({});
      setIsEditMode(false);

      toast({
        title: "Success",
        description: "API configurations updated successfully",
      });
    } catch (error) {
      console.error('Error saving configs:', error);
      toast({
        title: "Error",
        description: "Failed to save API configurations",
        variant: "destructive",
      });
    }
  };

  const handlePrintClick = () => {
    setShowApiKeyDialog(true);
  };

  const handlePrint = () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter an API key before printing",
        variant: "destructive",
      });
      return;
    }

    setShowApiKeyDialog(false);
    
    // Small delay to allow dialog to close before printing
    setTimeout(() => {
      window.print();
      setApiKey("");
    }, 100);
  };

  const getApiFields = (endpoint: string) => {
    // Extract the API name from the full URL (e.g., "salesheader" from "https://edaraasus.com/api/v1/salesheader")
    const apiName = endpoint.split('/').pop() || '';
    // Match against database records which have format "/api/salesheader"
    return apiConfigs.filter(config => config.api_endpoint === `/api/${apiName}`);
  };

  const filteredApis = API_ENDPOINTS.filter(api => selectedApis.includes(api.id)).map(api => ({
    ...api,
    fields: getApiFields(api.endpoint).map(config => ({
      name: config.field_name,
      type: config.field_type,
      required: editedConfigs[config.id] !== undefined ? editedConfigs[config.id] : config.is_required,
      note: config.field_note || '',
      configId: config.id
    }))
  }));

  return (
    <div className="print:space-y-0">
      <div className="flex items-center justify-between print:hidden mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
          <p className="text-muted-foreground">
            Complete API reference for E-Commerce integration
          </p>
        </div>
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <Button onClick={() => {
                setIsEditMode(false);
                setEditedConfigs({});
              }} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleSaveConfigs} className="gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setIsEditMode(true)} variant="outline" className="gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </Button>
              <Button onClick={handlePrintClick} className="gap-2">
                <Printer className="h-4 w-4" />
                Print Documentation
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cover Page - Only visible when printing */}
      <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:h-screen print:page-break-after">
        <h1 className="text-5xl font-bold text-gray-900 mb-8 text-center">
          API Integration for Odoo
        </h1>
        <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">
          Asus Cards
        </h2>
        <p className="text-xl text-gray-700">
          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}
        </p>
      </div>

      {/* Table of Contents - Only visible when printing */}
      <div className="hidden print:block print:h-screen print:page-break-after print:pt-20">
        <h2 className="text-4xl font-bold text-gray-900 mb-12 text-center">Table of Contents</h2>
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="flex items-center justify-between border-b border-gray-300 pb-2">
            <span className="text-lg text-gray-900 font-medium">Authentication</span>
            <span className="text-gray-600">1</span>
          </div>
          {filteredApis.map((api, index) => (
            <div key={api.id} className="flex items-center justify-between border-b border-gray-300 pb-2">
              <span className="text-lg text-gray-900 font-medium">{api.name}</span>
              <span className="text-gray-600">{index + 2}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-b border-gray-300 pb-2">
            <span className="text-lg text-gray-900 font-medium">Error Handling</span>
            <span className="text-gray-600">{filteredApis.length + 2}</span>
          </div>
        </div>
      </div>

      {/* API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter API Key</DialogTitle>
            <DialogDescription>
              Please enter your API key to print the documentation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="text"
                placeholder="Enter your API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePrint();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="print:hidden print:border-0">
        <CardHeader>
          <CardTitle>Filter APIs</CardTitle>
          <CardDescription>Select APIs to include in documentation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {API_ENDPOINTS.map(api => (
              <div key={api.id} className="flex items-center space-x-2">
                <Checkbox
                  id={api.id}
                  checked={selectedApis.includes(api.id)}
                  onCheckedChange={() => handleApiToggle(api.id)}
                />
                <Label htmlFor={api.id} className="cursor-pointer">
                  {api.name}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Authentication Section */}
      <Card className="print:shadow-none print:border-0 print:page-break-after">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-foreground">Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium mb-2 text-gray-900 dark:text-foreground">Header Authentication</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm text-gray-900 dark:text-foreground">
              <p>Authorization: &lt;{apiKey || 'API_KEY'}&gt;</p>
              <p>Content-Type: application/json</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 dark:text-foreground/80">
            All API requests must include your API key in the Authorization header.
            Contact your administrator to obtain an API key.
          </p>
        </CardContent>
      </Card>

      {/* API Endpoints */}
      {filteredApis.map((api, index) => (
        <Card key={api.id} className="break-inside-avoid print:shadow-none print:border-0 print:page-break-after">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 dark:text-foreground">{api.name}</CardTitle>
              <span className="text-xs font-mono bg-primary/10 px-2 py-1 rounded text-gray-900 dark:text-foreground">
                {api.method}
              </span>
            </div>
            <CardDescription className="text-gray-700 dark:text-foreground/80">{api.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2 text-gray-900 dark:text-foreground">Endpoint</p>
              <div className="bg-muted p-3 rounded-lg font-mono text-sm text-gray-900 dark:text-foreground">
                {api.endpoint}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2 text-gray-900 dark:text-foreground">Request Fields</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 text-gray-900 dark:text-foreground w-1/4">Field Name</th>
                      <th className="text-left p-2 text-gray-900 dark:text-foreground w-1/6">Type</th>
                      <th className="text-left p-2 text-gray-900 dark:text-foreground w-1/6">Required</th>
                      <th className="text-left p-2 text-gray-900 dark:text-foreground w-5/12">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {api.fields.map((field: any, idx: number) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 font-mono text-xs text-gray-900 dark:text-foreground">{field.name}</td>
                        <td className="p-2 text-gray-900 dark:text-foreground">{field.type}</td>
                        <td className="p-2">
                          {isEditMode ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={field.required}
                                onCheckedChange={() => handleRequiredToggle(field.configId, field.required)}
                              />
                              <span className="text-xs text-gray-600 dark:text-foreground/70">
                                {field.required ? 'Yes' : 'No'}
                              </span>
                            </div>
                          ) : (
                            field.required ? (
                              <span className="text-red-600 dark:text-destructive font-medium">Yes</span>
                            ) : (
                              <span className="text-gray-600 dark:text-foreground/70">No</span>
                            )
                          )}
                        </td>
                        <td className="p-2 text-gray-600 dark:text-foreground/70 break-words max-w-xs">{field.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2 text-gray-900 dark:text-foreground">Example Request</p>
              <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto text-gray-900 dark:text-foreground">
                <pre>{`POST ${api.endpoint}
Authorization: <${apiKey || 'your_api_key_here'}>
Content-Type: application/json

{
  ${api.fields
    .filter((field: any) => field.required)
    .map((field: any) => {
      let value;
      if (field.type === 'Text') value = '"value"';
      else if (field.type === 'Int' || field.type === 'BigInt') value = '123';
      else if (field.type === 'Decimal') value = '99.99';
      else if (field.type === 'Bit') value = 'true';
      else if (field.type === 'Datetime') value = '"2024-01-01 12:00:00"';
      else value = '"2024-01-01"';
      return `"${field.name}": ${value}`;
    })
    .join(',\n  ')}
}`}</pre>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2 text-gray-900 dark:text-foreground">Example Response</p>
              <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto text-gray-900 dark:text-foreground">
                <pre>{`{
  "success": true,
  "data": {
    "id": "uuid-here",
    "created_at": "2024-01-01T00:00:00Z"
  }
}`}</pre>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Error Handling */}
      <Card className="break-inside-avoid print:shadow-none print:border-0">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-foreground">Error Handling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium mb-2 text-gray-900 dark:text-foreground">Common Error Codes</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="font-mono bg-destructive/10 text-red-600 dark:text-destructive px-2 py-1 rounded font-medium">401</span>
                <span className="text-gray-900 dark:text-foreground">Missing or invalid API key</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono bg-destructive/10 text-red-600 dark:text-destructive px-2 py-1 rounded font-medium">403</span>
                <span className="text-gray-900 dark:text-foreground">Permission denied for this endpoint</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono bg-destructive/10 text-red-600 dark:text-destructive px-2 py-1 rounded font-medium">400</span>
                <span className="text-gray-900 dark:text-foreground">Invalid request data or validation error</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono bg-destructive/10 text-red-600 dark:text-destructive px-2 py-1 rounded font-medium">500</span>
                <span className="text-gray-900 dark:text-foreground">Internal server error</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <style>{`
        @media print {
          @page {
            margin: 20mm 15mm 20mm 15mm;
            @bottom-center {
              content: counter(page);
            }
          }
          body * {
            visibility: hidden;
          }
          .print\\:space-y-0, .print\\:space-y-0 * {
            visibility: visible;
          }
          .print\\:space-y-0 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:page-break-after {
            page-break-after: always;
          }
          .print\\:h-screen {
            height: 100vh !important;
          }
          /* Force dark text colors for printing */
          * {
            color: #000 !important;
          }
          .bg-muted {
            background-color: #f5f5f5 !important;
          }
          pre, code {
            color: #000 !important;
          }
          /* Remove card styling for print */
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-0 {
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ApiDocumentation;
