import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, ArrowRight, User, Tag, Package, ShoppingCart, Globe } from "lucide-react";
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Sync Order to Odoo - Step by Step</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Badge */}
          <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
            <div>
              <p className="text-sm font-medium">
                Order: <span className="text-primary">{transactions[0]?.order_number}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {transactions.length} line(s) to sync
              </p>
            </div>
            <Badge 
              variant={odooMode === "Production" ? "destructive" : "secondary"}
              className="text-sm"
            >
              <Globe className="h-3 w-3 mr-1" />
              {odooMode || "Loading..."}
            </Badge>
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
                
                {/* Show details */}
                {stepResults[step.id].details && (
                  <div className="mt-2 text-xs bg-muted/50 p-2 rounded max-h-24 overflow-auto">
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
