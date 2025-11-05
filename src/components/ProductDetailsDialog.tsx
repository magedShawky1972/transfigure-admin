import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface ProductDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productPrice: string | null;
  productCost: string | null;
}

interface FreeCoin {
  coins_number: string;
  coins_price: string;
}

interface ProductOption {
  option_id: string;
  required: boolean;
}

interface CustomerGroupPrice {
  group_name: string;
  price: string;
  discount_type: string;
  min_quantity: string;
  max_quantity: string;
  sale_price: string;
  purchase_price: string;
}

interface Discount {
  store: string;
  group_name: string;
  amount_type: string;
  amount: string;
  start_date: string;
  end_date: string;
}

export const ProductDetailsDialog = ({ open, onOpenChange, productId, productName, productPrice, productCost }: ProductDetailsDialogProps) => {
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  
  // Stock section
  const [quantity, setQuantity] = useState("1000");
  const [coinsNumber, setCoinsNumber] = useState("4000000");
  const [notifyQty, setNotifyQty] = useState("1");
  const [sku, setSku] = useState("S0028");
  const [minOrderQty, setMinOrderQty] = useState("1");
  const [maxOrderQty, setMaxOrderQty] = useState("10");
  const [minCoins, setMinCoins] = useState("0");
  const [maxCoins, setMaxCoins] = useState("0");
  
  // Pricing section - initialized with actual product data
  const [costPrice, setCostPrice] = useState(productCost || "");
  const [retailPrice, setRetailPrice] = useState(productPrice || "");
  const [taxType, setTaxType] = useState("tax_included");
  
  // Free coins section
  const [freeCoins, setFreeCoins] = useState<FreeCoin[]>([
    { coins_number: "", coins_price: "" }
  ]);
  
  // Options section
  const [options, setOptions] = useState<ProductOption[]>([
    { option_id: "Account ID", required: true }
  ]);
  
  // Customer group prices
  const [customerGroupPrices, setCustomerGroupPrices] = useState<CustomerGroupPrice[]>([
    { group_name: "", price: "", discount_type: "%", min_quantity: "", max_quantity: "", sale_price: "", purchase_price: "" }
  ]);
  
  // Discounts
  const [discounts, setDiscounts] = useState<Discount[]>([
    { store: "purple_store", group_name: "all_customers_groups", amount_type: "fixed", amount: "81.08", start_date: "2025-09-22", end_date: "2025-09-30" }
  ]);
  
  // SEO section
  const [metaTitleAr, setMetaTitleAr] = useState("");
  const [metaKeywordsAr, setMetaKeywordsAr] = useState("");
  const [metaDescriptionAr, setMetaDescriptionAr] = useState("");
  const [metaTitleEn, setMetaTitleEn] = useState("");
  const [metaKeywordsEn, setMetaKeywordsEn] = useState("");
  const [metaDescriptionEn, setMetaDescriptionEn] = useState("");
  
  const [mobileEnabled, setMobileEnabled] = useState(true);
  
  const addFreeCoin = () => {
    setFreeCoins([...freeCoins, { coins_number: "", coins_price: "" }]);
  };
  
  const removeFreeCoin = (index: number) => {
    setFreeCoins(freeCoins.filter((_, i) => i !== index));
  };
  
  const addOption = () => {
    setOptions([...options, { option_id: "", required: false }]);
  };
  
  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };
  
  const addCustomerGroupPrice = () => {
    setCustomerGroupPrices([...customerGroupPrices, { group_name: "", price: "", discount_type: "%", min_quantity: "", max_quantity: "", sale_price: "", purchase_price: "" }]);
  };
  
  const removeCustomerGroupPrice = (index: number) => {
    setCustomerGroupPrices(customerGroupPrices.filter((_, i) => i !== index));
  };
  
  const addDiscount = () => {
    setDiscounts([...discounts, { store: "purple_store", group_name: "all_customers_groups", amount_type: "fixed", amount: "", start_date: "", end_date: "" }]);
  };
  
  const removeDiscount = (index: number) => {
    setDiscounts(discounts.filter((_, i) => i !== index));
  };
  
  const handleSave = () => {
    // TODO: Implement save logic
    console.log("Saving product details...");
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className={`text-2xl ${isRTL ? 'text-right' : ''}`}>
            {productName} - {t("productSetup.moreDetails")}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6">
            
            {/* Mobile Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <Label className="text-base font-semibold">{t("productSetup.mobile")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {mobileEnabled ? t("productSetup.enabled") : t("productSetup.disabled")}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={mobileEnabled ? "default" : "outline"}
                  onClick={() => setMobileEnabled(!mobileEnabled)}
                  className="w-16"
                >
                  {mobileEnabled ? t("productSetup.on") : t("productSetup.off")}
                </Button>
              </div>
            </div>
            
            {/* Stock Section */}
            <div className="space-y-4">
              <h3 className={`text-lg font-semibold border-b pb-2 ${isRTL ? 'text-right' : ''}`}>{t("productSetup.stock")}</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.quantity")} *</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)} 
                    placeholder={t("productSetup.quantityPlaceholder")} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.coinsGiven")}</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={coinsNumber} 
                    onChange={(e) => setCoinsNumber(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.notifyQty")} *</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={notifyQty} 
                    onChange={(e) => setNotifyQty(e.target.value)} 
                    placeholder={t("productSetup.notifyQtyPlaceholder")} 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.sku")} *</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={sku} 
                    onChange={(e) => setSku(e.target.value)} 
                    placeholder={t("productSetup.skuPlaceholder")} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.minQuantity")} *</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={minOrderQty} 
                    onChange={(e) => setMinOrderQty(e.target.value)} 
                    placeholder={t("productSetup.minQuantityPlaceholder")} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.maxQuantity")} *</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={maxOrderQty} 
                    onChange={(e) => setMaxOrderQty(e.target.value)} 
                    placeholder={t("productSetup.maxQuantityPlaceholder")} 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.minCoins")} *</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={minCoins} 
                    onChange={(e) => setMinCoins(e.target.value)} 
                    placeholder={t("productSetup.minCoinsPlaceholder")} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.maxCoins")} *</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={maxCoins} 
                    onChange={(e) => setMaxCoins(e.target.value)} 
                    placeholder={t("productSetup.maxCoinsPlaceholder")} 
                  />
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Pricing Section */}
            <div className="space-y-4">
              <h3 className={`text-lg font-semibold border-b pb-2 ${isRTL ? 'text-right' : ''}`}>{t("productSetup.pricing")}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.productCost")} *</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={costPrice} 
                    onChange={(e) => setCostPrice(e.target.value)} 
                    placeholder={t("productSetup.productCostPlaceholder")} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.productPrice")} *</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={retailPrice} 
                    onChange={(e) => setRetailPrice(e.target.value)} 
                    placeholder={t("productSetup.productPricePlaceholder")} 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.taxClass")}</Label>
                <Select value={taxType} onValueChange={setTaxType}>
                  <SelectTrigger className={isRTL ? 'justify-end text-right' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tax_included">{t("productSetup.taxIncluded")}</SelectItem>
                    <SelectItem value="tax_excluded">{t("productSetup.taxExcluded")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Separator />
            
            {/* Free Coins Section */}
            <div className="space-y-4">
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h3 className={`text-lg font-semibold ${isRTL ? 'text-right' : ''}`}>{t("productSetup.freeCoins")}</h3>
              </div>
              {freeCoins.map((coin, index) => (
                <div key={index} className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg relative">
                  <div className={`absolute ${isRTL ? '-top-2 -left-2' : '-top-2 -right-2'}`}>
                    <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.productPrice")}</Label>
                    <Input 
                      className={isRTL ? 'text-right' : ''} 
                      placeholder={t("productSetup.productPricePlaceholder")}
                      value={coin.coins_price}
                      onChange={(e) => {
                        const updated = [...freeCoins];
                        updated[index].coins_price = e.target.value;
                        setFreeCoins(updated);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.coinsGiven")}</Label>
                    <Input 
                      className={isRTL ? 'text-right' : ''} 
                      placeholder={t("productSetup.coinsGivenPlaceholder")}
                      value={coin.coins_number}
                      onChange={(e) => {
                        const updated = [...freeCoins];
                        updated[index].coins_number = e.target.value;
                        setFreeCoins(updated);
                      }}
                    />
                  </div>
                  {freeCoins.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="col-span-2"
                      onClick={() => removeFreeCoin(index)}
                    >
                      <X className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t("common.cancel")}
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addFreeCoin} className="w-full">
                <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t("productSetup.addOption")}
              </Button>
            </div>
            
            <Separator />
            
            {/* Options Section */}
            <div className="space-y-4">
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h3 className={`text-lg font-semibold ${isRTL ? 'text-right' : ''}`}>{t("productSetup.options")}</h3>
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t("productSetup.addOption")}
                </Button>
              </div>
              {options.map((option, index) => (
                <div key={index} className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg relative">
                  <div className={`absolute ${isRTL ? '-top-2 -left-2' : '-top-2 -right-2'}`}>
                    <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.required")}</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Checkbox 
                        id={`required-${index}`}
                        checked={option.required}
                        onCheckedChange={(checked) => {
                          const updated = [...options];
                          updated[index].required = checked as boolean;
                          setOptions(updated);
                        }}
                      />
                      <Label htmlFor={`required-${index}`} className="text-sm font-normal">{t("productSetup.required")}</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.optionName")}</Label>
                    <Select value={option.option_id} onValueChange={(value) => {
                      const updated = [...options];
                      updated[index].option_id = value;
                      setOptions(updated);
                    }}>
                      <SelectTrigger className={isRTL ? 'justify-end text-right' : ''}>
                        <SelectValue placeholder={t("productSetup.optionNamePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Account ID">Account ID</SelectItem>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="Phone">Phone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {options.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="col-span-2"
                      onClick={() => removeOption(index)}
                    >
                      <X className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t("common.cancel")}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            <Separator />
            
            {/* Customer Groups Prices Section */}
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-4 bg-muted/50 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h3 className={`text-lg font-semibold ${isRTL ? 'text-right' : ''}`}>{t("productSetup.customerGroupPrices")}</h3>
              </div>
              
              <div className="space-y-4">
                {customerGroupPrices.map((price, index) => (
                  <div key={index} className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <div className={`grid grid-cols-7 gap-2 text-sm font-medium text-muted-foreground ${isRTL ? 'text-right' : ''}`}>
                      <div>{t("productSetup.purchasePoints")}</div>
                      <div>{t("productSetup.salePoints")}</div>
                      <div>{t("productSetup.max")}</div>
                      <div>{t("productSetup.min")}</div>
                      <div>{t("productSetup.quantity")}</div>
                      <div>{t("productSetup.groupPrice")}</div>
                      <div>{t("productSetup.customerGroup")}</div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-2">
                      <Input 
                        className={isRTL ? 'text-right' : ''} 
                        placeholder={t("productSetup.purchasePoints")} 
                        value={price.purchase_price} 
                        onChange={(e) => {
                          const updated = [...customerGroupPrices];
                          updated[index].purchase_price = e.target.value;
                          setCustomerGroupPrices(updated);
                        }} 
                      />
                      <Input 
                        className={isRTL ? 'text-right' : ''} 
                        placeholder={t("productSetup.salePoints")} 
                        value={price.sale_price} 
                        onChange={(e) => {
                          const updated = [...customerGroupPrices];
                          updated[index].sale_price = e.target.value;
                          setCustomerGroupPrices(updated);
                        }} 
                      />
                      <Input 
                        className={isRTL ? 'text-right' : ''} 
                        placeholder={t("productSetup.max")} 
                        value={price.max_quantity} 
                        onChange={(e) => {
                          const updated = [...customerGroupPrices];
                          updated[index].max_quantity = e.target.value;
                          setCustomerGroupPrices(updated);
                        }} 
                      />
                      <Input 
                        className={isRTL ? 'text-right' : ''} 
                        placeholder={t("productSetup.min")} 
                        value={price.min_quantity} 
                        onChange={(e) => {
                          const updated = [...customerGroupPrices];
                          updated[index].min_quantity = e.target.value;
                          setCustomerGroupPrices(updated);
                        }} 
                      />
                      <Input 
                        className={isRTL ? 'text-right' : ''} 
                        placeholder={t("productSetup.quantityPlaceholder")} 
                      />
                      
                      <div className="flex gap-1">
                        <Input 
                          className={isRTL ? 'text-right' : ''} 
                          placeholder={t("productSetup.groupPricePlaceholder")}
                          value={price.price}
                          onChange={(e) => {
                            const updated = [...customerGroupPrices];
                            updated[index].price = e.target.value;
                            setCustomerGroupPrices(updated);
                          }}
                        />
                        <Select value={price.discount_type} onValueChange={(value) => {
                          const updated = [...customerGroupPrices];
                          updated[index].discount_type = value;
                          setCustomerGroupPrices(updated);
                        }}>
                          <SelectTrigger className={`w-16 ${isRTL ? 'justify-end text-right' : ''}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="%">%</SelectItem>
                            <SelectItem value="fixed">Fixed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Select value={price.group_name} onValueChange={(value) => {
                        const updated = [...customerGroupPrices];
                        updated[index].group_name = value;
                        setCustomerGroupPrices(updated);
                      }}>
                        <SelectTrigger className={isRTL ? 'justify-end text-right' : ''}>
                          <SelectValue placeholder={t("productSetup.customerGroupPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("productSetup.allGroups")}</SelectItem>
                          <SelectItem value="vip">{t("productSetup.vip")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {customerGroupPrices.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeCustomerGroupPrice(index)}
                      >
                        <X className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {t("common.cancel")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              <Button type="button" variant="outline" onClick={addCustomerGroupPrice} className="w-full">
                <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t("productSetup.addGroupPrice")}
              </Button>
            </div>
            
            <Separator />
            
            {/* Discounts Section */}
            <div className="space-y-4">
              <h3 className={`text-lg font-semibold border-b pb-2 ${isRTL ? 'text-right' : ''}`}>{t("productSetup.discounts")}</h3>
              
              {discounts.map((discount, index) => (
                <div key={index} className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.store")}</Label>
                      <Select value={discount.store} onValueChange={(value) => {
                        const updated = [...discounts];
                        updated[index].store = value;
                        setDiscounts(updated);
                      }}>
                        <SelectTrigger className={isRTL ? 'justify-end text-right' : ''}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="purple_store">{t("productSetup.purpleStore")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.discountGroup")}</Label>
                      <Select value={discount.group_name} onValueChange={(value) => {
                        const updated = [...discounts];
                        updated[index].group_name = value;
                        setDiscounts(updated);
                      }}>
                        <SelectTrigger className={isRTL ? 'justify-end text-right' : ''}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_customers_groups">{t("productSetup.allCustomerGroups")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.discountPrice")}</Label>
                      <div className="flex gap-2">
                        <Input 
                          className={isRTL ? 'text-right' : ''} 
                          placeholder={t("productSetup.discountPricePlaceholder")}
                          value={discount.amount}
                          onChange={(e) => {
                            const updated = [...discounts];
                            updated[index].amount = e.target.value;
                            setDiscounts(updated);
                          }}
                        />
                        <Select value={discount.amount_type} onValueChange={(value) => {
                          const updated = [...discounts];
                          updated[index].amount_type = value;
                          setDiscounts(updated);
                        }}>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">{t("productSetup.fixed")}</SelectItem>
                            <SelectItem value="%">{t("productSetup.percentage")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.discountStartDate")}</Label>
                      <Input 
                        className={isRTL ? 'text-right' : ''} 
                        type="date"
                        value={discount.start_date}
                        onChange={(e) => {
                          const updated = [...discounts];
                          updated[index].start_date = e.target.value;
                          setDiscounts(updated);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.discountEndDate")}</Label>
                      <Input 
                        className={isRTL ? 'text-right' : ''} 
                        type="date"
                        value={discount.end_date}
                        onChange={(e) => {
                          const updated = [...discounts];
                          updated[index].end_date = e.target.value;
                          setDiscounts(updated);
                        }}
                      />
                    </div>
                  </div>
                  
                  {discounts.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeDiscount(index)}
                    >
                      <X className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t("common.cancel")}
                    </Button>
                  )}
                </div>
              ))}
              
              <Button type="button" variant="outline" onClick={addDiscount} className="w-full">
                <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t("productSetup.addDiscount")}
              </Button>
            </div>
            
            <Separator />
            
            {/* SEO Section */}
            <div className="space-y-4">
              <h3 className={`text-lg font-semibold border-b pb-2 ${isRTL ? 'text-right' : ''}`}>{t("productSetup.seo")}</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaTitle")} (AR)</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={metaTitleAr}
                    onChange={(e) => setMetaTitleAr(e.target.value)}
                    placeholder={t("productSetup.metaTitlePlaceholder")}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaKeywords")} (AR)</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={metaKeywordsAr}
                    onChange={(e) => setMetaKeywordsAr(e.target.value)}
                    placeholder={t("productSetup.metaKeywordsPlaceholder")}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaDescription")} (AR)</Label>
                  <Textarea 
                    className={isRTL ? 'text-right' : ''} 
                    value={metaDescriptionAr}
                    onChange={(e) => setMetaDescriptionAr(e.target.value)}
                    placeholder={t("productSetup.metaDescriptionPlaceholder")}
                    rows={3}
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaTitle")} (EN)</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={metaTitleEn}
                    onChange={(e) => setMetaTitleEn(e.target.value)}
                    placeholder={t("productSetup.metaTitlePlaceholder")}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaKeywords")} (EN)</Label>
                  <Input 
                    className={isRTL ? 'text-right' : ''} 
                    value={metaKeywordsEn}
                    onChange={(e) => setMetaKeywordsEn(e.target.value)}
                    placeholder={t("productSetup.metaKeywordsPlaceholder")}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaDescription")} (EN)</Label>
                  <Textarea 
                    className={isRTL ? 'text-right' : ''} 
                    value={metaDescriptionEn}
                    onChange={(e) => setMetaDescriptionEn(e.target.value)}
                    placeholder={t("productSetup.metaDescriptionPlaceholder")}
                    rows={3}
                  />
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} justify-end gap-2 pt-4 border-t`}>
              <Button type="button" onClick={handleSave}>
                {t("productSetup.save")}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
