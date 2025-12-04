import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('Service Worker registered with scope:', registration.scope);
      
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
