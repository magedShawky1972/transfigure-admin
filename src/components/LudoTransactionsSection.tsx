import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Loader2, Sparkles, Gamepad2, Plus, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LudoTransaction {
  id: string;
  order_number: string;
  product_sku: string;
  player_id: string;
  amount: number;
  transaction_date: string;
  image_path: string | null;
}

interface LudoProduct {
  sku: string;
  product_name: string;
  product_price: string | null;
  product_cost: string | null;
}

interface LudoTransactionsSectionProps {
  shiftSessionId: string;
  userId: string;
}

const LudoTransactionsSection = ({ shiftSessionId, userId }: LudoTransactionsSectionProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [products, setProducts] = useState<LudoProduct[]>([]);
  const [transactions, setTransactions] = useState<LudoTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // Form state for new transaction
  const [newTransaction, setNewTransaction] = useState({
    playerId: "",
    amount: "",
    transactionDate: new Date().toISOString().slice(0, 16),
    imageFile: null as File | null,
    imagePath: null as string | null,
  });

  const translations = {
    title: language === "ar" ? "معاملات يلا لودو اليدوية" : "Yalla Ludo Manual Transactions",
    selectProduct: language === "ar" ? "اختر المنتج" : "Select Product",
    playerId: language === "ar" ? "رقم اللاعب" : "Player ID",
    amount: language === "ar" ? "المبلغ" : "Amount",
    transactionDate: language === "ar" ? "التاريخ والوقت" : "Date & Time",
    uploadReceipt: language === "ar" ? "رفع صورة الشحن" : "Upload Receipt",
    addTransaction: language === "ar" ? "إضافة معاملة" : "Add Transaction",
    orderNumber: language === "ar" ? "رقم الطلب" : "Order Number",
    product: language === "ar" ? "المنتج" : "Product",
    actions: language === "ar" ? "الإجراءات" : "Actions",
    noTransactions: language === "ar" ? "لا توجد معاملات" : "No transactions",
    extracting: language === "ar" ? "جاري استخراج البيانات..." : "Extracting data...",
    extractSuccess: language === "ar" ? "تم استخراج البيانات بنجاح" : "Data extracted successfully",
    extractError: language === "ar" ? "فشل في استخراج البيانات" : "Failed to extract data",
    invalidImage: language === "ar" ? "الصورة ليست من تطبيق يلا لودو" : "Image is not from Yalla Ludo app",
    transactionAdded: language === "ar" ? "تم إضافة المعاملة بنجاح" : "Transaction added successfully",
    transactionDeleted: language === "ar" ? "تم حذف المعاملة" : "Transaction deleted",
    summary: language === "ar" ? "ملخص المعاملات" : "Transactions Summary",
    totalTransactions: language === "ar" ? "عدد المعاملات" : "Total Transactions",
    totalAmount: language === "ar" ? "إجمالي المبلغ" : "Total Amount",
  };

  useEffect(() => {
    fetchData();
  }, [shiftSessionId]);

  useEffect(() => {
    loadImageUrls();
  }, [transactions]);

  const fetchData = async () => {
    try {
      // Fetch Ludo products - using or filter to handle potential whitespace in SKUs
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("sku, product_name, product_price, product_cost")
        .or("sku.ilike.LUDOF001%,sku.ilike.LUDOL001%")
        .eq("status", "active");

      if (productsError) {
        console.error("Error fetching products:", productsError);
      }
      
      // Filter out any products with null/empty SKUs
      const validProducts = (productsData || []).filter(p => p.sku && p.sku.trim() !== "");
      console.log("Fetched Ludo products:", validProducts);
      setProducts(validProducts);

      // Fetch existing transactions for this shift
      const { data: transactionsData } = await supabase
        .from("ludo_transactions")
        .select("*")
        .eq("shift_session_id", shiftSessionId)
        .order("created_at", { ascending: false });

      setTransactions(transactionsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadImageUrls = async () => {
    const urls: Record<string, string> = {};
    for (const tx of transactions) {
      if (tx.image_path) {
        const { data } = await supabase.storage
          .from("ludo-receipts")
          .createSignedUrl(tx.image_path, 3600);
        if (data?.signedUrl) {
          urls[tx.id] = data.signedUrl;
        }
      }
    }
    setImageUrls(urls);
  };

  const handleImageUpload = async (file: File) => {
    setExtracting(true);
    try {
      // Upload image first
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${shiftSessionId}/ludo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("ludo-receipts")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setNewTransaction(prev => ({
        ...prev,
        imageFile: file,
        imagePath: fileName,
      }));

      // Convert file to base64 for AI extraction
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Image = await base64Promise;

      // Call AI to extract data (no product SKU needed - AI will detect it)
      const { data, error } = await supabase.functions.invoke("extract-ludo-transaction", {
        body: { imageUrl: base64Image },
      });

      if (error) throw error;

      if (data?.isValidApp === false) {
        toast({
          title: translations.invalidImage,
          description: data.invalidReason || "",
          variant: "destructive",
        });
        // Delete uploaded image
        await supabase.storage.from("ludo-receipts").remove([fileName]);
        setNewTransaction(prev => ({ ...prev, imageFile: null, imagePath: null }));
        return;
      }

      // Auto-select product based on detected SKU
      if (data.detectedSku && products.find(p => p.sku === data.detectedSku)) {
        setSelectedProduct(data.detectedSku);
        
        // Get product price as amount
        const detectedProduct = products.find(p => p.sku === data.detectedSku);
        if (detectedProduct?.product_price) {
          setNewTransaction(prev => ({
            ...prev,
            playerId: data.playerId || prev.playerId,
            amount: detectedProduct.product_price,
            transactionDate: data.transactionDate ? 
              new Date(data.transactionDate).toISOString().slice(0, 16) : 
              prev.transactionDate,
          }));
        } else {
          setNewTransaction(prev => ({
            ...prev,
            playerId: data.playerId || prev.playerId,
            amount: data.amount?.toString() || prev.amount,
            transactionDate: data.transactionDate ? 
              new Date(data.transactionDate).toISOString().slice(0, 16) : 
              prev.transactionDate,
          }));
        }
      } else {
        // Update form with extracted data without auto-selecting product
        setNewTransaction(prev => ({
          ...prev,
          playerId: data.playerId || prev.playerId,
          amount: data.amount?.toString() || prev.amount,
          transactionDate: data.transactionDate ? 
            new Date(data.transactionDate).toISOString().slice(0, 16) : 
            prev.transactionDate,
        }));
      }

      const productName = data.detectedSku === "LUDOF001" ? "فارس" : data.detectedSku === "LUDOL001" ? "لواء" : "";
      toast({
        title: translations.extractSuccess,
        description: `${productName ? (language === "ar" ? "المنتج" : "Product") + ": " + productName + ", " : ""}${language === "ar" ? "رقم اللاعب" : "Player ID"}: ${data.playerId || "-"}, ${language === "ar" ? "المبلغ" : "Amount"}: ${data.amount || "-"}`,
      });

    } catch (error: any) {
      console.error("Error extracting data:", error);
      toast({
        title: translations.extractError,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!selectedProduct || !newTransaction.playerId || !newTransaction.amount) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Generate order number
      const { data: orderNumData } = await supabase.rpc("generate_ludo_order_number");
      const orderNumber = orderNumData || `LUDO-${Date.now()}`;

      // Insert transaction
      const { data: newTx, error: insertError } = await supabase
        .from("ludo_transactions")
        .insert({
          shift_session_id: shiftSessionId,
          product_sku: selectedProduct,
          order_number: orderNumber,
          player_id: newTransaction.playerId,
          amount: parseFloat(newTransaction.amount),
          transaction_date: new Date(newTransaction.transactionDate).toISOString().replace('T', ' ').slice(0, 19),
          image_path: newTransaction.imagePath,
          user_id: userId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Get product info
      const product = products.find(p => p.sku === selectedProduct);

      // Insert into purpletransaction
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user?.id)
        .single();

      const ptRecord = {
        order_number: orderNumber,
        customer_phone: newTransaction.playerId,
        customer_name: `Ludo Player ${newTransaction.playerId}`,
        brand_name: "يلا لودو",
        brand_code: "G01002",
        product_name: product?.product_name || null,
        product_id: selectedProduct,
        qty: 1,
        unit_price: parseFloat(newTransaction.amount),
        total: parseFloat(newTransaction.amount),
        cost_price: product?.product_cost ? parseFloat(product.product_cost) : 0,
        cost_sold: product?.product_cost ? parseFloat(product.product_cost) : 0,
        profit: parseFloat(newTransaction.amount) - (product?.product_cost ? parseFloat(product.product_cost) : 0),
        payment_method: "cash",
        payment_brand: "cash",
        user_name: profile?.user_name || "System",
        trans_type: "manual",
        created_at_date: new Date(newTransaction.transactionDate).toISOString().split('T')[0],
        order_status: "completed",
      };

      const { error: ptError } = await supabase
        .from("purpletransaction")
        .insert(ptRecord as any);

      if (ptError) {
        console.error("Error inserting to purpletransaction:", ptError);
      }

      setTransactions(prev => [newTx, ...prev]);
      
      // Reset form
      setNewTransaction({
        playerId: "",
        amount: "",
        transactionDate: new Date().toISOString().slice(0, 16),
        imageFile: null,
        imagePath: null,
      });

      toast({ title: translations.transactionAdded });

    } catch (error: any) {
      console.error("Error adding transaction:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = async (tx: LudoTransaction) => {
    try {
      // Delete from ludo_transactions
      const { error: deleteError } = await supabase
        .from("ludo_transactions")
        .delete()
        .eq("id", tx.id);

      if (deleteError) throw deleteError;

      // Delete image if exists
      if (tx.image_path) {
        await supabase.storage.from("ludo-receipts").remove([tx.image_path]);
      }

      // Delete from purpletransaction
      await supabase
        .from("purpletransaction")
        .delete()
        .eq("order_number", tx.order_number);

      setTransactions(prev => prev.filter(t => t.id !== tx.id));
      toast({ title: translations.transactionDeleted });

    } catch (error: any) {
      console.error("Error deleting transaction:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Calculate summary
  const summary = transactions.reduce((acc, tx) => {
    const productSku = tx.product_sku;
    if (!acc[productSku]) {
      acc[productSku] = { count: 0, total: 0 };
    }
    acc[productSku].count++;
    acc[productSku].total += tx.amount;
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  if (loading) {
    return (
      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-orange-200 dark:border-orange-900">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/30 dark:to-yellow-950/30">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Gamepad2 className="h-6 w-6 text-orange-500" />
          {translations.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        {/* Add Transaction Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-2">
            <Label>{translations.selectProduct} *</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger>
                <SelectValue placeholder={translations.selectProduct} />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {language === "ar" ? "لا توجد منتجات" : "No products found"}
                  </div>
                ) : (
                  products.map((product) => (
                    <SelectItem key={product.sku} value={product.sku!}>
                      {product.product_name} ({product.product_price} SAR)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{translations.playerId} *</Label>
            <Input
              value={newTransaction.playerId}
              onChange={(e) => setNewTransaction(prev => ({ ...prev, playerId: e.target.value }))}
              placeholder="12345678"
              disabled={extracting}
            />
          </div>

          <div className="space-y-2">
            <Label>{translations.amount} *</Label>
            <Input
              type="number"
              value={newTransaction.amount}
              onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              disabled={extracting}
            />
          </div>

          <div className="space-y-2">
            <Label>{translations.transactionDate}</Label>
            <Input
              type="datetime-local"
              value={newTransaction.transactionDate}
              onChange={(e) => setNewTransaction(prev => ({ ...prev, transactionDate: e.target.value }))}
              disabled={extracting}
            />
          </div>

          <div className="space-y-2">
            <Label>{translations.uploadReceipt}</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
                className="hidden"
                id="ludo-receipt-upload"
                disabled={extracting}
              />
              <Label
                htmlFor="ludo-receipt-upload"
                className={`flex items-center gap-2 cursor-pointer border rounded-md px-3 py-2 w-full justify-center ${
                  extracting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'
                }`}
              >
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <Sparkles className="h-4 w-4 text-orange-500" />
                  </>
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {newTransaction.imagePath ? "✓" : ""}
              </Label>
            </div>
            {extracting && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-orange-500" />
                {translations.extracting}
              </p>
            )}
          </div>
        </div>

        <Button
          onClick={handleAddTransaction}
          disabled={saving || !selectedProduct || !newTransaction.playerId || !newTransaction.amount}
          className="bg-orange-500 hover:bg-orange-600"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {translations.addTransaction}
        </Button>

        {/* Transactions Summary */}
        {Object.keys(summary).length > 0 && (
          <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <h4 className="font-semibold mb-2">{translations.summary}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(summary).map(([sku, data]) => {
                const product = products.find(p => p.sku === sku);
                return (
                  <div key={sku} className="text-sm">
                    <p className="font-medium">{product?.product_name || sku}</p>
                    <p className="text-muted-foreground">
                      {translations.totalTransactions}: {data.count}
                    </p>
                    <p className="text-muted-foreground">
                      {translations.totalAmount}: {data.total.toFixed(2)} SAR
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transactions Table */}
        {transactions.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translations.orderNumber}</TableHead>
                  <TableHead>{translations.product}</TableHead>
                  <TableHead>{translations.playerId}</TableHead>
                  <TableHead>{translations.amount}</TableHead>
                  <TableHead>{translations.transactionDate}</TableHead>
                  <TableHead>{translations.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const product = products.find(p => p.sku === tx.product_sku);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-sm">{tx.order_number}</TableCell>
                      <TableCell>{product?.product_name || tx.product_sku}</TableCell>
                      <TableCell>{tx.player_id}</TableCell>
                      <TableCell>{tx.amount.toFixed(2)} SAR</TableCell>
                      <TableCell>{new Date(tx.transaction_date).toLocaleString("ar-SA")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {imageUrls[tx.id] && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setSelectedImage(imageUrls[tx.id])}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteTransaction(tx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">{translations.noTransactions}</p>
        )}
      </CardContent>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "صورة الإيصال" : "Receipt Image"}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Receipt"
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LudoTransactionsSection;
