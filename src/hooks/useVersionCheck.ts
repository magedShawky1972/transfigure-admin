import { useState, useEffect, useCallback } from 'react';

// This version is embedded at build time
const BUILD_VERSION = '1.3.2';

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

  const applyUpdate = useCallback(async () => {
    try {
      // Clear all caches first
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }
      
      // Clear sessionStorage and localStorage cache keys
      sessionStorage.clear();
      
      // Force a complete page reload bypassing all caches
      const baseUrl = window.location.origin + window.location.pathname;
      window.location.replace(baseUrl + '?_cache_bust=' + Date.now());
    } catch (error) {
      console.error('Error during update:', error);
      // Fallback: just do a hard reload
      window.location.reload();
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
