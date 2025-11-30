import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Loader2, Sparkles, Gamepad2, Eye, Check, AlertCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface LudoTransaction {
  id: string;
  order_number: string;
  product_sku: string;
  player_id: string;
  amount: number;
  transaction_date: string;
  image_path: string | null;
}

interface TempTransaction {
  id: string;
  product_sku: string;
  product_name: string;
  player_id: string;
  amount: number;
  transaction_date: string;
  image_path: string;
  imageUrl: string;
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
  const { language } = useLanguage();
  const { toast } = useToast();
  const [products, setProducts] = useState<LudoProduct[]>([]);
  const [transactions, setTransactions] = useState<LudoTransaction[]>([]);
  const [tempTransactions, setTempTransactions] = useState<TempTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState({ total: 0, current: 0, success: 0 });

  // Load temp transactions from database on mount
  const loadTempTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("temp_ludo_transactions")
        .select("*")
        .eq("shift_session_id", shiftSessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const tempTxs: TempTransaction[] = await Promise.all(
          data.map(async (row) => {
            let imageUrl = "";
            if (row.image_path) {
              const { data: signedData } = await supabase.storage
                .from("ludo-receipts")
                .createSignedUrl(row.image_path, 3600);
              imageUrl = signedData?.signedUrl || "";
            }
            const product = products.find(p => p.sku === row.product_sku);
            return {
              id: row.id,
              product_sku: row.product_sku,
              product_name: product?.product_name || row.product_sku,
              player_id: row.player_id || "",
              amount: Number(row.amount),
              transaction_date: row.transaction_date,
              image_path: row.image_path || "",
              imageUrl,
            };
          })
        );
        console.log(`[Ludo] Loaded ${tempTxs.length} temp transactions from database`);
        setTempTransactions(tempTxs);
      }
    } catch (error) {
      console.error("[Ludo] Failed to load temp transactions:", error);
    }
  };

  useEffect(() => {
    if (products.length > 0) {
      loadTempTransactions();
    }
  }, [shiftSessionId, products]);

  const translations = {
    title: language === "ar" ? "معاملات يلا لودو اليدوية" : "Yalla Ludo Manual Transactions",
    playerId: language === "ar" ? "رقم اللاعب" : "Player ID",
    amount: language === "ar" ? "المبلغ" : "Amount",
    transactionDate: language === "ar" ? "التاريخ والوقت" : "Date & Time",
    uploadReceipts: language === "ar" ? "رفع صور الشحن" : "Upload Receipts",
    confirmAll: language === "ar" ? "تأكيد جميع المعاملات" : "Confirm All Transactions",
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
    pendingConfirmation: language === "ar" ? "في انتظار التأكيد" : "Pending Confirmation",
    confirmed: language === "ar" ? "المعاملات المؤكدة" : "Confirmed Transactions",
    missingPlayerId: language === "ar" ? "يرجى إدخال رقم اللاعب لجميع المعاملات" : "Please enter player ID for all transactions",
    allConfirmed: language === "ar" ? "تم تأكيد جميع المعاملات بنجاح" : "All transactions confirmed successfully",
    noPending: language === "ar" ? "لا توجد معاملات معلقة" : "No pending transactions",
  };

  useEffect(() => {
    fetchData();
  }, [shiftSessionId]);

  useEffect(() => {
    loadImageUrls();
  }, [transactions]);

  const fetchData = async () => {
    try {
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("sku, product_name, product_price, product_cost")
        .or("sku.ilike.LUDOF001%,sku.ilike.LUDOL001%")
        .eq("status", "active");

      if (productsError) {
        console.error("Error fetching products:", productsError);
      }
      
      const validProducts = (productsData || []).filter(p => p.sku && p.sku.trim() !== "");
      setProducts(validProducts);

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

  const handleMultiImageUpload = async (files: File[]) => {
    console.log(`[Ludo Upload] Starting upload of ${files.length} files`);
    setExtracting(true);
    setUploadProgress({ total: files.length, current: 0, success: 0 });

    let successCount = 0;

    // Process all files and add each one to state immediately after extraction
    const processFile = async (file: File, index: number) => {
      console.log(`[Ludo Upload] Processing file ${index + 1}/${files.length}: ${file.name}`);
      setUploadProgress(prev => ({ ...prev, current: index + 1 }));
      
      try {
        // Upload image first with unique timestamp per file
        const fileExt = file.name.split('.').pop();
        const uniqueId = `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
        const fileName = `${userId}/${shiftSessionId}/ludo-${uniqueId}.${fileExt}`;

        console.log(`[Ludo Upload] Uploading to storage: ${fileName}`);
        const { error: uploadError } = await supabase.storage
          .from("ludo-receipts")
          .upload(fileName, file);

        if (uploadError) {
          console.error(`[Ludo Upload] Storage upload error:`, uploadError);
          throw uploadError;
        }
        console.log(`[Ludo Upload] Storage upload successful`);

        // Convert file to base64 for AI extraction
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const base64Image = await base64Promise;

        // Call AI to extract data (no player ID extraction)
        console.log(`[Ludo Upload] Calling AI extraction...`);
        const { data, error } = await supabase.functions.invoke("extract-ludo-transaction", {
          body: { imageUrl: base64Image },
        });

        if (error) {
          console.error(`[Ludo Upload] AI extraction error:`, error);
          throw error;
        }
        console.log(`[Ludo Upload] AI extraction result:`, data);

        if (data?.isValidApp === false) {
          console.log(`[Ludo Upload] Invalid app image, removing from storage`);
          toast({
            title: translations.invalidImage,
            description: data.invalidReason || "",
            variant: "destructive",
          });
          await supabase.storage.from("ludo-receipts").remove([fileName]);
          return null;
        }

        // Get product info based on detected SKU
        const detectedSku = data.detectedSku || "LUDOF001";
        const product = products.find(p => p.sku === detectedSku);
        const amount = product?.product_price ? parseFloat(product.product_price) : (data.amount || 0);

        const transactionDate = data.transactionDate || new Date().toISOString().replace('T', ' ').slice(0, 19);

        // Insert into temp_ludo_transactions table
        const { data: insertedRow, error: insertError } = await supabase
          .from("temp_ludo_transactions")
          .insert({
            shift_session_id: shiftSessionId,
            user_id: userId,
            product_sku: detectedSku,
            amount: amount,
            player_id: null,
            transaction_date: transactionDate,
            image_path: fileName,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`[Ludo Upload] DB insert error:`, insertError);
          throw insertError;
        }

        const tempTx: TempTransaction = {
          id: insertedRow.id,
          product_sku: detectedSku,
          product_name: product?.product_name || detectedSku,
          player_id: "",
          amount: amount,
          transaction_date: transactionDate,
          image_path: fileName,
          imageUrl: base64Image,
        };

        console.log(`[Ludo Upload] Added temp transaction to DB:`, tempTx.id);
        setTempTransactions(prev => [...prev, tempTx]);

        successCount++;
        setUploadProgress(prev => ({ ...prev, success: successCount }));

        toast({
          title: translations.extractSuccess,
          description: `${language === "ar" ? "المنتج" : "Product"}: ${product?.product_name || detectedSku}`,
        });

        return tempTx;
      } catch (error: any) {
        console.error("[Ludo Upload] Error extracting data:", error);
        toast({
          title: translations.extractError,
          description: error.message,
          variant: "destructive",
        });
        return null;
      }
    };

    // Process files sequentially to avoid race conditions
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i], i);
    }

    console.log(`[Ludo Upload] Completed. Success: ${successCount}/${files.length}`);
    setExtracting(false);
    setUploadProgress({ total: 0, current: 0, success: 0 });
  };

  const updateTempPlayerID = async (tempId: string, playerId: string) => {
    // Update in database
    await supabase
      .from("temp_ludo_transactions")
      .update({ player_id: playerId })
      .eq("id", tempId);
    
    setTempTransactions(prev => 
      prev.map(tx => tx.id === tempId ? { ...tx, player_id: playerId } : tx)
    );
  };

  const deleteTempTransaction = async (tempTx: TempTransaction) => {
    // Delete from database
    await supabase.from("temp_ludo_transactions").delete().eq("id", tempTx.id);
    // Delete uploaded image
    await supabase.storage.from("ludo-receipts").remove([tempTx.image_path]);
    setTempTransactions(prev => prev.filter(tx => tx.id !== tempTx.id));
  };

  const canConfirm = tempTransactions.length > 0;

  const handleConfirmAll = async () => {
    if (!canConfirm) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: translations.noPending,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user?.id)
        .single();

      for (const tempTx of tempTransactions) {
        // Generate order number
        const { data: orderNumData } = await supabase.rpc("generate_ludo_order_number");
        const orderNumber = orderNumData || `LUDO-${Date.now()}`;

        // Insert transaction
        const { data: newTx, error: insertError } = await supabase
          .from("ludo_transactions")
          .insert({
            shift_session_id: shiftSessionId,
            product_sku: tempTx.product_sku,
            order_number: orderNumber,
            player_id: tempTx.player_id,
            amount: tempTx.amount,
            transaction_date: tempTx.transaction_date,
            image_path: tempTx.image_path,
            user_id: userId,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Get product info
        const product = products.find(p => p.sku === tempTx.product_sku);

        // Insert into purpletransaction
        const playerIdValue = tempTx.player_id?.trim() || "";
        const ptRecord = {
          order_number: orderNumber,
          customer_phone: playerIdValue || null,
          customer_name: playerIdValue ? `Ludo Player ${playerIdValue}` : "Ludo Player",
          brand_name: "يلا لودو",
          brand_code: "G01002",
          product_name: product?.product_name || null,
          product_id: tempTx.product_sku,
          qty: 1,
          unit_price: tempTx.amount,
          total: tempTx.amount,
          cost_price: product?.product_cost ? parseFloat(product.product_cost) : 0,
          cost_sold: product?.product_cost ? parseFloat(product.product_cost) : 0,
          profit: tempTx.amount - (product?.product_cost ? parseFloat(product.product_cost) : 0),
          payment_method: "cash",
          payment_brand: "cash",
          user_name: profile?.user_name || "System",
          trans_type: "manual",
          created_at_date: tempTx.transaction_date.split(' ')[0],
          order_status: "completed",
        };

        const { error: ptError } = await supabase
          .from("purpletransaction")
          .insert(ptRecord as any);

        if (ptError) {
          console.error("Error inserting to purpletransaction:", ptError);
        }

        if (newTx) {
          setTransactions(prev => [newTx, ...prev]);
        }
      }

      // Clear temp transactions from database
      await supabase
        .from("temp_ludo_transactions")
        .delete()
        .eq("shift_session_id", shiftSessionId);

      setTempTransactions([]);
      toast({ title: translations.allConfirmed });

    } catch (error: any) {
      console.error("Error confirming transactions:", error);
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
      const { error: deleteError } = await supabase
        .from("ludo_transactions")
        .delete()
        .eq("id", tx.id);

      if (deleteError) throw deleteError;

      if (tx.image_path) {
        await supabase.storage.from("ludo-receipts").remove([tx.image_path]);
      }

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

  // Calculate summary for confirmed transactions
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
        {/* Multi-Upload Section */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  // Convert FileList to Array BEFORE clearing input
                  // FileList is a live reference that becomes empty when input is cleared
                  const filesArray = Array.from(files);
                  console.log(`[Ludo Upload] Selected ${filesArray.length} files`);
                  e.target.value = ""; // Clear input first
                  handleMultiImageUpload(filesArray);
                }
              }}
              className="hidden"
              id="ludo-multi-upload"
              disabled={extracting}
            />
            <Label
              htmlFor="ludo-multi-upload"
              className={`flex items-center gap-2 cursor-pointer border-2 border-dashed border-orange-300 rounded-lg px-6 py-4 w-full justify-center bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors ${
                extracting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {extracting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  <span>{translations.extracting}</span>
                  {uploadProgress.total > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {uploadProgress.current}/{uploadProgress.total} - {language === "ar" ? "نجح" : "Success"}: {uploadProgress.success}
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-orange-500" />
                  <span className="font-medium">{translations.uploadReceipts}</span>
                  <span className="text-muted-foreground">({language === "ar" ? "يمكنك اختيار عدة صور" : "Select multiple images"})</span>
                </>
              )}
            </Label>
          </div>
          
          {/* Status Summary */}
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/20">
              {language === "ar" ? "معلقة" : "Pending"}: {tempTransactions.length}
            </Badge>
            <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
              {language === "ar" ? "مؤكدة" : "Confirmed"}: {transactions.length}
            </Badge>
          </div>
        </div>

        {/* Pending Transactions */}
        {tempTransactions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                {translations.pendingConfirmation} ({tempTransactions.length})
              </h3>
              <Button
                onClick={handleConfirmAll}
                disabled={saving || !canConfirm}
                className="bg-green-600 hover:bg-green-700"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {translations.confirmAll}
              </Button>
            </div>

            {!canConfirm && tempTransactions.length > 0 && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {translations.missingPlayerId}
              </p>
            )}

            <div className="rounded-md border border-yellow-200 dark:border-yellow-900">
              <Table>
                <TableHeader>
                  <TableRow className="bg-yellow-50 dark:bg-yellow-950/20">
                    <TableHead className="w-16">{language === "ar" ? "الصورة" : "Image"}</TableHead>
                    <TableHead>{translations.product}</TableHead>
                    <TableHead>{translations.playerId} *</TableHead>
                    <TableHead>{translations.amount}</TableHead>
                    <TableHead>{translations.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tempTransactions.map((tx) => (
                    <TableRow key={tx.id} className={!tx.player_id ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                      <TableCell>
                        <img
                          src={tx.imageUrl}
                          alt="Receipt"
                          className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80"
                          onClick={() => setSelectedImage(tx.imageUrl)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950/30">
                          {tx.product_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={tx.player_id}
                          onChange={(e) => updateTempPlayerID(tx.id, e.target.value)}
                          placeholder={language === "ar" ? "أدخل رقم اللاعب" : "Enter player ID"}
                          className={`w-40 ${!tx.player_id ? "border-red-300 dark:border-red-700" : ""}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{tx.amount.toFixed(2)} SAR</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteTempTransaction(tx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Confirmed Transactions Summary */}
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

        {/* Confirmed Transactions Table */}
        {transactions.length > 0 ? (
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              {translations.confirmed} ({transactions.length})
            </h3>
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
          </div>
        ) : tempTransactions.length === 0 && (
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
