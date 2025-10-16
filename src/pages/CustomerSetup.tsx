import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Receipt, TrendingUp, ArrowUpDown, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CustomerSetup = () => {
  const { t } = useLanguage();

  return (
    <>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground">{t("customerSetup.title")}</h1>
            <Badge variant="secondary" className="text-lg px-4 py-1">
              0 {t("customerSetup.customers")}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Sync Customers
            </Button>
            <Button variant="destructive" disabled>
              <Trash2 className="h-4 w-4 mr-2" />
              {t("customerSetup.clearAll")}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-card rounded-md border">
          <Input
            placeholder={t("customerSetup.filterByName")}
            value=""
            disabled
          />
          <Input
            placeholder={t("customerSetup.filterByPhone")}
            value=""
            disabled
          />
          <Select value="all" disabled>
            <SelectTrigger>
              <SelectValue placeholder={t("customerSetup.blocked")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="active">{t("customerSetup.active")}</SelectItem>
              <SelectItem value="blocked">{t("customerSetup.blocked")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value="all" disabled>
            <SelectTrigger>
              <SelectValue placeholder={t("customerSetup.filterByBrand")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={t("customerSetup.filterByProduct")}
            value=""
            disabled
          />
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50">
                  {t("customerSetup.phone")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50">
                  {t("customerSetup.name")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50">
                  {t("customerSetup.creationDate")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50">
                  {t("customerSetup.lastTransactionDate")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50">
                  {t("customerSetup.totalSpend")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50">
                  {t("customerSetup.status")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50">
                  {t("customerSetup.blocked")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead className="text-right">{t("customerSetup.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No customers to display
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Edit Dialog */}
        <Dialog open={false}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("customerSetup.editCustomer")}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer_phone">{t("customerSetup.phone")}</Label>
                <Input
                  id="customer_phone"
                  value=""
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_name">{t("customerSetup.customerName")}</Label>
                <Input
                  id="customer_name"
                  value=""
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t("customerSetup.status")}</Label>
                <Select value="active" disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("customerSetup.active")}</SelectItem>
                    <SelectItem value="disable">{t("customerSetup.disabled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="block_reason">{t("customerSetup.blockReason")}</Label>
                <Textarea
                  id="block_reason"
                  value=""
                  disabled
                  placeholder={t("customerSetup.blockReasonPlaceholder")}
                />
              </div>
              <Button type="submit" className="w-full" disabled>
                {t("customerSetup.save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Transactions Dialog */}
        <Dialog open={false}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("customerSetup.customerTransactions")}</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dashboard.date")}</TableHead>
                  <TableHead>{t("customerSetup.brand")}</TableHead>
                  <TableHead>{t("customerSetup.product")}</TableHead>
                  <TableHead>{t("dashboard.orderNumber")}</TableHead>
                  <TableHead className="text-right">{t("dashboard.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                    No transactions
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Summary Dialog */}
        <Dialog open={false}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t("customerSetup.customerSummary")}</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("customerSetup.brand")}</TableHead>
                  <TableHead className="text-right">{t("customerSetup.totalSpend")}</TableHead>
                  <TableHead className="text-right">{t("dashboard.transactions")}</TableHead>
                  <TableHead>{t("customerSetup.lastTransaction")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                    No summary data
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Clear All Confirmation */}
        <AlertDialog open={false}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("customerSetup.clearAll")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("customerSetup.clearConfirm")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("customerSetup.cancel")}</AlertDialogCancel>
              <AlertDialogAction>
                {t("common.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default CustomerSetup;
