import { useState } from 'react';
import "./App.css"
import { SideNav } from './components/SideNav';
import { WalletList } from './components/WalletList';
import { SelectedWallet } from './components/SelectedWallet';
import { WalletError } from './components/WalletError';
import { WalletProvider } from './hooks/WalletProvider';
import LoanApplicationForm from './components/LoanApplicationForm';
import LoanApplicationsList from './components/LoanApplicationsList';
import BlockchainStressTester from './components/BlockChainTester';

function App() {
  const [activeScreen, setActiveScreen] = useState('wallet');
  return (
    <div className="appContainer">
      <SideNav activeScreen={activeScreen} setActiveScreen={setActiveScreen}/>
      <div className="mainContent">
      <WalletProvider>
      {activeScreen === 'wallet' ? (
          <>
            <WalletList />
            <hr />
            <SelectedWallet />
            <WalletError />
          </>
        ) : activeScreen === 'loan' ? (
            <LoanApplicationForm />
        ): activeScreen === 'requests' ?(
          <LoanApplicationsList />
        ): (
          <BlockchainStressTester />
        )}
        </WalletProvider>
      </div>
    </div>
  )
}

export default App