import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ImageIcon, Gamepad2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ShiftClosingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftSessionId: string | null;
  userName: string;
  shiftName: string;
}

interface BrandBalance {
  id: string;
  brand_id: string;
  closing_balance: number;
  receipt_image_path: string | null;
  brand_name: string;
  imageUrl: string | null;
}

interface LudoTransaction {
  id: string;
  product_sku: string;
  amount: number;
  player_id: string;
  transaction_date: string;
  order_number: string;
  imageUrl: string | null;
}

export default function ShiftClosingDetailsDialog({
  open,
  onOpenChange,
  shiftSessionId,
  userName,
  shiftName,
}: ShiftClosingDetailsDialogProps) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [brandBalances, setBrandBalances] = useState<BrandBalance[]>([]);
  const [ludoTransactions, setLudoTransactions] = useState<LudoTransaction[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (open && shiftSessionId) {
      fetchClosingDetails();
    }
  }, [open, shiftSessionId]);

  const fetchClosingDetails = async () => {
    if (!shiftSessionId) return;

    setLoading(true);
    try {
      // Fetch brand balances for this shift session
      const { data: balanceData, error: balanceError } = await supabase
        .from("shift_brand_balances")
        .select(`
          id,
          brand_id,
          closing_balance,
          receipt_image_path
        `)
        .eq("shift_session_id", shiftSessionId);

      if (balanceError) throw balanceError;

      // Fetch Ludo transactions for this shift session
      const { data: ludoData, error: ludoError } = await supabase
        .from("ludo_transactions")
        .select("id, product_sku, amount, player_id, transaction_date, order_number, image_path")
        .eq("shift_session_id", shiftSessionId)
        .order("transaction_date", { ascending: false });

      if (ludoError) throw ludoError;

      // Process brand balances
      if (balanceData && balanceData.length > 0) {
        const brandIds = balanceData.map((b) => b.brand_id);
        const { data: brandsData, error: brandsError } = await supabase
          .from("brands")
          .select("id, brand_name")
          .in("id", brandIds);

        if (brandsError) throw brandsError;

        const brandMap = new Map(brandsData?.map((b) => [b.id, b.brand_name]));

        const enrichedBalances: BrandBalance[] = await Promise.all(
          balanceData.map(async (balance) => {
            let imageUrl: string | null = null;

            if (balance.receipt_image_path) {
              const { data: signedUrlData } = await supabase.storage
                .from("shift-receipts")
                .createSignedUrl(balance.receipt_image_path, 3600);

              imageUrl = signedUrlData?.signedUrl || null;
            }

            return {
              ...balance,
              brand_name: brandMap.get(balance.brand_id) || "Unknown",
              imageUrl,
            };
          })
        );

        setBrandBalances(enrichedBalances);
      } else {
        setBrandBalances([]);
      }

      // Process Ludo transactions
      if (ludoData && ludoData.length > 0) {
        const enrichedLudo: LudoTransaction[] = await Promise.all(
          ludoData.map(async (ludo) => {
            let imageUrl: string | null = null;

            if (ludo.image_path) {
              const { data: signedUrlData } = await supabase.storage
                .from("ludo-receipts")
                .createSignedUrl(ludo.image_path, 3600);

              imageUrl = signedUrlData?.signedUrl || null;
            }

            return {
              id: ludo.id,
              product_sku: ludo.product_sku,
              amount: ludo.amount,
              player_id: ludo.player_id,
              transaction_date: ludo.transaction_date,
              order_number: ludo.order_number,
              imageUrl,
            };
          })
        );

        setLudoTransactions(enrichedLudo);
      } else {
        setLudoTransactions([]);
      }
    } catch (error) {
      console.error("Error fetching closing details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getProductName = (sku: string) => {
    if (sku === "YA019") return language === "ar" ? "فارس" : "Fares";
    if (sku === "YA018") return language === "ar" ? "اللواء" : "Liwa";
    return sku;
  };

  const getLudoSummary = () => {
    const summary: Record<string, { count: number; total: number }> = {};
    ludoTransactions.forEach((tx) => {
      if (!summary[tx.product_sku]) {
        summary[tx.product_sku] = { count: 0, total: 0 };
      }
      summary[tx.product_sku].count += 1;
      summary[tx.product_sku].total += tx.amount;
    });
    return summary;
  };

  const translations = {
    ar: {
      closingDetails: "تفاصيل الإغلاق",
      user: "الموظف",
      shift: "الوردية",
      brand: "العلامة التجارية",
      closingBalance: "رصيد الإغلاق",
      image: "الصورة",
      noClosingData: "لا توجد بيانات إغلاق",
      loading: "جاري التحميل...",
      clickToEnlarge: "انقر للتكبير",
      noImage: "لا توجد صورة",
      ludoTransactions: "معاملات يلا لودو",
      product: "المنتج",
      amount: "المبلغ",
      playerId: "معرف اللاعب",
      orderNumber: "رقم الطلب",
      total: "الإجمالي",
      count: "العدد",
      noLudoTransactions: "لا توجد معاملات لودو",
    },
    en: {
      closingDetails: "Closing Details",
      user: "User",
      shift: "Shift",
      brand: "Brand",
      closingBalance: "Closing Balance",
      image: "Image",
      noClosingData: "No closing data available",
      loading: "Loading...",
      clickToEnlarge: "Click to enlarge",
      noImage: "No image",
      ludoTransactions: "Yalla Ludo Transactions",
      product: "Product",
      amount: "Amount",
      playerId: "Player ID",
      orderNumber: "Order Number",
      total: "Total",
      count: "Count",
      noLudoTransactions: "No Ludo transactions",
    },
  };

  const text = translations[language as keyof typeof translations] || translations.en;
  const ludoSummary = getLudoSummary();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="text-xl">{text.closingDetails}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span><strong>{text.user}:</strong> {userName}</span>
              <span><strong>{text.shift}:</strong> {shiftName}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-2">{text.loading}</span>
              </div>
            ) : (
              <>
                {/* Brand Balances Section */}
                {brandBalances.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {text.noClosingData}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {brandBalances.map((balance) => (
                      <Card key={balance.id} className="overflow-hidden">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-lg">{balance.brand_name}</h3>
                            <div className="text-2xl font-bold text-primary">
                              {balance.closing_balance.toLocaleString()}
                            </div>
                          </div>

                          {balance.imageUrl ? (
                            <div
                              className="relative cursor-pointer group"
                              onClick={() => setSelectedImage(balance.imageUrl)}
                            >
                              <img
                                src={balance.imageUrl}
                                alt={balance.brand_name}
                                className="w-full h-48 object-contain rounded-lg border bg-white"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                <span className="text-white text-sm">{text.clickToEnlarge}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                              <div className="text-center text-muted-foreground">
                                <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                                <span>{text.noImage}</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Ludo Transactions Section */}
                {ludoTransactions.length > 0 && (
                  <div className="space-y-4 mt-6">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="h-5 w-5 text-purple-500" />
                      <h3 className="font-semibold text-lg">{text.ludoTransactions}</h3>
                    </div>

                    {/* Ludo Summary */}
                    <div className="flex gap-4 flex-wrap">
                      {Object.entries(ludoSummary).map(([sku, data]) => (
                        <Card key={sku} className="bg-purple-50 dark:bg-purple-950/30">
                          <CardContent className="p-3">
                            <div className="text-sm font-medium">{getProductName(sku)}</div>
                            <div className="text-lg font-bold text-purple-600">
                              {data.total.toLocaleString()} ({data.count} {text.count})
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Ludo Transactions Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{text.product}</TableHead>
                            <TableHead>{text.amount}</TableHead>
                            <TableHead>{text.playerId}</TableHead>
                            <TableHead>{text.orderNumber}</TableHead>
                            <TableHead>{text.image}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ludoTransactions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="font-medium">{getProductName(tx.product_sku)}</TableCell>
                              <TableCell>{tx.amount.toLocaleString()}</TableCell>
                              <TableCell>{tx.player_id}</TableCell>
                              <TableCell className="text-xs">{tx.order_number}</TableCell>
                              <TableCell>
                                {tx.imageUrl ? (
                                  <img
                                    src={tx.imageUrl}
                                    alt="Receipt"
                                    className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80"
                                    onClick={() => setSelectedImage(tx.imageUrl)}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Enlarged Image Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-2">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Enlarged"
              className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
