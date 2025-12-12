import { useEffect, useCallback } from 'react';

const CURRENT_VERSION = '1.2.6';
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

    // Tell service worker to clear its caches and skip waiting
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        // If there's a waiting worker, tell it to activate
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        // Tell the active worker to clear cache
        if (registration.active) {
          registration.active.postMessage({ type: 'CLEAR_CACHE' });
        }
        // Force update check
        await registration.update();
      }
    }

    // Update stored version
    localStorage.setItem(LOCAL_VERSION_KEY, CURRENT_VERSION);

    // Force reload from server (bypass cache)
    window.location.reload();
  }, []);

  const checkVersion = useCallback(async () => {
    try {
      // Fetch manifest with cache-busting
      const response = await fetch(`/manifest.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
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
      if (event.data && (event.data.type === 'CACHE_CLEARED' || event.data.type === 'SW_ACTIVATED')) {
        console.log('Service worker cache cleared or activated, reloading...');
        window.location.reload();
      }
    };

    // Listen for service worker updates
    const handleControllerChange = () => {
      console.log('Service worker controller changed, reloading...');
      window.location.reload();
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    return () => {
      clearInterval(intervalId);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
    };
  }, [checkVersion]);

  return { checkVersion, clearCacheAndReload, currentVersion: CURRENT_VERSION };
};
