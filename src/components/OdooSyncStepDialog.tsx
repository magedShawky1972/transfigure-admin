import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, ArrowRight, User, Tag, Package, ShoppingCart } from "lucide-react";
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
  details?: any;
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
  const [odooConfig, setOdooConfig] = useState<any>(null);

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
    setOdooConfig(null);
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const fetchOdooConfig = async () => {
    const { data, error } = await supabase
      .from("odoo_api_config")
      .select("*")
      .eq("is_active", true)
      .single();

    if (error || !data) {
      throw new Error("No active Odoo API configuration found");
    }
    return data;
  };

  const executeStep = async (stepId: string) => {
    setIsProcessing(true);
    setStepResults((prev) => ({
      ...prev,
      [stepId]: { status: "loading", message: "Processing..." },
    }));

    try {
      let config = odooConfig;
      if (!config) {
        config = await fetchOdooConfig();
        setOdooConfig(config);
      }

      const isProduction = config.is_production_mode;
      const apiKey = isProduction ? config.api_key : config.api_key_test;

      const firstTransaction = transactions[0];
      let result: StepResult;

      switch (stepId) {
        case "customer": {
          const customerApiUrl = isProduction
            ? config.customer_api_url
            : config.customer_api_url_test;

          // Check if customer exists
          const checkResponse = await fetch(
            `${customerApiUrl}/${firstTransaction.customer_phone}`,
            {
              method: "PUT",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: firstTransaction.customer_name || "Customer",
                phone: firstTransaction.customer_phone,
              }),
            }
          );

          if (checkResponse.ok) {
            const data = await checkResponse.json();
            result = {
              status: "success",
              message: `✓ Customer found/updated: ${firstTransaction.customer_name || firstTransaction.customer_phone}`,
              details: data,
            };
          } else {
            // Create new customer
            const createResponse = await fetch(customerApiUrl, {
              method: "POST",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: firstTransaction.customer_name || "Customer",
                phone: firstTransaction.customer_phone,
              }),
            });

            if (createResponse.ok) {
              const data = await createResponse.json();
              result = {
                status: "success",
                message: `✓ New customer created: ${firstTransaction.customer_name || firstTransaction.customer_phone}`,
                details: data,
              };
            } else {
              throw new Error("Failed to create customer");
            }
          }
          break;
        }

        case "brand": {
          const brandApiUrl = isProduction
            ? config.brand_api_url
            : config.brand_api_url_test;

          const uniqueBrands = [...new Set(transactions.map((t) => t.brand_code))];
          const brandResults: string[] = [];

          for (const brandCode of uniqueBrands) {
            const transaction = transactions.find((t) => t.brand_code === brandCode);
            
            // Try to update existing brand
            const checkResponse = await fetch(`${brandApiUrl}/${brandCode}`, {
              method: "PUT",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: transaction?.brand_name || brandCode,
              }),
            });

            if (checkResponse.ok) {
              brandResults.push(`Found: ${brandCode}`);
            } else {
              // Create new brand
              const createResponse = await fetch(brandApiUrl, {
                method: "POST",
                headers: {
                  Authorization: apiKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  cat_code: brandCode,
                  name: transaction?.brand_name || brandCode,
                }),
              });

              if (createResponse.ok) {
                brandResults.push(`Created: ${brandCode}`);
              } else {
                brandResults.push(`Failed: ${brandCode}`);
              }
            }
          }

          result = {
            status: "success",
            message: `✓ Brands processed: ${brandResults.join(", ")}`,
          };
          break;
        }

        case "product": {
          const productApiUrl = isProduction
            ? config.product_api_url
            : config.product_api_url_test;

          const uniqueProducts = [...new Set(transactions.map((t) => t.product_id || t.sku))];
          const productResults: string[] = [];

          for (const sku of uniqueProducts) {
            const transaction = transactions.find((t) => (t.product_id || t.sku) === sku);
            
            // Try to update existing product
            const checkResponse = await fetch(`${productApiUrl}/${sku}`, {
              method: "PUT",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: transaction?.product_name || sku,
                list_price: parseFloat(transaction?.unit_price) || 0,
              }),
            });

            if (checkResponse.ok) {
              productResults.push(`Found: ${sku}`);
            } else {
              // Create new product
              const createResponse = await fetch(productApiUrl, {
                method: "POST",
                headers: {
                  Authorization: apiKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  default_code: sku,
                  name: transaction?.product_name || sku,
                  list_price: parseFloat(transaction?.unit_price) || 0,
                  cat_code: transaction?.brand_code,
                }),
              });

              if (createResponse.ok) {
                productResults.push(`Created: ${sku}`);
              } else {
                productResults.push(`Failed: ${sku}`);
              }
            }
          }

          result = {
            status: "success",
            message: `✓ Products processed: ${productResults.length} item(s)`,
            details: productResults,
          };
          break;
        }

        case "order": {
          const salesOrderApiUrl = isProduction
            ? config.sales_order_api_url
            : config.sales_order_api_url_test;

          const orderPayload = {
            order_number: firstTransaction.order_number,
            customer_phone: firstTransaction.customer_phone,
            order_date: firstTransaction.created_at_date,
            payment_method: firstTransaction.payment_method,
            lines: transactions.map((t, index) => ({
              line_number: index + 1,
              product_sku: t.product_id || t.sku,
              quantity: t.qty || 1,
              unit_price: parseFloat(t.unit_price) || 0,
              total: parseFloat(t.total) || 0,
            })),
          };

          const orderResponse = await fetch(salesOrderApiUrl, {
            method: "POST",
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(orderPayload),
          });

          if (orderResponse.ok) {
            const data = await orderResponse.json();
            result = {
              status: "success",
              message: `✓ Order ${firstTransaction.order_number} created successfully in Odoo!`,
              details: data,
            };
            setSyncComplete(true);
          } else {
            const errorText = await orderResponse.text();
            throw new Error(`Failed to create order: ${errorText}`);
          }
          break;
        }

        default:
          throw new Error("Unknown step");
      }

      setStepResults((prev) => ({
        ...prev,
        [stepId]: result,
      }));
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
      // Execute current step
      await executeStep(currentStepId);
    } else if (stepResults[currentStepId].status === "success" && currentStep < steps.length - 1) {
      // Move to next step
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync Order to Odoo - Step by Step</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm font-medium">
              Order: <span className="text-primary">{transactions[0]?.order_number}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {transactions.length} line(s) to sync
            </p>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`p-3 rounded-lg border transition-colors ${
                  index === currentStep
                    ? "border-primary bg-primary/5"
                    : index < currentStep
                    ? "border-green-500/50 bg-green-500/5"
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
                  {index === currentStep && (
                    <Badge variant="outline" className="flex-shrink-0">
                      Current
                    </Badge>
                  )}
                </div>
                
                {stepResults[step.id].details && index <= currentStep && (
                  <div className="mt-2 text-xs bg-muted/50 p-2 rounded max-h-20 overflow-auto">
                    <pre className="whitespace-pre-wrap">
                      {typeof stepResults[step.id].details === "string"
                        ? stepResults[step.id].details
                        : JSON.stringify(stepResults[step.id].details, null, 2)}
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
