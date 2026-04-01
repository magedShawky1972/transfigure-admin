import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const CRMSession = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const hash = window.location.hash;
      if (!hash.startsWith('#token=')) {
        setError("Invalid session link");
        return;
      }

      const encoded = hash.replace('#token=', '');
      const decoded = atob(encoded);
      
      // Set the auth session in localStorage
      const storageKey = "sb-ysqqnkbgkrjoxrzlejxy-auth-token";
      localStorage.setItem(storageKey, decoded);

      // Clear the hash immediately so user can't see the token
      window.history.replaceState(null, "", window.location.pathname);

      // Redirect to shift session
      navigate("/shift-session", { replace: true });
    } catch (e) {
      console.error("Session error:", e);
      setError("Failed to process session");
    }
  }, [navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Connecting...</p>
    </div>
  );
};

export default CRMSession;
