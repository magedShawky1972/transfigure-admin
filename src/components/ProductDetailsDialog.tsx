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

export const ProductDetailsDialog = ({ open, onOpenChange, productId, productName }: ProductDetailsDialogProps) => {
  const { t } = useLanguage();
  
  // Stock section
  const [quantity, setQuantity] = useState("1000");
  const [coinsNumber, setCoinsNumber] = useState("4000000");
  const [notifyQty, setNotifyQty] = useState("1");
  const [sku, setSku] = useState("S0028");
  const [minOrderQty, setMinOrderQty] = useState("1");
  const [maxOrderQty, setMaxOrderQty] = useState("10");
  const [minCoins, setMinCoins] = useState("0");
  const [maxCoins, setMaxCoins] = useState("0");
  
  // Pricing section
  const [costPrice, setCostPrice] = useState("2318.62");
  const [retailPrice, setRetailPrice] = useState("2702.8");
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
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {productName} - {t("productSetup.moreDetails")}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6">
            
            {/* Mobile Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <Label className="text-base font-semibold">Mobile</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {mobileEnabled ? "Enabled" : "Disabled"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={mobileEnabled ? "default" : "outline"}
                  onClick={() => setMobileEnabled(!mobileEnabled)}
                  className="w-16"
                >
                  {mobileEnabled ? "ON" : "OFF"}
                </Button>
              </div>
            </div>
            
            {/* Stock Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Stock</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Product quantity *</Label>
                  <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>coins_number.label</Label>
                  <Input value={coinsNumber} onChange={(e) => setCoinsNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Notify me when qty drops to *</Label>
                  <Input value={notifyQty} onChange={(e) => setNotifyQty(e.target.value)} />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Minimum order qty *</Label>
                  <Input value={minOrderQty} onChange={(e) => setMinOrderQty(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Max order qty *</Label>
                  <Input value={maxOrderQty} onChange={(e) => setMaxOrderQty(e.target.value)} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>min_coins.label *</Label>
                  <Input value={minCoins} onChange={(e) => setMinCoins(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>max_coins.label *</Label>
                  <Input value={maxCoins} onChange={(e) => setMaxCoins(e.target.value)} />
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Pricing Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cost price *</Label>
                  <Input value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Retail Price *</Label>
                  <Input value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Tax type</Label>
                <Select value={taxType} onValueChange={setTaxType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tax_included">tax_included</SelectItem>
                    <SelectItem value="tax_excluded">tax_excluded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Separator />
            
            {/* Free Coins Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">free_coins</h3>
              </div>
              {freeCoins.map((coin, index) => (
                <div key={index} className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg relative">
                  <div className="absolute -top-2 -right-2">
                    <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Label>product_coins_number.label</Label>
                    <Input 
                      placeholder="product_coins_number.placeholder"
                      value={coin.coins_number}
                      onChange={(e) => {
                        const updated = [...freeCoins];
                        updated[index].coins_number = e.target.value;
                        setFreeCoins(updated);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>product_coins_price.label</Label>
                    <Input 
                      placeholder="product_coins_price.placeholder"
                      value={coin.coins_price}
                      onChange={(e) => {
                        const updated = [...freeCoins];
                        updated[index].coins_price = e.target.value;
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
                      <X className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addFreeCoin} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Free Coin Tier
              </Button>
            </div>
            
            <Separator />
            
            {/* Options Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">options</h3>
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="h-4 w-4 mr-2" />
                  add_new_option
                </Button>
              </div>
              {options.map((option, index) => (
                <div key={index} className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg relative">
                  <div className="absolute -top-2 -right-2">
                    <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Label>option_id.label</Label>
                    <Select value={option.option_id} onValueChange={(value) => {
                      const updated = [...options];
                      updated[index].option_id = value;
                      setOptions(updated);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="text" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Account ID">Account ID</SelectItem>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="Phone">Phone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 flex items-center gap-2 mt-8">
                    <Checkbox 
                      id={`required-${index}`}
                      checked={option.required}
                      onCheckedChange={(checked) => {
                        const updated = [...options];
                        updated[index].required = checked as boolean;
                        setOptions(updated);
                      }}
                    />
                    <Label htmlFor={`required-${index}`}>required.label</Label>
                  </div>
                  {options.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="col-span-2"
                      onClick={() => removeOption(index)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            <Separator />
            
            {/* Customer Groups Prices Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">💰</span>
                  Prices
                </h3>
                <span className="text-sm text-muted-foreground">add_prices_points</span>
              </div>
              
              <div className="space-y-4">
                {customerGroupPrices.map((price, index) => (
                  <div key={index} className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <div className="grid grid-cols-7 gap-2 text-sm font-medium text-muted-foreground">
                      <div>اختر المجموعة</div>
                      <div>السعر</div>
                      <div>الكمية</div>
                      <div>اقل</div>
                      <div>أقصى</div>
                      <div>النقاط للبيع</div>
                      <div>النقاط للشراء</div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-2">
                      <Select value={price.group_name} onValueChange={(value) => {
                        const updated = [...customerGroupPrices];
                        updated[index].group_name = value;
                        setCustomerGroupPrices(updated);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر المجموعة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Groups</SelectItem>
                          <SelectItem value="vip">VIP</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <div className="flex gap-1">
                        <Input 
                          placeholder="السعر"
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
                          <SelectTrigger className="w-16">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="%">%</SelectItem>
                            <SelectItem value="fixed">Fixed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="text-center self-center text-muted-foreground">—</div>
                      
                      <Input 
                        placeholder="اقل"
                        value={price.min_quantity}
                        onChange={(e) => {
                          const updated = [...customerGroupPrices];
                          updated[index].min_quantity = e.target.value;
                          setCustomerGroupPrices(updated);
                        }}
                      />
                      
                      <Input 
                        placeholder="أقصى"
                        value={price.max_quantity}
                        onChange={(e) => {
                          const updated = [...customerGroupPrices];
                          updated[index].max_quantity = e.target.value;
                          setCustomerGroupPrices(updated);
                        }}
                      />
                      
                      <Input 
                        placeholder="النقاط للبيع"
                        value={price.sale_price}
                        onChange={(e) => {
                          const updated = [...customerGroupPrices];
                          updated[index].sale_price = e.target.value;
                          setCustomerGroupPrices(updated);
                        }}
                      />
                      
                      <Input 
                        placeholder="النقاط للشراء"
                        value={price.purchase_price}
                        onChange={(e) => {
                          const updated = [...customerGroupPrices];
                          updated[index].purchase_price = e.target.value;
                          setCustomerGroupPrices(updated);
                        }}
                      />
                    </div>
                    
                    {customerGroupPrices.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeCustomerGroupPrice(index)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addCustomerGroupPrice}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Price Tier
                </Button>
              </div>
            </div>
            
            <Separator />
            
            {/* Discounts Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-orange-600 dark:text-orange-400">🏷️</span>
                  discounts
                </h3>
                <span className="text-sm text-muted-foreground">اضف الخصومات لمجموعات التجزئة</span>
              </div>
              
              <div className="space-y-4">
                {discounts.map((discount, index) => (
                  <div key={index} className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <div className="grid grid-cols-6 gap-2 text-sm font-medium text-muted-foreground">
                      <div>select_store</div>
                      <div>اختر المجموعة</div>
                      <div>amount_type.label</div>
                      <div>السعر</div>
                      <div>تاريخ البدء</div>
                      <div>تاريخ الانتهاء</div>
                    </div>
                    
                    <div className="grid grid-cols-6 gap-2">
                      <Select value={discount.store} onValueChange={(value) => {
                        const updated = [...discounts];
                        updated[index].store = value;
                        setDiscounts(updated);
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="purple_store">purple_store</SelectItem>
                          <SelectItem value="ish7en_store">ish7en_store</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Select value={discount.group_name} onValueChange={(value) => {
                        const updated = [...discounts];
                        updated[index].group_name = value;
                        setDiscounts(updated);
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_customers_groups">all_customers_groups</SelectItem>
                          <SelectItem value="vip">VIP</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Select value={discount.amount_type} onValueChange={(value) => {
                        const updated = [...discounts];
                        updated[index].amount_type = value;
                        setDiscounts(updated);
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">fixed</SelectItem>
                          <SelectItem value="percentage">percentage</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Input 
                        placeholder="السعر"
                        value={discount.amount}
                        onChange={(e) => {
                          const updated = [...discounts];
                          updated[index].amount = e.target.value;
                          setDiscounts(updated);
                        }}
                      />
                      
                      <Input 
                        type="date"
                        value={discount.start_date}
                        onChange={(e) => {
                          const updated = [...discounts];
                          updated[index].start_date = e.target.value;
                          setDiscounts(updated);
                        }}
                      />
                      
                      <Input 
                        type="date"
                        value={discount.end_date}
                        onChange={(e) => {
                          const updated = [...discounts];
                          updated[index].end_date = e.target.value;
                          setDiscounts(updated);
                        }}
                      />
                    </div>
                    
                    {discounts.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeDiscount(index)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addDiscount}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Discount
                </Button>
              </div>
            </div>
            
            <Separator />
            
            {/* SEO Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Prepare SEO</h3>
              
              <Tabs defaultValue="arabic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="arabic">العربية</TabsTrigger>
                  <TabsTrigger value="english">English</TabsTrigger>
                </TabsList>
                
                <TabsContent value="arabic" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Meta title (العربية) *</Label>
                    <Input 
                      value={metaTitleAr}
                      onChange={(e) => setMetaTitleAr(e.target.value)}
                      placeholder="أرخص سعر - بطرول كارد SoulFree Coins | شحن كوينز سول فري"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Meta keywords (العربية)</Label>
                    <Textarea 
                      value={metaKeywordsAr}
                      onChange={(e) => setMetaKeywordsAr(e.target.value)}
                      placeholder="ي, كوينز سول فري, سول فري شحن, شراء عملات سول فري, تطبيق"
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Meta description (العربية)</Label>
                    <Textarea 
                      value={metaDescriptionAr}
                      onChange={(e) => setMetaDescriptionAr(e.target.value)}
                      placeholder="بأفضل سعر وتسليم فوري. (SoulFree Coins) شحن كوينز سول فري اشحن غير الايدي من بطرول وادعم المشفعين في الرومات الصوتيه. شحن آمن ومضمون"
                      rows={3}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="english" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Meta title (English) *</Label>
                    <Input 
                      value={metaTitleEn}
                      onChange={(e) => setMetaTitleEn(e.target.value)}
                      placeholder="Best Price - SoulFree Coins Card | Recharge Soul Free"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Meta keywords (English)</Label>
                    <Textarea 
                      value={metaKeywordsEn}
                      onChange={(e) => setMetaKeywordsEn(e.target.value)}
                      placeholder="soul free coins, soul free recharge, buy soul free currency, app"
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Meta description (English)</Label>
                    <Textarea 
                      value={metaDescriptionEn}
                      onChange={(e) => setMetaDescriptionEn(e.target.value)}
                      placeholder="Best price and instant delivery. Recharge SoulFree Coins to support influencers in voice rooms. Safe and secure."
                      rows={3}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </ScrollArea>
        
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
