import { useEffect, useCallback } from 'react';

const CURRENT_VERSION = '1.2.7';
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const LOCAL_VERSION_KEY = 'edara_app_version';

export const useVersionCheck = () => {
  const clearCacheAndReload = useCallback(async () => {
    console.log('New version detected, clearing cache...');
    
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('All caches cleared');
    }

    // Tell service worker to clear its caches
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }

    // Update stored version
    localStorage.setItem(LOCAL_VERSION_KEY, CURRENT_VERSION);

    // Force reload from server
    window.location.reload();
  }, []);

  const checkVersion = useCallback(async () => {
    try {
      // Fetch manifest with cache-busting
      const response = await fetch(`/manifest.json?t=${Date.now()}`, {
        cache: 'no-store'
      });
      
      if (!response.ok) return;

      const manifest = await response.json();
      const serverVersion = manifest.version;
      const storedVersion = localStorage.getItem(LOCAL_VERSION_KEY);

      console.log(`Version check - Server: ${serverVersion}, Stored: ${storedVersion}, Current: ${CURRENT_VERSION}`);

      // If stored version is different from server version, clear and reload
      if (storedVersion && storedVersion !== serverVersion) {
        await clearCacheAndReload();
      } else if (!storedVersion) {
        // First time, just store the version
        localStorage.setItem(LOCAL_VERSION_KEY, serverVersion);
      }
    } catch (error) {
      console.error('Version check failed:', error);
    }
  }, [clearCacheAndReload]);

  useEffect(() => {
    // Check version on mount
    checkVersion();

    // Set up periodic version checks
    const intervalId = setInterval(checkVersion, VERSION_CHECK_INTERVAL);

    // Listen for service worker messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'CACHE_CLEARED') {
        window.location.reload();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    return () => {
      clearInterval(intervalId);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, [checkVersion]);

  return { checkVersion, clearCacheAndReload, currentVersion: CURRENT_VERSION };
};
