import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for push notifications with forced update check
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Force the browser to check for new service worker every time (bypass HTTP cache)
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Critical: bypasses browser cache for sw.js
      });
      console.log('Service Worker registered with scope:', registration.scope);
      
      // Force update check immediately
      registration.update();
      
      // Request notification permission on load if not already granted
      if (Notification.permission === 'default') {
        console.log('Notification permission not yet requested');
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
