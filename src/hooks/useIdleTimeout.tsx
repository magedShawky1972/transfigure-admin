import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const DEFAULT_IDLE_TIMEOUT_MINUTES = 180; // 3 hours
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
  const [isEnabled, setIsEnabled] = useState(false);
  const isEnabledRef = useRef(false);
  const timeoutMinutesRef = useRef(DEFAULT_IDLE_TIMEOUT_MINUTES);

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
        const enabled = config.enabled ?? false;
        const configuredMinutes = Number(config.timeout_minutes);
        timeoutMinutesRef.current = Number.isFinite(configuredMinutes) && configuredMinutes > 0
          ? configuredMinutes
          : DEFAULT_IDLE_TIMEOUT_MINUTES;
        setIsEnabled(enabled);
        isEnabledRef.current = enabled;
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

    const idleTimeout = timeoutMinutesRef.current * 60 * 1000;

    // Set warning timer (2 minutes before logout)
    warningId.current = setTimeout(() => {
      setShowWarning(true);
      toast({
        title: "Session Expiring Soon",
        description: "You'll be logged out in 2 minutes due to inactivity.",
        duration: 10000,
      });
    }, Math.max(idleTimeout - WARNING_TIME, 0));

    // Set logout timer
    timeoutId.current = setTimeout(() => {
      logout();
    }, idleTimeout);
  };

  const handleActivity = () => {
    if (isEnabledRef.current) {
      resetTimer();
    }
  };

  useEffect(() => {
    // Load the configuration before starting any timer so the old 30-minute
    // default can never log a user out while settings are still loading.
    const initialize = async () => {
      await loadConfig();
      const { data: { session } } = await supabase.auth.getSession();
      if (session && isEnabledRef.current) resetTimer();
    };
    void initialize();

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
