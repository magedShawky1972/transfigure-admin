import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Mail, Bell, Link2, Database, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConfigItem {
  name: string;
  description: string;
  usedIn: string[];
  icon: any;
  category: string;
}

const SystemConfig = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
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

  const configurations: ConfigItem[] = [
    {
      name: "VAPID Keys",
      description: "Web Push notification keys for browser push notifications. VAPID (Voluntary Application Server Identification) keys authenticate your server when sending push notifications.",
      usedIn: ["send-push-notification", "Frontend push subscription"],
      icon: Bell,
      category: "Push Notifications"
    },
    {
      name: "ODOO API Configuration",
      description: "Odoo ERP system integration credentials. Used to sync customers and products between your app and Odoo ERP system.",
      usedIn: ["sync-customer-to-odoo", "sync-product-to-odoo"],
      icon: Link2,
      category: "External Integration"
    },
    {
      name: "SMTP Configuration",
      description: "SMTP server credentials for sending email notifications. Used for ticket notifications and user communications.",
      usedIn: ["send-ticket-notification"],
      icon: Mail,
      category: "Email Services"
    },
    {
      name: "Resend API Key",
      description: "Resend email service API key for transactional emails. Alternative email delivery service with better deliverability.",
      usedIn: ["send-ticket-notification (alternative)"],
      icon: Mail,
      category: "Email Services"
    },
    {
      name: "Supabase Configuration",
      description: "Auto-configured Lovable Cloud credentials. These are automatically managed and include database URL, service role key, and anon key.",
      usedIn: ["All edge functions", "Frontend authentication", "Database operations"],
      icon: Database,
      category: "Backend Infrastructure"
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
            For security reasons, actual key values are not displayed on this page. 
            All secrets are securely stored and encrypted in the backend. Only authorized 
            edge functions can access these values at runtime.
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
                  <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                    Configured
                  </Badge>
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
    </div>
  );
};

export default SystemConfig;
