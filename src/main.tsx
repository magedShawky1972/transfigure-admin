import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker only in production to avoid stale cached preview code
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      console.log('Service Worker registered with scope:', registration.scope);
      registration.update();

      if (Notification.permission === 'default') {
        console.log('Notification permission not yet requested');
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
