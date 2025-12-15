import { useState, useEffect, useCallback } from 'react';

// This version is embedded at build time
const BUILD_VERSION = '1.3.1';

export const useVersionCheck = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState<string>('');

  const checkForUpdates = useCallback(async () => {
    try {
      // Fetch manifest with cache-busting query param
      const response = await fetch(`/manifest.json?_=${Date.now()}`, {
        cache: 'no-store'
      });
      
      if (!response.ok) return;
      
      const manifest = await response.json();
      const serverVersion = manifest.version || '';
      
      console.log('Version check:', { buildVersion: BUILD_VERSION, serverVersion });
      
      // Compare server version with build version
      if (serverVersion && serverVersion !== BUILD_VERSION) {
        setNewVersion(serverVersion);
        setUpdateAvailable(true);
        console.log('Update available:', serverVersion);
      }
    } catch (error) {
      console.error('Version check failed:', error);
    }
  }, []);

  const applyUpdate = useCallback(() => {
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }
    
    // Unregister service worker and reload
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
        // Force hard reload
        window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
      });
    } else {
      window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
    }
  }, []);

  useEffect(() => {
    // Check immediately on mount
    checkForUpdates();
    
    // Check every 30 seconds
    const interval = setInterval(checkForUpdates, 30000);
    
    // Also check when window regains focus
    const handleFocus = () => checkForUpdates();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForUpdates]);

  return {
    updateAvailable,
    currentVersion: BUILD_VERSION,
    newVersion,
    applyUpdate
  };
};
