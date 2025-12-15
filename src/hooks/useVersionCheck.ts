import { useState, useEffect, useCallback } from 'react';

export const useVersionCheck = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [newVersion, setNewVersion] = useState<string>('');

  const checkForUpdates = useCallback(async () => {
    try {
      // Fetch manifest with cache-busting query param
      const response = await fetch(`/manifest.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) return;
      
      const manifest = await response.json();
      const serverVersion = manifest.version || '';
      
      // Get stored version from localStorage
      const storedVersion = localStorage.getItem('app_version');
      
      if (!storedVersion) {
        // First time - store current version
        localStorage.setItem('app_version', serverVersion);
        setCurrentVersion(serverVersion);
      } else if (storedVersion !== serverVersion) {
        // New version available
        setCurrentVersion(storedVersion);
        setNewVersion(serverVersion);
        setUpdateAvailable(true);
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
    
    // Update stored version
    localStorage.setItem('app_version', newVersion);
    
    // Unregister service worker and reload
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
        // Force reload from server
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  }, [newVersion]);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  useEffect(() => {
    // Check immediately on mount
    checkForUpdates();
    
    // Check every 60 seconds
    const interval = setInterval(checkForUpdates, 60000);
    
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
    currentVersion,
    newVersion,
    applyUpdate,
    dismissUpdate
  };
};
