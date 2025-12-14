import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, ArrowRight, User, Tag, Package, ShoppingCart, Globe, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OdooSyncStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: any[];
  onSyncComplete: () => void;
}

type StepStatus = "pending" | "loading" | "success" | "error";

interface StepResult {
  status: StepStatus;
  message: string;
  apiUrl?: string;
  details?: any;
  requestBody?: any;
  method?: string;
  fullUrl?: string;
}

const steps = [
  { id: "customer", label: "Check/Create Customer", icon: User },
  { id: "brand", label: "Check/Create Brand", icon: Tag },
  { id: "product", label: "Check/Create Products", icon: Package },
  { id: "order", label: "Create Sales Order", icon: ShoppingCart },
];

export function OdooSyncStepDialog({
  open,
  onOpenChange,
  transactions,
  onSyncComplete,
}: OdooSyncStepDialogProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [stepResults, setStepResults] = useState<Record<string, StepResult>>({
    customer: { status: "pending", message: "Waiting..." },
    brand: { status: "pending", message: "Waiting..." },
    product: { status: "pending", message: "Waiting..." },
    order: { status: "pending", message: "Waiting..." },
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [odooMode, setOdooMode] = useState<string | null>(null);
  const [isLoadingMode, setIsLoadingMode] = useState(false);
  const [copiedStep, setCopiedStep] = useState<string | null>(null);
  const [productSkuMap, setProductSkuMap] = useState<Record<string, string>>({});
  const [expandedBodies, setExpandedBodies] = useState<Record<string, boolean>>({});

  // Pre-calculate request bodies for display
  const getPreCalculatedBodies = () => {
    const firstTransaction = transactions[0];
    
    // Customer body
    const customerBody = {
      partner_type: "customer",
      name: firstTransaction?.customer_name || "Customer",
      phone: firstTransaction?.customer_phone,
      email: "",
      customer_group: "Retail",
      status: "active",
      is_blocked: false,
      block_reason: "",
    };

    // Brand bodies
    const uniqueBrands = [...new Set(transactions.map((t: any) => t.brand_code))];
    const brandBodies = uniqueBrands.map((brandCode: string) => {
      const transaction = transactions.find((t: any) => t.brand_code === brandCode);
      return {
        cat_code: brandCode,
        name: transaction?.brand_name || brandCode,
      };
    });

    // Product bodies
    const uniqueProductIds = [...new Set(transactions.map((t: any) => t.product_id))];
    const productBodies = uniqueProductIds.map((productId: string) => {
      const transaction = transactions.find((t: any) => t.product_id === productId);
      const actualSku = productSkuMap[productId] || productId;
      return {
        default_code: actualSku,
        name: transaction?.product_name || actualSku,
        list_price: parseFloat(String(transaction?.unit_price)) || 0,
        cat_code: transaction?.brand_code,
      };
    });

    // Order body
    const orderBody = {
      order_number: firstTransaction?.order_number,
      customer_phone: firstTransaction?.customer_phone,
      order_date: firstTransaction?.created_at_date,
      payment_method: firstTransaction?.payment_method,
      lines: transactions.map((t: any, index: number) => ({
        line_number: index + 1,
        product_sku: productSkuMap[t.product_id] || t.product_id,
        quantity: parseFloat(String(t.qty)) || 1,
        uom: "Unit",
        unit_price: parseFloat(String(t.unit_price)) || 0,
        total: parseFloat(String(t.total)) || 0,
      })),
    };

    return {
      customer: customerBody,
      brand: brandBodies,
      product: productBodies,
      order: orderBody,
    };
  };

  const preCalculatedBodies = getPreCalculatedBodies();

  // Fetch Odoo mode and product SKUs when dialog opens
  useEffect(() => {
    if (open) {
      if (!odooMode) {
        fetchOdooMode();
      }
      fetchProductSkus();
    }
  }, [open]);

  const fetchOdooMode = async () => {
    setIsLoadingMode(true);
    try {
      const { data, error } = await supabase
        .from("odoo_api_config")
        .select("is_production_mode")
        .eq("is_active", true)
        .single();
      
      if (data) {
        setOdooMode(data.is_production_mode ? "Production" : "Test");
      }
    } catch (error) {
      console.error("Error fetching Odoo mode:", error);
    } finally {
      setIsLoadingMode(false);
    }
  };

  const fetchProductSkus = async () => {
    const productIds = [...new Set(transactions.map((t: any) => t.product_id))];
    const { data } = await supabase
      .from("products")
      .select("product_id, sku")
      .in("product_id", productIds);
    
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((p: any) => {
        map[p.product_id] = p.sku || p.product_id;
      });
      setProductSkuMap(map);
    }
  };

  const resetDialog = () => {
    setCurrentStep(0);
    setStepResults({
      customer: { status: "pending", message: "Waiting..." },
      brand: { status: "pending", message: "Waiting..." },
      product: { status: "pending", message: "Waiting..." },
      order: { status: "pending", message: "Waiting..." },
    });
    setIsProcessing(false);
    setSyncComplete(false);
    setOdooMode(null);
    setProductSkuMap({});
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const executeStep = async (stepId: string) => {
    setIsProcessing(true);
    setStepResults((prev) => ({
      ...prev,
      [stepId]: { status: "loading", message: "Processing..." },
    }));

    try {
      const response = await supabase.functions.invoke("sync-order-to-odoo-step", {
        body: { step: stepId, transactions },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      
      // Set mode from first response
      if (data.mode && !odooMode) {
        setOdooMode(data.mode);
      }

      if (data.success) {
        setStepResults((prev) => ({
          ...prev,
          [stepId]: {
            status: "success",
            message: `✓ ${data.message}`,
            apiUrl: data.apiUrl,
            details: data.details || data.brands || data.products,
            requestBody: data.requestBody,
            method: data.method,
            fullUrl: data.fullUrl,
          },
        }));

        if (stepId === "order") {
          setSyncComplete(true);
        }
      } else {
        setStepResults((prev) => ({
          ...prev,
          [stepId]: {
            status: "error",
            message: `✗ ${data.error || "Failed"}`,
            apiUrl: data.apiUrl,
            requestBody: data.requestBody,
            method: data.method,
            fullUrl: data.fullUrl,
          },
        }));
      }
    } catch (error: any) {
      console.error(`Error in step ${stepId}:`, error);
      setStepResults((prev) => ({
        ...prev,
        [stepId]: {
          status: "error",
          message: `✗ Error: ${error.message}`,
        },
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNextStep = async () => {
    const currentStepId = steps[currentStep].id;
    
    if (stepResults[currentStepId].status === "pending") {
      await executeStep(currentStepId);
    } else if (stepResults[currentStepId].status === "success" && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    toast({
      title: "Sync Complete",
      description: `Order ${transactions[0]?.order_number} synced to Odoo successfully`,
    });
    onSyncComplete();
    handleClose();
  };

  const getStepIcon = (stepId: string, index: number) => {
    const result = stepResults[stepId];
    const StepIcon = steps[index].icon;

    if (result.status === "loading") {
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    }
    if (result.status === "success") {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (result.status === "error") {
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    return <StepIcon className="h-5 w-5 text-muted-foreground" />;
  };

  const copyToClipboard = async (stepId: string, body: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(body, null, 2));
      setCopiedStep(stepId);
      setTimeout(() => setCopiedStep(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const toggleBodyExpand = (stepId: string) => {
    setExpandedBodies(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync Order to Odoo - Step by Step</DialogTitle>
          {/* Mode Banner at Top */}
          <div className={`mt-3 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
            odooMode === "Production" 
              ? "bg-destructive/10 border-destructive text-destructive" 
              : "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400"
          }`}>
            <Globe className="h-5 w-5" />
            <span className="font-bold text-lg">
              {isLoadingMode ? "Loading Mode..." : `Mode: ${odooMode || "Unknown"}`}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Info */}
          <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
            <div>
              <p className="text-sm font-medium">
                Order: <span className="text-primary">{transactions[0]?.order_number}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {transactions.length} line(s) to sync
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`p-3 rounded-lg border transition-colors ${
                  index === currentStep
                    ? "border-primary bg-primary/5"
                    : index < currentStep || stepResults[step.id].status === "success"
                    ? "border-green-500/50 bg-green-500/5"
                    : stepResults[step.id].status === "error"
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-muted"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {getStepIcon(step.id, index)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{step.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {stepResults[step.id].message}
                    </p>
                  </div>
                  {index === currentStep && stepResults[step.id].status !== "success" && (
                    <Badge variant="outline" className="flex-shrink-0">
                      Current
                    </Badge>
                  )}
                </div>
                
                {/* Show API URL */}
                {stepResults[step.id].apiUrl && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                    <Globe className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate font-mono">{stepResults[step.id].apiUrl}</span>
                  </div>
                )}
                
                <div className="mt-2 border border-primary/30 rounded">
                  <div 
                    className="flex items-center justify-between bg-primary/10 px-2 py-1 cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() => toggleBodyExpand(step.id)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedBodies[step.id] ? (
                        <ChevronUp className="h-3 w-3 text-primary" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-primary" />
                      )}
                      <span className="text-xs font-medium text-primary">
                        Request Body (POST)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(step.id, preCalculatedBodies[step.id as keyof typeof preCalculatedBodies]);
                      }}
                    >
                      {copiedStep === step.id ? (
                        <><Check className="h-3 w-3 mr-1" /> Copied</>
                      ) : (
                        <><Copy className="h-3 w-3 mr-1" /> Copy</>
                      )}
                    </Button>
                  </div>
                  {expandedBodies[step.id] && (
                    <div className="p-2 text-xs bg-muted/30 max-h-32 overflow-auto border-t border-primary/30">
                      <pre className="whitespace-pre-wrap font-mono text-[10px]">
                        {JSON.stringify(preCalculatedBodies[step.id as keyof typeof preCalculatedBodies], null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
                
                {/* Show details after execution */}
                {stepResults[step.id].details && (
                  <div className="mt-2 text-xs bg-green-500/10 border border-green-500/30 p-2 rounded max-h-24 overflow-auto">
                    <p className="font-medium text-green-600 mb-1">Response:</p>
                    <pre className="whitespace-pre-wrap">
                      {Array.isArray(stepResults[step.id].details)
                        ? stepResults[step.id].details.map((item: any, i: number) => (
                            `${i + 1}. ${item.brand_code || item.sku || item.name || 'Item'}: ${item.status || item.message || 'OK'}\n`
                          )).join('')
                        : typeof stepResults[step.id].details === "object"
                        ? JSON.stringify(stepResults[step.id].details, null, 2)
                        : stepResults[step.id].details}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            
            {syncComplete ? (
              <Button onClick={handleComplete} className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Complete
              </Button>
            ) : stepResults[steps[currentStep].id].status === "error" ? (
              <Button
                onClick={() => executeStep(steps[currentStep].id)}
                disabled={isProcessing}
                variant="destructive"
                className="gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Retry"
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNextStep}
                disabled={isProcessing}
                className="gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : stepResults[steps[currentStep].id].status === "success" ? (
                  <>
                    Next Step
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  "Execute Step"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
