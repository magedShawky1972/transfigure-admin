import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Mail, Bell, Link2, Database, Key, Plus, Trash2, Copy, MessageCircle, Save, Clock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConfigItem {
  name: string;
  description: string;
  usedIn: string[];
  icon: any;
  category: string;
  secretType?: string;
}

interface SecretValues {
  [key: string]: Record<string, string>;
}

interface ApiKey {
  id: string;
  api_key: string;
  description: string;
  is_active: boolean;
  allow_sales_header: boolean;
  allow_sales_line: boolean;
  allow_payment: boolean;
  allow_customer: boolean;
  allow_supplier: boolean;
  allow_supplier_product: boolean;
  allow_brand: boolean;
  allow_product: boolean;
  created_at: string;
}

interface WhatsAppConfig {
  id?: string;
  mobile_number: string;
  webhook_url: string;
  status_callback_url: string;
  is_active: boolean;
}

interface IdleTimeoutConfig {
  enabled: boolean;
  timeout_minutes: number;
}

const SystemConfig = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState({
    allow_sales_header: false,
    allow_sales_line: false,
    allow_payment: false,
    allow_customer: false,
    allow_supplier: false,
    allow_supplier_product: false,
    allow_brand: false,
    allow_product: false,
  });
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig>({
    mobile_number: "",
    webhook_url: "",
    status_callback_url: "",
    is_active: true,
  });
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [idleTimeoutConfig, setIdleTimeoutConfig] = useState<IdleTimeoutConfig>({
    enabled: true,
    timeout_minutes: 30,
  });
  const [savingIdleTimeout, setSavingIdleTimeout] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [secretValues, setSecretValues] = useState<SecretValues>({});
  const [loadingSecrets, setLoadingSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    checkAdminAccess();
    loadApiKeys();
    loadWhatsappConfig();
    loadIdleTimeoutConfig();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError || !roleData) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadApiKeys = async () => {
    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading API keys:", error);
      return;
    }

    setApiKeys(data || []);
  };

  const loadWhatsappConfig = async () => {
    const { data, error } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Error loading WhatsApp config:", error);
      return;
    }

    if (data) {
      setWhatsappConfig({
        id: data.id,
        mobile_number: data.mobile_number || "",
        webhook_url: data.webhook_url || "",
        status_callback_url: data.status_callback_url || "",
        is_active: data.is_active,
      });
    }
  };

  const handleSaveWhatsappConfig = async () => {
    if (!whatsappConfig.mobile_number.trim()) {
      toast({
        title: "Error",
        description: "Please enter a mobile number",
        variant: "destructive",
      });
      return;
    }

    setSavingWhatsapp(true);
    try {
      if (whatsappConfig.id) {
        // Update existing
        const { error } = await supabase
          .from("whatsapp_config")
          .update({
            mobile_number: whatsappConfig.mobile_number,
            webhook_url: whatsappConfig.webhook_url,
            status_callback_url: whatsappConfig.status_callback_url,
          })
          .eq("id", whatsappConfig.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("whatsapp_config")
          .insert({
            mobile_number: whatsappConfig.mobile_number,
            webhook_url: whatsappConfig.webhook_url,
            status_callback_url: whatsappConfig.status_callback_url,
            is_active: true,
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "WhatsApp configuration saved successfully",
      });
      loadWhatsappConfig();
    } catch (error) {
      console.error("Error saving WhatsApp config:", error);
      toast({
        title: "Error",
        description: "Failed to save WhatsApp configuration",
        variant: "destructive",
      });
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const loadIdleTimeoutConfig = async () => {
    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .eq("setting_key", "idle_timeout")
      .maybeSingle();

    if (error) {
      console.error("Error loading idle timeout config:", error);
      return;
    }

    if (data && data.setting_value) {
      const value = data.setting_value as unknown as IdleTimeoutConfig;
      setIdleTimeoutConfig({
        enabled: value.enabled ?? true,
        timeout_minutes: value.timeout_minutes ?? 30,
      });
    }
  };

  const handleSaveIdleTimeoutConfig = async () => {
    setSavingIdleTimeout(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("setting_key", "idle_timeout")
        .maybeSingle();

      const settingValueJson = { enabled: idleTimeoutConfig.enabled, timeout_minutes: idleTimeoutConfig.timeout_minutes };

      if (existing) {
        const { error } = await supabase
          .from("system_settings")
          .update({
            setting_value: settingValueJson,
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", "idle_timeout");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_settings")
          .insert([{
            setting_key: "idle_timeout",
            setting_value: settingValueJson,
          }]);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Idle timeout configuration saved successfully",
      });
    } catch (error) {
      console.error("Error saving idle timeout config:", error);
      toast({
        title: "Error",
        description: "Failed to save idle timeout configuration",
        variant: "destructive",
      });
    } finally {
      setSavingIdleTimeout(false);
    }
  };

  const generateApiKey = () => {
    return `ek_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  };

  const handleCreateApiKey = async () => {
    if (!description.trim()) {
      toast({
        title: "Error",
        description: "Please enter a description for the API key",
        variant: "destructive",
      });
      return;
    }

    const newApiKey = generateApiKey();

    const { error } = await supabase.from("api_keys").insert({
      api_key: newApiKey,
      description: description.trim(),
      ...permissions,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "API key created successfully",
    });

    setDescription("");
    setPermissions({
      allow_sales_header: false,
      allow_sales_line: false,
      allow_payment: false,
      allow_customer: false,
      allow_supplier: false,
      allow_supplier_product: false,
      allow_brand: false,
      allow_product: false,
    });
    loadApiKeys();
  };

  const handleDeleteApiKey = async (id: string) => {
    const { error } = await supabase.from("api_keys").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "API key deleted successfully",
    });

    loadApiKeys();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  const toggleSecretVisibility = async (secretType: string) => {
    if (visibleSecrets[secretType]) {
      setVisibleSecrets({ ...visibleSecrets, [secretType]: false });
      return;
    }

    // If we already have the values, just show them
    if (secretValues[secretType]) {
      setVisibleSecrets({ ...visibleSecrets, [secretType]: true });
      return;
    }

    // Fetch the secrets from the edge function
    setLoadingSecrets({ ...loadingSecrets, [secretType]: true });
    try {
      const { data, error } = await supabase.functions.invoke("get-system-secrets", {
        body: { secretType },
      });

      if (error) throw error;

      setSecretValues({ ...secretValues, [secretType]: data.secrets });
      setVisibleSecrets({ ...visibleSecrets, [secretType]: true });
    } catch (error) {
      console.error("Error fetching secrets:", error);
      toast({
        title: "Error",
        description: "Failed to fetch secret values",
        variant: "destructive",
      });
    } finally {
      setLoadingSecrets({ ...loadingSecrets, [secretType]: false });
    }
  };

  const renderSecretValues = (secretType: string) => {
    if (!visibleSecrets[secretType] || !secretValues[secretType]) return null;
    
    const secrets = secretValues[secretType];
    return (
      <div className="mt-4 p-3 bg-muted/50 rounded-lg border space-y-2">
        <h5 className="font-medium text-sm text-muted-foreground mb-2">Secret Values:</h5>
        {Object.entries(secrets).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <code className="text-xs font-semibold text-primary">{key}:</code>
            <code className="text-xs bg-background px-2 py-1 rounded font-mono flex-1 break-all" dir="ltr">
              {value}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(value)}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  const configurations: ConfigItem[] = [
    {
      name: "VAPID Keys",
      description: "Web Push notification keys for browser push notifications. VAPID (Voluntary Application Server Identification) keys authenticate your server when sending push notifications.",
      usedIn: ["send-push-notification", "Frontend push subscription"],
      icon: Bell,
      category: "Push Notifications",
      secretType: "vapid"
    },
    {
      name: "ODOO API Configuration",
      description: "Odoo ERP system integration credentials. Used to sync customers and products between your app and Odoo ERP system.",
      usedIn: ["sync-customer-to-odoo", "sync-product-to-odoo"],
      icon: Link2,
      category: "External Integration",
      secretType: "odoo"
    },
    {
      name: "SMTP Configuration",
      description: "SMTP server credentials for sending email notifications. Used for ticket notifications and user communications.",
      usedIn: ["send-ticket-notification"],
      icon: Mail,
      category: "Email Services",
      secretType: "smtp"
    },
    {
      name: "Resend API Key",
      description: "Resend email service API key for transactional emails. Alternative email delivery service with better deliverability.",
      usedIn: ["send-ticket-notification (alternative)"],
      icon: Mail,
      category: "Email Services",
      secretType: "resend"
    },
    {
      name: "Supabase Configuration",
      description: "Auto-configured Lovable Cloud credentials. These are automatically managed and include database URL, service role key, and anon key.",
      usedIn: ["All edge functions", "Frontend authentication", "Database operations"],
      icon: Database,
      category: "Backend Infrastructure",
      secretType: "supabase"
    },
    {
      name: "Twilio WhatsApp Configuration",
      description: "Twilio API credentials for WhatsApp messaging. Used for sending and receiving WhatsApp messages through the Twilio Sandbox.",
      usedIn: ["twilio-webhook", "send-whatsapp-message"],
      icon: MessageCircle,
      category: "Messaging Services",
      secretType: "twilio"
    },
    {
      name: "Cloudinary Configuration",
      description: "Cloudinary media management credentials. Used for uploading and managing images and media files in the cloud.",
      usedIn: ["upload-to-cloudinary", "migrate-shift-images-to-cloudinary"],
      icon: Database,
      category: "Media Storage",
      secretType: "cloudinary"
    }
  ];

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">System Configuration</h1>
          <p className="text-muted-foreground">
            Security keys and API configurations used across the application
          </p>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Security Notice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Secret values are securely stored and encrypted in the backend. 
            As an admin, you can click the "Show" button on each configuration card 
            to reveal the stored secret values. Handle these values with care.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {configurations.map((config, index) => {
          const Icon = config.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{config.name}</CardTitle>
                      <Badge variant="outline" className="mt-2">
                        {config.category}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {config.secretType && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSecretVisibility(config.secretType!)}
                        disabled={loadingSecrets[config.secretType]}
                        className="gap-2"
                      >
                        {loadingSecrets[config.secretType] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : visibleSecrets[config.secretType] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        {visibleSecrets[config.secretType] ? "Hide" : "Show"}
                      </Button>
                    )}
                    <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                      Configured
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm mb-2">Used In</h4>
                  <div className="flex flex-wrap gap-2">
                    {config.usedIn.map((usage, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono text-xs">
                        {usage}
                      </Badge>
                    ))}
                  </div>
                </div>

                {config.secretType && renderSecretValues(config.secretType)}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Configuration Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To update or modify these configurations, contact your system administrator or 
            update the secrets through the backend configuration panel. Changes to secrets 
            require edge function redeployment to take effect.
          </p>
        </CardContent>
      </Card>

      {/* API Key Management Section */}
      <div className="space-y-6 mt-8">
        <div className="flex items-center gap-3">
          <Key className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">API Key Management</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate New API Key</CardTitle>
            <CardDescription>
              Create an API key with specific endpoint permissions for E-Commerce integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Salla E-Commerce Integration"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="max-w-md"
              />
            </div>

            <div className="space-y-2">
              <Label>API Endpoint Permissions</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sales_header"
                    checked={permissions.allow_sales_header}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, allow_sales_header: checked as boolean })
                    }
                  />
                  <Label htmlFor="sales_header" className="cursor-pointer text-sm">
                    Sales Header
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sales_line"
                    checked={permissions.allow_sales_line}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, allow_sales_line: checked as boolean })
                    }
                  />
                  <Label htmlFor="sales_line" className="cursor-pointer text-sm">
                    Sales Line
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="payment"
                    checked={permissions.allow_payment}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, allow_payment: checked as boolean })
                    }
                  />
                  <Label htmlFor="payment" className="cursor-pointer text-sm">
                    Payment
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="customer"
                    checked={permissions.allow_customer}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, allow_customer: checked as boolean })
                    }
                  />
                  <Label htmlFor="customer" className="cursor-pointer text-sm">
                    Customer
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="supplier"
                    checked={permissions.allow_supplier}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, allow_supplier: checked as boolean })
                    }
                  />
                  <Label htmlFor="supplier" className="cursor-pointer text-sm">
                    Supplier
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="supplier_product"
                    checked={permissions.allow_supplier_product}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, allow_supplier_product: checked as boolean })
                    }
                  />
                  <Label htmlFor="supplier_product" className="cursor-pointer text-sm">
                    Supplier Product
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="brand"
                    checked={permissions.allow_brand}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, allow_brand: checked as boolean })
                    }
                  />
                  <Label htmlFor="brand" className="cursor-pointer text-sm">
                    Brand
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="product"
                    checked={permissions.allow_product}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, allow_product: checked as boolean })
                    }
                  />
                  <Label htmlFor="product" className="cursor-pointer text-sm">
                    Product
                  </Label>
                </div>
              </div>
            </div>

            <Button onClick={handleCreateApiKey} className="gap-2">
              <Plus className="h-4 w-4" />
              Generate API Key
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generated API Keys</CardTitle>
            <CardDescription>
              Manage your API keys and their permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No API keys generated yet</p>
                <p className="text-sm">Create your first API key to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div key={key.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{key.description}</h3>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              key.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {key.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {key.api_key}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(key.api_key)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteApiKey(key.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {key.allow_sales_header && (
                        <span className="bg-primary/10 px-2 py-1 rounded">Sales Header</span>
                      )}
                      {key.allow_sales_line && (
                        <span className="bg-primary/10 px-2 py-1 rounded">Sales Line</span>
                      )}
                      {key.allow_payment && (
                        <span className="bg-primary/10 px-2 py-1 rounded">Payment</span>
                      )}
                      {key.allow_customer && (
                        <span className="bg-primary/10 px-2 py-1 rounded">Customer</span>
                      )}
                      {key.allow_supplier && (
                        <span className="bg-primary/10 px-2 py-1 rounded">Supplier</span>
                      )}
                      {key.allow_supplier_product && (
                        <span className="bg-primary/10 px-2 py-1 rounded">Supplier Product</span>
                      )}
                      {key.allow_brand && (
                        <span className="bg-primary/10 px-2 py-1 rounded">Brand</span>
                      )}
                      {key.allow_product && (
                        <span className="bg-primary/10 px-2 py-1 rounded">Product</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(key.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp Configuration Section */}
      <div className="space-y-6 mt-8">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">WhatsApp Configuration</h2>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Twilio Webhook URLs</CardTitle>
            <CardDescription>
              Copy these URLs to your Twilio WhatsApp Sandbox Configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>When a message comes in (POST)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-muted px-3 py-2 rounded font-mono break-all" dir="ltr">
                  https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1/twilio-webhook
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText("https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1/twilio-webhook");
                    toast({ title: "Copied", description: "POST webhook URL copied to clipboard" });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Method: POST - Use this URL in Twilio's "When a message comes in" field
              </p>
            </div>

            <div className="space-y-2">
              <Label>Status Callback URL (GET)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-muted px-3 py-2 rounded font-mono break-all" dir="ltr">
                  https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1/twilio-webhook
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText("https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1/twilio-webhook");
                    toast({ title: "Copied", description: "GET callback URL copied to clipboard" });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Method: GET - Use this URL in Twilio's "Status callback URL" field
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Twilio WhatsApp Sandbox Settings</CardTitle>
            <CardDescription>
              Store your Twilio WhatsApp sandbox settings for reference
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp_mobile">Sandbox Mobile Number</Label>
              <Input
                id="whatsapp_mobile"
                placeholder="e.g., +14155238886"
                value={whatsappConfig.mobile_number}
                onChange={(e) =>
                  setWhatsappConfig({ ...whatsappConfig, mobile_number: e.target.value })
                }
                className="max-w-md"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                Your Twilio WhatsApp sandbox number (e.g., +14155238886)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook_url">Webhook URL (Reference)</Label>
              <Input
                id="webhook_url"
                placeholder="Webhook URL configured in Twilio"
                value={whatsappConfig.webhook_url}
                onChange={(e) =>
                  setWhatsappConfig({ ...whatsappConfig, webhook_url: e.target.value })
                }
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                Store the webhook URL for reference
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status_callback_url">Status Callback URL (Reference)</Label>
              <Input
                id="status_callback_url"
                placeholder="Status callback URL configured in Twilio"
                value={whatsappConfig.status_callback_url}
                onChange={(e) =>
                  setWhatsappConfig({ ...whatsappConfig, status_callback_url: e.target.value })
                }
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                Store the status callback URL for reference
              </p>
            </div>

            <Button onClick={handleSaveWhatsappConfig} disabled={savingWhatsapp} className="gap-2">
              <Save className="h-4 w-4" />
              {savingWhatsapp ? "Saving..." : "Save Configuration"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Session Timeout Configuration Section */}
      <div className="space-y-6 mt-8">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Session Timeout Configuration</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Idle Session Timeout</CardTitle>
            <CardDescription>
              Configure automatic logout after user inactivity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="idle_timeout_enabled"
                checked={idleTimeoutConfig.enabled}
                onCheckedChange={(checked) =>
                  setIdleTimeoutConfig({ ...idleTimeoutConfig, enabled: checked as boolean })
                }
              />
              <Label htmlFor="idle_timeout_enabled" className="cursor-pointer">
                Enable automatic logout after idle session (30 minutes)
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              When enabled, users will be automatically logged out after 30 minutes of inactivity. 
              A warning notification will appear 2 minutes before logout.
            </p>

            <Button onClick={handleSaveIdleTimeoutConfig} disabled={savingIdleTimeout} className="gap-2">
              <Save className="h-4 w-4" />
              {savingIdleTimeout ? "Saving..." : "Save Configuration"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemConfig;
