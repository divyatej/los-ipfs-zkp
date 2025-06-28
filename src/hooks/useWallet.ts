import { useState, useEffect } from 'react';

interface ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface Provider {
  info: ProviderInfo;
  connect: () => Promise<void>;
}

export const useWallet = () => {
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    const handleProvider = (event: CustomEvent) => {
      const provider = event.detail;
      setProviders(prev => [...prev, provider]);
    };

    window.addEventListener('eip6963:announceProvider', handleProvider as EventListener);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleProvider as EventListener);
    };
  }, []);

  return { providers };
};