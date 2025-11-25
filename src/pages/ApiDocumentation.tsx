import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";

const API_ENDPOINTS = [
  {
    id: "salesheader",
    name: "Sales Order Header",
    endpoint: "/api/salesheader",
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
      { name: "Company", type: "Text", required: false, note: "Asus/Purple/Ish7an" },
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
    endpoint: "/api/salesline",
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
    endpoint: "/api/payment",
    method: "POST",
    description: "Record payment transactions with payment method details",
    fields: [
      { name: "Order_number", type: "Text", required: true, note: "Primary Key" },
      { name: "Payment_method", type: "Text", required: false, note: "hyperpay/ecom_payment/salla" },
      { name: "Payment_brand", type: "Text", required: false, note: "APPLEPAY-MADA/MASTER/VISA/KNET/MADA/MASTER/STC_PAY/URPAY/VISA" },
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
    endpoint: "/api/customer",
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
    endpoint: "/api/supplier",
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
    endpoint: "/api/supplierproduct",
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
    endpoint: "/api/brand",
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
    endpoint: "/api/product",
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
];

const ApiDocumentation = () => {
  const [selectedApis, setSelectedApis] = useState<string[]>(API_ENDPOINTS.map(api => api.id));

  const handleApiToggle = (apiId: string) => {
    setSelectedApis(prev =>
      prev.includes(apiId) ? prev.filter(id => id !== apiId) : [...prev, apiId]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredApis = API_ENDPOINTS.filter(api => selectedApis.includes(api.id));

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
          <p className="text-muted-foreground">
            Complete API reference for E-Commerce integration
          </p>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Documentation
        </Button>
      </div>

      <Card className="print:hidden">
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
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium mb-2">Header Authentication</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm">
              <p>Authorization: &lt;API_KEY&gt;</p>
              <p>Content-Type: application/json</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            All API requests must include your API key in the Authorization header.
            Contact your administrator to obtain an API key.
          </p>
        </CardContent>
      </Card>

      {/* API Endpoints */}
      {filteredApis.map((api, index) => (
        <Card key={api.id} className="break-inside-avoid">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{api.name}</CardTitle>
              <span className="text-xs font-mono bg-primary/10 px-2 py-1 rounded">
                {api.method}
              </span>
            </div>
            <CardDescription>{api.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Endpoint</p>
              <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                {api.endpoint}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Request Fields</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Field Name</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Required</th>
                      <th className="text-left p-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {api.fields.map((field, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 font-mono text-xs">{field.name}</td>
                        <td className="p-2">{field.type}</td>
                        <td className="p-2">
                          {field.required ? (
                            <span className="text-destructive">Yes</span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="p-2 text-muted-foreground">{field.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Example Request</p>
              <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">
                <pre>{`POST ${api.endpoint}
Authorization: your_api_key_here
Content-Type: application/json

{
  ${api.fields
    .slice(0, 3)
    .map(field => `"${field.name}": ${field.type === 'Text' ? '"value"' : field.type === 'Int' || field.type === 'BigInt' ? '123' : field.type === 'Decimal' ? '99.99' : field.type === 'Bit' ? 'true' : '"2024-01-01"'}`)
    .join(',\n  ')}
}`}</pre>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Example Response</p>
              <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">
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
      <Card className="break-inside-avoid">
        <CardHeader>
          <CardTitle>Error Handling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium mb-2">Common Error Codes</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="font-mono bg-destructive/10 text-destructive px-2 py-1 rounded">401</span>
                <span>Missing or invalid API key</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono bg-destructive/10 text-destructive px-2 py-1 rounded">403</span>
                <span>Permission denied for this endpoint</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono bg-destructive/10 text-destructive px-2 py-1 rounded">400</span>
                <span>Invalid request data or validation error</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono bg-destructive/10 text-destructive px-2 py-1 rounded">500</span>
                <span>Internal server error</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .space-y-6, .space-y-6 * {
            visibility: visible;
          }
          .space-y-6 {
            position: absolute;
            left: 0;
            top: 0;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ApiDocumentation;
