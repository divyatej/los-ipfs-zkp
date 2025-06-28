// src/components/LoanApplicationForm.tsx
import React, { useCallback, useState } from 'react';
import './LoanApplicationForm.css';
import { ethers } from 'ethers';
import { useWalletProvider } from '../hooks/useWalletProvider';

import BankContractABI from '../../artifacts/contracts/BankContract.sol/BankContract.json';
import LoanContractABI from '../../artifacts/contracts/LoanContract.sol/LoanContract.json';
import { saveLoanApplication, updateLoanStatus } from '../utils/loanIdManager';

interface FormData {
  loanAmount: string;
  documentType: 'ipfs' | 'zkp';
  identityHash?: string;  // For IPFS personal identity content ID
  financialHash?: string; // For IPFS financial status content ID
  zkpHash?: string; // For ZKP content ID
}

const BANK_CONTRACT_ADDRESS = import.meta.env.VITE_BANK_CONTRACT_ADDRESS ?? ""; // Replace with your deployed contract address
const LOAN_CONTRACT_ADDRESS = import.meta.env.VITE_LOAN_CONTRACT_ADDRESS ?? ""; // Replace with your deployed contract address
const LoanApplicationForm: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    loanAmount: '',
    documentType: 'ipfs',
    identityHash: '',
    financialHash: '',
    zkpHash: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { selectedAccount } = useWalletProvider() ?? {};

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDocumentTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newType = e.target.value as 'ipfs' | 'zkp';
    setFormData(prev => ({
      ...prev,
      documentType: newType,
      // Clear IPFS hashes if switching to ZKP
      identityHash: newType === 'ipfs' ? prev.identityHash : '',
      financialHash: newType === 'ipfs' ? prev.financialHash : ''
    }));
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    console.log('Form submission started'); // Debug log
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Form Data:', formData);
    console.log('Selected Account:', selectedAccount);

    if (!selectedAccount) {
      setError('Please connect your wallet first');
      return;
    }

    if (formData.documentType === 'ipfs' && (!formData.identityHash || !formData.financialHash)) {
      setError('Please provide both IPFS content IDs');
      console.log('Please provide both IPFS content IDs');
      return;
    }

    if (formData.documentType === 'zkp' && (!formData.zkpHash)) {
      setError('Please provide both ZKP content IDs');
      console.log('Please provide both ZKP content IDs');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('Starting contract interaction');
      
      if (!(window as any).ethereum?.isMetaMask) {
        console.log('MetaMask not found');
        throw new Error('MetaMask not found');
      }

      const loanApplicationData = {
        loanAmount: formData.loanAmount,
        identityHash: formData.identityHash,
        financialHash: formData.financialHash,
        zkpHash: formData.zkpHash
      };
      const loanId = saveLoanApplication(loanApplicationData);
      // Get the provider from the connected wallet
      const provider = new ethers.BrowserProvider((window as any).ethereum as any);
      const signer = await provider.getSigner();

      // Create contract instance
      const bankContract = new ethers.Contract(
        BANK_CONTRACT_ADDRESS,
        BankContractABI.abi,
        signer
      );
      console.log('loan contract address:', LOAN_CONTRACT_ADDRESS);
      const loanContract = new ethers.Contract(
        LOAN_CONTRACT_ADDRESS,
        LoanContractABI.abi,
        signer
      );

      console.log('Contract instance created');
      const loanAmount = formData.loanAmount;
      let tx: any;
      console.log('Document type:', formData.documentType);
      if (formData.documentType === 'ipfs') {
        // Call the requestUserAccess function
        tx = await bankContract.requestUserAccess(
          selectedAccount,
          formData.identityHash || '',
          formData.financialHash || ''
        );
      } else if (formData.documentType === 'zkp') {
        console.log('Applying for loan with ZKP');
        console.log(loanContract);
        console.log(selectedAccount);
        const zkpString = formData.zkpHash || '';
        console.log(zkpString);
        const loanAmountUint256 = ethers.toBigInt(loanAmount);
        console.log(loanAmountUint256);
        tx = await loanContract.applyForLoan(
          selectedAccount,
          loanAmountUint256,
          zkpString
        );
      }
      console.log('Transaction sent:', tx.hash);

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log('Transaction mined:', receipt);
      console.log('Receipt logs:', receipt.logs);

      const contractReceipt = await provider.getTransactionReceipt(tx.hash);
      console.log('Contract receipt:', contractReceipt);

      // Get the event from the transaction receipt
      const event = contractReceipt?.logs.find((log: any) => {
        try {
          const parsedLog = bankContract.interface.parseLog(log);
          return parsedLog?.name === 'AccessRequestedByBank';
        } catch (e) {
          return false;
        }
      });

      const zkpEvent = contractReceipt?.logs.find((log: any) => {
        try {
          const parsedLog = loanContract.interface.parseLog(log);
          return parsedLog?.name === 'LoanApplied';
        } catch (e) {
          return false;
        }
      });

      const loanProcessedEvent = contractReceipt?.logs.find((log: any) => {
        try {
          const parsedLog = loanContract.interface.parseLog(log);
          return parsedLog?.name === 'LoanApplicationProcessed';
        } catch (e) {
          return false;
        }
      });

      if (formData.documentType === 'ipfs' && event) {
        const parsedEvent = bankContract.interface.parseLog(event);
        console.log('Found event:', parsedEvent);
        setSuccess(`Access requested successfully! Transaction hash: ${tx.hash}`);
        console.log(`Access requested successfully! Transaction hash: ${tx.hash}`);
        // Reset form after successful submission
        setFormData({
          loanAmount: '',
          documentType: 'ipfs',
          identityHash: '',
          financialHash: ''
        });
      } else if (formData.documentType === 'zkp' && zkpEvent) {
        const parsedEvent = loanContract.interface.parseLog(zkpEvent);
        console.log('Found event:', parsedEvent);
        setSuccess(`Loan applied successfully! Transaction hash: ${tx.hash}`);
        console.log(`Loan applied successfully! Transaction hash: ${tx.hash}`);
      } else if(formData.documentType === 'zkp' && loanProcessedEvent) {
        const parsedEvent = loanContract.interface.parseLog(loanProcessedEvent);
        console.log('Found event:', parsedEvent);
        setSuccess(`Loan application processed successfully! Transaction hash: ${tx.hash}`);
        console.log(`Loan application processed successfully! Transaction hash: ${tx.hash}`);
        updateLoanStatus(loanId, 'approved');
      } else {
        console.log('Transaction completed but no event was emitted');
        throw new Error('Transaction completed but no event was emitted');
      }

      
    } catch (error: unknown) {
      console.error('Error requesting access:', error);
      setError(error instanceof Error ? error.message : 'Failed to request access. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, selectedAccount]);

  const handleButtonClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Button clicked'); // Debug log
    e.preventDefault();
    
    // Call handleSubmit directly with a synthetic event
    await handleSubmit(new Event('submit') as any);
  };
  return (
    <div className="loan-application-form">
      <h2>Loan Application</h2>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="loanAmount">Loan Amount (AUD)</label>
          <input
            type="number"
            id="loanAmount"
            name="loanAmount"
            value={formData.loanAmount}
            onChange={handleInputChange}
            required
            min="0"
          />
        </div>

        <div className="form-group">
          <label>Document Sharing Method</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="documentType"
                value="ipfs"
                checked={formData.documentType === 'ipfs'}
                onChange={handleDocumentTypeChange}
              />
              IPFS Encrypted Sharing
            </label>
            <label>
              <input
                type="radio"
                name="documentType"
                value="zkp"
                checked={formData.documentType === 'zkp'}
                onChange={handleDocumentTypeChange}
              />
              Zero-Knowledge Proof Sharing
            </label>
          </div>
        </div>

        {formData.documentType === 'ipfs' && (
          <>
            <div className="form-group">
              <label htmlFor="identityHash">Personal Identity Content ID</label>
              <input
                type="text"
                id="identityHash"
                name="identityHash"
                value={formData.identityHash}
                onChange={handleInputChange}
                placeholder="Enter IPFS content ID for personal identity"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="financialHash">Financial Status Content ID</label>
              <input
                type="text"
                id="financialHash"
                name="financialHash"
                value={formData.financialHash}
                onChange={handleInputChange}
                placeholder="Enter IPFS content ID for financial status"
                required
              />
            </div>
          </>
        )}

        {formData.documentType === 'zkp' && (
          <>
            <div className="form-group">
              <label htmlFor="zkpHash">ZKP Content ID</label>
              <input
                type="text" 
                id="zkpHash"
                name="zkpHash"
                value={formData.zkpHash}
                onChange={handleInputChange}
                placeholder="Enter ZKP content ID"
                required
              />
            </div>
          </>
        )}

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        
        <button 
          type="button" // Changed from "submit" to "button"
          className="submit-button"
          onClick={handleButtonClick}
          disabled={isSubmitting || !selectedAccount}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
};

export default LoanApplicationForm;