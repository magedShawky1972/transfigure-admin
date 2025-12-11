import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before logout

interface IdleTimeoutConfig {
  enabled: boolean;
  timeout_minutes: number;
}

export const useIdleTimeout = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const warningId = useRef<NodeJS.Timeout | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const isEnabledRef = useRef(true);

  // Load configuration from database
  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "idle_timeout")
        .maybeSingle();

      if (error) {
        console.error("Error loading idle timeout config:", error);
        return;
      }

      if (data && data.setting_value) {
        const config = data.setting_value as unknown as IdleTimeoutConfig;
        setIsEnabled(config.enabled ?? true);
        isEnabledRef.current = config.enabled ?? true;
      }
    } catch (error) {
      console.error("Error loading idle timeout config:", error);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Session Expired",
        description: "You've been logged out due to inactivity.",
        variant: "destructive",
      });
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const resetTimer = () => {
    // Don't set timers if feature is disabled
    if (!isEnabledRef.current) {
      return;
    }

    // Clear existing timers
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }
    if (warningId.current) {
      clearTimeout(warningId.current);
    }
    
    // Hide warning if it was showing
    setShowWarning(false);

    // Set warning timer (2 minutes before logout)
    warningId.current = setTimeout(() => {
      setShowWarning(true);
      toast({
        title: "Session Expiring Soon",
        description: "You'll be logged out in 2 minutes due to inactivity.",
        duration: 10000,
      });
    }, IDLE_TIMEOUT - WARNING_TIME);

    // Set logout timer
    timeoutId.current = setTimeout(() => {
      logout();
    }, IDLE_TIMEOUT);
  };

  const handleActivity = () => {
    if (isEnabledRef.current) {
      resetTimer();
    }
  };

  useEffect(() => {
    // Load config first
    loadConfig();

    // Check if user is logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && isEnabledRef.current) {
        resetTimer();
      }
    };

    // Delay auth check to allow config to load first
    const initTimeout = setTimeout(() => {
      checkAuth();
    }, 500);

    // Activity events to track
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && isEnabledRef.current) {
        resetTimer();
      } else if (event === 'SIGNED_OUT') {
        if (timeoutId.current) clearTimeout(timeoutId.current);
        if (warningId.current) clearTimeout(warningId.current);
      }
    });

    // Cleanup
    return () => {
      clearTimeout(initTimeout);
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (timeoutId.current) clearTimeout(timeoutId.current);
      if (warningId.current) clearTimeout(warningId.current);
      subscription.unsubscribe();
    };
  }, []);

  // Update ref when isEnabled changes
  useEffect(() => {
    isEnabledRef.current = isEnabled;
    
    // If disabled, clear any existing timers
    if (!isEnabled) {
      if (timeoutId.current) clearTimeout(timeoutId.current);
      if (warningId.current) clearTimeout(warningId.current);
      setShowWarning(false);
    }
  }, [isEnabled]);

  return { showWarning };
};
