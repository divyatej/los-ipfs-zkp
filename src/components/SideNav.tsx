// src/components/SideNav.tsx
import { useState } from 'react';
import './SideNav.css';

interface SideNavProps {
    activeScreen: string;
    setActiveScreen: (screen: string) => void;
  }

export const SideNav = ({ activeScreen, setActiveScreen }: SideNavProps) => {
  const [activeTab, setActiveTab] = useState('wallet');

  return (
    <div className="sideNav">
      <div className="navItems">
        <button 
          className={`navItem ${activeScreen === 'wallet' ? 'active' : ''}`}
          onClick={() => setActiveScreen('wallet')}
        >
          Wallet
        </button>
        <button 
          className={`navItem ${activeScreen === 'loan' ? 'active' : ''}`}
          onClick={() => setActiveScreen('loan')}
        >
          Apply for loan
        </button>
        <button 
          className={`navItem ${activeScreen === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveScreen('requests')}
        >
          Loan Requests
        </button>
        <button 
          className={`navItem ${activeScreen === 'metrics' ? 'active' : ''}`}
          id="metrics"
          onClick={() => setActiveScreen('metrics')}
        >
          Metrics
        </button>
      </div>
    </div>
  );
};