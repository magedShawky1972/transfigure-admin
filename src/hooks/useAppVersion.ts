import { useState, useEffect } from 'react';

export const useAppVersion = () => {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch('/manifest.json');
        const manifest = await response.json();
        setVersion(manifest.version || '');
      } catch (error) {
        console.error('Failed to fetch app version:', error);
        setVersion('');
      }
    };

    fetchVersion();
  }, []);

  return version;
};
