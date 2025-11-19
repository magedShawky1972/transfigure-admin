import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import logo from "@/assets/edara-logo.png";

const Welcome = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Edara Logo" className="h-24 w-auto" />
          </div>
          <CardTitle className="text-3xl font-bold">Welcome to Edara</CardTitle>
          <CardDescription className="text-lg mt-4">
            Your business management system
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            You currently don't have access to any dashboard components.
          </p>
          <p className="text-muted-foreground">
            Please contact your administrator to request access to the features you need.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Welcome;
