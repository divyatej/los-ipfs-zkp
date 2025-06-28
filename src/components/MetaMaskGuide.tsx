import React from 'react';

const MetaMaskGuide: React.FC = () => {
  return (
    <div className="metaMaskGuide">
      <h2>No Wallet Detected</h2>
      <div className="guideSteps">
        <div className="step">
          <h3>Step 1: Install MetaMask</h3>
          <p>MetaMask is a browser extension that allows you to interact with Ethereum-based applications.</p>
          <a 
            href="https://metamask.io/download/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="installButton"
          >
            Install MetaMask
          </a>
        </div>

        <div className="step">
          <h3>Step 2: Create a Wallet</h3>
          <ol>
            <li>Click the MetaMask extension icon in your browser</li>
            <li>Click "Get Started"</li>
            <li>Choose "Create a Wallet"</li>
            <li>Set up a strong password</li>
            <li>Securely store your Secret Recovery Phrase</li>
          </ol>
        </div>

        <div className="step">
          <h3>Step 3: Connect to Our DApp</h3>
          <p>Once MetaMask is installed and your wallet is created:</p>
          <ol>
            <li>Refresh this page</li>
            <li>Click the MetaMask icon in the wallet list</li>
            <li>Approve the connection request in MetaMask</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default MetaMaskGuide;