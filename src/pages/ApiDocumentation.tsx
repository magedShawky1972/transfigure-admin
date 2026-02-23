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

const SUPABASE_FUNCTIONS_URL = 'https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1';

const API_ENDPOINTS = [
  {
    id: "salesheader",
    name: "Sales Order Header",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-salesheader`,
    method: "POST",
    description: "Create or update sales order headers with customer and transaction details. Uses upsert logic - if Order_Number exists, data will be updated; otherwise, a new record is created. Data is saved to testsalesheader table.",
    upsertKey: "Order_Number",
    fields: [
      { name: "Order_Number", type: "Text", required: true, note: "Primary Key (Upsert Key)" },
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
      { name: "Player_Id", type: "Text", required: false, note: "Player identifier" },
     { name: "Point_Value", type: "Decimal", required: false, note: "Point value for the order" },
      { name: "Point", type: "Bit", required: false, note: "Point flag (0 = No, 1 = Yes)" },
    ],
  },
  {
    id: "salesline",
    name: "Sales Order Line",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-salesline`,
    method: "POST",
    description: "Create or update sales order line items with product details. Uses upsert logic - if Order_Number + Line_Number combination exists, data will be updated; otherwise, a new record is created. Data is saved to testsalesline table.",
    upsertKey: "Order_Number + Line_Number",
    fields: [
      { name: "Order_Number", type: "Text", required: true, note: "Primary Key (Upsert Key)" },
      { name: "Line_Number", type: "Int", required: true, note: "Primary Key (Upsert Key)" },
      { name: "Line_Status", type: "Int", required: true, note: "0 For Cancel/ 1 Confirm" },
      { name: "Product_SKU", type: "Text", required: false, note: "" },
      { name: "Product_Id", type: "BigInt", required: false, note: "" },
      { name: "Quantity", type: "Decimal", required: false, note: "" },
      { name: "Unit_price", type: "Decimal", required: false, note: "" },
      { name: "Total", type: "Decimal", required: false, note: "" },
      { name: "Coins_Number", type: "Decimal", required: false, note: "" },
      { name: "Cost_Price", type: "Decimal", required: false, note: "" },
      { name: "Total_Cost", type: "Decimal", required: false, note: "" },
      { name: "Player_Id", type: "Text", required: false, note: "Player identifier" },
    ],
  },
  {
    id: "payment",
    name: "Payment",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-payment`,
    method: "POST",
    description: "Record payment transactions with payment method details. Insert only - each call creates a new payment record. Data is saved to testpayment table.",
    upsertKey: null,
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
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-customer`,
    method: "POST",
    description: "Create or update customer master data including contact and status information. Uses upsert logic - if Customer_Phone exists, data will be updated; otherwise, a new record is created. Data is saved to testcustomers table.",
    upsertKey: "Customer_Phone",
    fields: [
      { name: "Customer_Phone", type: "Text", required: true, note: "Primary Key (Upsert Key)" },
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
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-supplier`,
    method: "POST",
    description: "Create or update supplier master data including contact information. Uses upsert logic - if Supplier_code exists, data will be updated; otherwise, a new record is created. Data is saved to testsuppliers table.",
    upsertKey: "Supplier_code",
    fields: [
      { name: "Supplier_code", type: "Text", required: true, note: "Primary Key (Upsert Key)" },
      { name: "Supplier_name", type: "Text", required: true, note: "" },
      { name: "Supplier_email", type: "Text", required: false, note: "" },
      { name: "Supplier_phone", type: "Text", required: false, note: "" },
      { name: "Status", type: "Int", required: false, note: "1=Active/0=Suspended" },
    ],
  },
  {
    id: "supplierproduct",
    name: "Supplier Products",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-supplierproduct`,
    method: "POST",
    description: "Create or update supplier product pricing with date ranges. Uses upsert logic - if Supplier_code + SKU + Date_From combination exists, data will be updated; otherwise, a new record is created. Data is saved to testsupplierproducts table.",
    upsertKey: "Supplier_code + SKU + Date_From",
    fields: [
      { name: "Supplier_code", type: "Text", required: true, note: "Primary Key (Upsert Key)" },
      { name: "SKU", type: "Text", required: true, note: "Foreign Key (Upsert Key)" },
      { name: "Date_From", type: "Date", required: false, note: "Upsert Key" },
      { name: "Date_To", type: "Date", required: false, note: "" },
      { name: "Price", type: "Decimal", required: false, note: "" },
    ],
  },
  {
    id: "brand",
    name: "Brand (Product Category)",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-brand`,
    method: "POST",
    description: "Create or update product brand and category information. Uses upsert logic - if Brand_Code exists, data will be updated; otherwise, a new record is created. Data is saved to testbrands table.",
    upsertKey: "Brand_Code",
    fields: [
      { name: "Brand_Code", type: "Text", required: true, note: "Primary Key (Upsert Key)" },
      { name: "Brand_Name", type: "Text", required: true, note: "" },
      { name: "Brand_Parent", type: "Text", required: false, note: "" },
      { name: "Status", type: "Bit", required: false, note: "Active/Suspended" },
    ],
  },
  {
    id: "product",
    name: "Product",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-product`,
    method: "POST",
    description: "Create or update product master data including inventory and pricing. Uses upsert logic - if SKU exists, data will be updated; otherwise, a new record is created. Data is saved to testproducts table.",
    upsertKey: "SKU",
    fields: [
      { name: "Product_id", type: "BigInt", required: true, note: "Primary Key" },
      { name: "SKU", type: "Text", required: true, note: "Primary Key (Upsert Key)" },
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
    name: "ZK Attendance (POST)",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-zk-attendance`,
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
  {
    id: "zkattendance-get",
    name: "ZK Attendance (GET)",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-zk-attendance`,
    method: "GET",
    description: "Get the latest attendance record date and time. Use this to determine what data to send next (send records newer than the returned date/time). Requires x-api-key header with ZK Attendance permission enabled.",
    fields: [
      { name: "x-api-key", type: "Header", required: true, note: "API Key with ZK Attendance permission" },
    ],
  },
  {
    id: "salla-transaction",
    name: "Salla Transaction",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-salla-transaction`,
    method: "POST",
    description: "Create or update Salla e-commerce transactions. Supports Header + Lines structure: header fields are shared across all lines, and each line represents a product. Uses upsert logic on Order_Number (suffixed with -1, -2 etc. for multi-line). Data is saved to purpletransaction_temp table.",
    upsertKey: "Order_Number",
    fields: [
      // Header fields
      { name: "Order_Number", type: "Text", required: true, note: "Primary Key (Upsert Key) - Header" },
      { name: "Customer_Phone", type: "Text", required: true, note: "Customer phone number - Header" },
      { name: "Customer_Name", type: "Text", required: false, note: "Customer name - Header" },
      { name: "Order_Date", type: "DateTime", required: true, note: "Order date - Header" },
      { name: "Payment_Method", type: "Text", required: false, note: "Payment method - Header" },
      { name: "Payment_Type", type: "Text", required: false, note: "Payment type - Header" },
      { name: "Payment_Brand", type: "Text", required: false, note: "Payment brand - Header" },
      { name: "Company", type: "Text", required: true, note: "Company name - Header" },
      { name: "Status", type: "Int", required: false, note: "Order status code - Header" },
      { name: "Status_Description", type: "Text", required: false, note: "Status description - Header" },
      { name: "Sales_Person", type: "Text", required: false, note: "Sales person name - Header" },
      { name: "Transaction_Type", type: "Text", required: false, note: "automatic/Manual - Header" },
      { name: "Media", type: "Text", required: false, note: "Marketing media source - Header" },
      { name: "Profit_Center", type: "Text", required: false, note: "Salla/WebApp/MobApp - Header" },
      { name: "Customer_IP", type: "Text", required: false, note: "Customer IP address - Header" },
      { name: "Device_Fingerprint", type: "Text", required: false, note: "Device info - Header" },
      { name: "Transaction_Location", type: "Text", required: false, note: "KSA, CAIRO etc - Header" },
      { name: "Payment_Term", type: "Text", required: false, note: "immediate/15/30/60 - Header" },
      { name: "Point_Value", type: "Decimal", required: false, note: "Point value - Header" },
      { name: "Point", type: "Bit", required: false, note: "Point flag (0=No, 1=Yes) - Header" },
      { name: "Vendor_Name", type: "Text", required: false, note: "Vendor name - Header" },
      { name: "Order_Status", type: "Text", required: false, note: "Order status text - Header" },
      // Line fields (inside lines[] array)
      { name: "lines[].Brand_Name", type: "Text", required: false, note: "Brand name - Line" },
      { name: "lines[].Brand_Code", type: "Text", required: false, note: "Brand code - Line" },
      { name: "lines[].Product_Name", type: "Text", required: false, note: "Product name - Line" },
      { name: "lines[].Product_Id", type: "Text", required: false, note: "Product identifier - Line" },
      { name: "lines[].Coins_Number", type: "Decimal", required: false, note: "Number of coins - Line" },
      { name: "lines[].Unit_Price", type: "Decimal", required: false, note: "Unit price - Line" },
      { name: "lines[].Cost_Price", type: "Decimal", required: false, note: "Cost price - Line" },
      { name: "lines[].Quantity", type: "Decimal", required: false, note: "Quantity - Line" },
      { name: "lines[].Cost_Sold", type: "Decimal", required: false, note: "Total cost sold - Line" },
      { name: "lines[].Total", type: "Decimal", required: false, note: "Total amount - Line" },
      { name: "lines[].Profit", type: "Decimal", required: false, note: "Profit amount - Line" },
      { name: "lines[].Player_Id", type: "Text", required: false, note: "Player identifier - Line" },
    ],
  },
  {
    id: "lookup",
    name: "Data Lookup (GET)",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-lookup`,
    method: "GET",
    description: "Check if data exists by ID for various entities. Use query parameters to specify entity type and ID. Returns the data if found.",
    fields: [
      { name: "entity", type: "Query Param", required: true, note: "Entity type: salesheader, salesline, payment, customer, supplier, supplierproduct, brand, product" },
      { name: "id", type: "Query Param", required: true, note: "The ID value to look up (e.g., Order_Number, Customer_Phone, SKU)" },
    ],
  },
  {
    id: "lookup-salesheader",
    name: "Lookup: Sales Order Header",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-lookup?entity=salesheader&id={Order_Number}`,
    method: "GET",
    description: "Check if a Sales Order Header exists by Order Number. Returns order details if found.",
    fields: [
      { name: "entity", type: "Query Param", required: true, note: "Value: salesheader" },
      { name: "id", type: "Query Param", required: true, note: "The Order Number to look up" },
    ],
  },
  {
    id: "lookup-salesline",
    name: "Lookup: Sales Order Line",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-lookup?entity=salesline&id={Order_Number}`,
    method: "GET",
    description: "Check if Sales Order Lines exist by Order Number. Returns all line items for the order.",
    fields: [
      { name: "entity", type: "Query Param", required: true, note: "Value: salesline" },
      { name: "id", type: "Query Param", required: true, note: "The Order Number to look up" },
    ],
  },
  {
    id: "lookup-payment",
    name: "Lookup: Payment",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-lookup?entity=payment&id={Order_Number}`,
    method: "GET",
    description: "Check if a Payment exists by Order Number. Returns payment details if found.",
    fields: [
      { name: "entity", type: "Query Param", required: true, note: "Value: payment" },
      { name: "id", type: "Query Param", required: true, note: "The Order Number to look up" },
    ],
  },
  {
    id: "lookup-customer",
    name: "Lookup: Customer",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-lookup?entity=customer&id={Customer_Phone}`,
    method: "GET",
    description: "Check if a Customer exists by Phone Number. Returns customer details if found.",
    fields: [
      { name: "entity", type: "Query Param", required: true, note: "Value: customer" },
      { name: "id", type: "Query Param", required: true, note: "The Customer Phone to look up" },
    ],
  },
  {
    id: "lookup-supplier",
    name: "Lookup: Supplier",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-lookup?entity=supplier&id={Supplier_Code}`,
    method: "GET",
    description: "Check if a Supplier exists by Supplier Code. Returns supplier details if found.",
    fields: [
      { name: "entity", type: "Query Param", required: true, note: "Value: supplier" },
      { name: "id", type: "Query Param", required: true, note: "The Supplier Code to look up" },
    ],
  },
  {
    id: "lookup-supplierproduct",
    name: "Lookup: Supplier Product",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-lookup?entity=supplierproduct&id={Supplier_Code}`,
    method: "GET",
    description: "Check if Supplier Products exist by Supplier Code. Returns all products for the supplier.",
    fields: [
      { name: "entity", type: "Query Param", required: true, note: "Value: supplierproduct" },
      { name: "id", type: "Query Param", required: true, note: "The Supplier Code to look up" },
    ],
  },
  {
    id: "lookup-brand",
    name: "Lookup: Brand (Product Category)",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-lookup?entity=brand&id={Brand_Code}`,
    method: "GET",
    description: "Check if a Brand exists by Brand Code. Returns brand details if found.",
    fields: [
      { name: "entity", type: "Query Param", required: true, note: "Value: brand" },
      { name: "id", type: "Query Param", required: true, note: "The Brand Code to look up" },
    ],
  },
  {
    id: "lookup-product",
    name: "Lookup: Product",
    endpoint: `${SUPABASE_FUNCTIONS_URL}/api-lookup?entity=product&id={SKU}`,
    method: "GET",
    description: "Check if a Product exists by SKU. Returns product details if found.",
    fields: [
      { name: "entity", type: "Query Param", required: true, note: "Value: product" },
      { name: "id", type: "Query Param", required: true, note: "The Product SKU to look up" },
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

  const generateRequestBodyExample = (fields: any[], method: string = 'POST', endpoint: string = '') => {
    // For GET requests with query parameters, show the URL example
    if (method === 'GET') {
      const queryParams = fields.filter((f: any) => f.type === 'Query Param' && f.required);
      if (queryParams.length > 0) {
        return `// No request body needed for GET requests
// Query parameters are passed in the URL`;
      }
      return '// No request body needed for GET requests';
    }

    // Check if fields contain array notation (e.g., "records[].employee_code")
    const arrayFields: Record<string, any[]> = {};
    const regularFields: any[] = [];

    fields.filter((field: any) => field.required).forEach((field: any) => {
      const match = field.name.match(/^(\w+)\[\]\.(\w+)$/);
      if (match) {
        const arrayName = match[1];
        const propName = match[2];
        if (!arrayFields[arrayName]) {
          arrayFields[arrayName] = [];
        }
        arrayFields[arrayName].push({ name: propName, type: field.type });
      } else if (field.type === 'Array') {
        // This is the array field itself, skip it as we'll handle it via child fields
        arrayFields[field.name] = arrayFields[field.name] || [];
      } else if (field.type !== 'Query Param' && field.type !== 'Header') {
        regularFields.push(field);
      }
    });

    const getFieldValue = (type: string) => {
      if (type === 'Text') return '"value"';
      if (type === 'Int' || type === 'BigInt') return '123';
      if (type === 'Decimal') return '99.99';
      if (type === 'Bit') return 'true';
      if (type === 'Datetime') return '"2024-01-01 12:00:00"';
      return '"2024-01-01"';
    };

    let result = '{\n';
    const parts: string[] = [];

    // Add regular fields first
    regularFields.forEach((field: any) => {
      parts.push(`  "${field.name}": ${getFieldValue(field.type)}`);
    });

    // Add array fields with proper nested structure
    Object.entries(arrayFields).forEach(([arrayName, props]) => {
      if (props.length > 0) {
        const nestedProps = props.map(p => `      "${p.name}": ${getFieldValue(p.type)}`).join(',\n');
        parts.push(`  "${arrayName}": [\n    {\n${nestedProps}\n    }\n  ]`);
      } else {
        parts.push(`  "${arrayName}": []`);
      }
    });

    result += parts.join(',\n') + '\n}';
    return result;
  };

  const filteredApis = API_ENDPOINTS.filter(api => selectedApis.includes(api.id)).map(api => {
    const dbFields = getApiFields(api.endpoint);
    // Use database fields if available, otherwise fall back to static fields from API_ENDPOINTS
    const fields = dbFields.length > 0 
      ? dbFields.map(config => ({
          name: config.field_name,
          type: config.field_type,
          required: editedConfigs[config.id] !== undefined ? editedConfigs[config.id] : config.is_required,
          note: config.field_note || '',
          configId: config.id
        }))
      : api.fields.map(field => ({
          name: field.name,
          type: field.type,
          required: field.required,
          note: field.note || '',
          configId: undefined
        }));
    
    return {
      ...api,
      fields
    };
  });

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
          API Integration for Edara
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filter APIs</CardTitle>
              <CardDescription>Select APIs to include in documentation</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedApis(API_ENDPOINTS.map(api => api.id))}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedApis([])}
              >
                Unselect All
              </Button>
            </div>
          </div>
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
      {filteredApis.map((api: any, index) => (
        <Card key={api.id} className="break-inside-avoid print:shadow-none print:border-0 print:page-break-after">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-gray-900 dark:text-foreground">{api.name}</CardTitle>
                {api.upsertKey && (
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded font-medium">
                    Upsert
                  </span>
                )}
                {api.upsertKey === null && api.method === 'POST' && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded font-medium">
                    Insert Only
                  </span>
                )}
              </div>
              <span className="text-xs font-mono bg-primary/10 px-2 py-1 rounded text-gray-900 dark:text-foreground">
                {api.method}
              </span>
            </div>
            <CardDescription className="text-gray-700 dark:text-foreground/80">{api.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {api.upsertKey && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-300">
                  <strong>Upsert Behavior:</strong> If a record with the same <code className="bg-green-100 dark:bg-green-900/50 px-1 rounded">{api.upsertKey}</code> exists, it will be updated. Otherwise, a new record will be created.
                </p>
              </div>
            )}
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
                <pre>{`${api.method} ${api.endpoint}
Authorization: <${apiKey || 'your_api_key_here'}>
${api.method === 'POST' ? 'Content-Type: application/json\n' : ''}
${generateRequestBodyExample(api.fields, api.method, api.endpoint)}`}</pre>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2 text-gray-900 dark:text-foreground">Example Response</p>
              <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto text-gray-900 dark:text-foreground">
                <pre>{api.method === 'GET' && api.id.startsWith('lookup') ? `{
  "success": true,
  "exists": true,
  "entity": "${api.id.replace('lookup-', '') || 'salesheader'}",
  "id": "LOOKUP_VALUE",
  "count": 1,
  "data": [
    {
      "id": "uuid-here",
      "created_at": "2024-01-01T00:00:00Z",
      ...
    }
  ],
  "message": "Record found"
}` : `{
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
