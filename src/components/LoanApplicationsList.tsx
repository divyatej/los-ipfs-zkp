// components/LoanApplicationsList.tsx

import React, { useEffect, useState } from 'react';
import { getLoanApplications, saveLoanApplication } from '../utils/loanIdManager';
import { useAccessRequests } from '../hooks/useAccessRequests';
import { AccessRequest } from '../types/AccessRequest';
import { getFileFromIPFS } from '../utils/ipfs';
import { decryptFile } from '../utils/encryption';
import { downloadFile } from '../utils/fileUtils';
import { PasswordModal } from './PasswordModal';
import { ethers } from 'ethers';
import LoanContractABI from '../../artifacts/contracts/LoanContract.sol/LoanContract.json';
import BankContractABI from '../../artifacts/contracts/BankContract.sol/BankContract.json';
import { sendLoanStatusEmail } from '../utils/emailService';

interface LoanApplication {
  loanId: number;
  loanAmount: string;
  identityHash: string;
  financialHash: string;
  zkpHash: string;
  timestamp: string;
  status: string;
  loanType: string;
}

const LoanApplicationsList: React.FC = () => {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessRequests, updateRequestStatus } = useAccessRequests();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [passwordError, setPasswordError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isApprovalReady, setIsApprovalReady] = useState(false);
  const [isPersonalApproved, setIsPersonalApproved] = useState(false);
  const [isFinancialApproved, setIsFinancialApproved] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<Record<number, boolean>>({});
  const [processedLoanIds] = useState<Set<number>>(new Set());

  const processedEvents = new Set<string>();

  const getEventId = (event: any) => {
    return `${event.transactionHash}-${event.logIndex}`;
};

  const handleOpen = async (request: AccessRequest) => {
    if (!request) return; // Add null check
    setSelectedRequest(request);
    setIsPasswordModalOpen(true);
    setPasswordError('');
  };

  const getProcessedLoanIds = (): Set<number> => {
    const stored = localStorage.getItem('processedLoanIds');
    return new Set(stored ? JSON.parse(stored) : []);
  };

  const saveProcessedLoanId = (loanId: number) => {
    const processedIds = getProcessedLoanIds();
    processedIds.add(loanId);
    localStorage.setItem('processedLoanIds', JSON.stringify([...processedIds]));
  };


  const setupEventListeners = async () => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = new ethers.Contract(
        import.meta.env.VITE_LOAN_CONTRACT_ADDRESS ?? "",
        LoanContractABI.abi,
        provider
      );

      // Listen for LoanApproved event
      contract.on("LoanApproved", (
        loanId,
        amount,
        personalCID,
        financialCID,
        borrower,
        event
      ) => {
        const loanIdNumber = Number(loanId);
        if (getProcessedLoanIds().has(loanIdNumber)) {
            console.log(`Loan ID ${loanIdNumber} already processed, skipping email`);
            return;
          }
  
        console.log('Loan Approved Event:', {
          loanId: loanId.toString(),
          amount: amount,
          personalCID,
          financialCID,
          borrower
        });
        saveProcessedLoanId(loanIdNumber);
        // Send approval email
        sendLoanStatusEmail(
          Number(loanId),
          amount,
          'approved',
          personalCID,
          financialCID
        );
      });

      // Listen for LoanDenied event
      contract.on("LoanDenied", (
        loanId,
        amount,
        personalCID,
        financialCID,
        borrower,
        event
      ) => {
        const loanIdNumber = Number(loanId);
        if (getProcessedLoanIds().has(loanIdNumber)) {
            console.log(`Loan ID ${loanIdNumber} already processed, skipping email`);
            return;
          }
        console.log('Loan Denied Event:', {
          loanId: loanId.toString(),
          amount: amount,
          personalCID,
          financialCID,
          borrower
        });
        saveProcessedLoanId(loanIdNumber);
        // Send denial email
        sendLoanStatusEmail(
          Number(loanId),
          amount,
          'denied',
          personalCID,
          financialCID
        );
      });

      console.log('Event listeners setup complete');
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  };

  const eventLock = {
    isLocked: false,
    queue: [] as (() => void)[],
    processing: false,
    lastProcessedTime: 0,
    LOCK_TIMEOUT: 30000, // 30 seconds timeout
    
    // Reset function to clear the lock state
    reset: function() {
        this.isLocked = false;
        this.processing = false;
        this.lastProcessedTime = 0;
        this.queue = [];
        console.log('Lock status has been reset');
    }
};

const acquireLock = (): boolean => {
  const now = Date.now();
    
    // Check if previous lock has timed out
    if (eventLock.isLocked && (now - eventLock.lastProcessedTime) > eventLock.LOCK_TIMEOUT) {
        console.warn('Lock timeout detected, forcing release');
        eventLock.reset();
    }

    if (!eventLock.isLocked) {
      console.log("Lock acquired");
        eventLock.isLocked = true;
        eventLock.lastProcessedTime = now;
        return true;
    }
    console.log("Lock not acquired"); 
    return false;
};

setInterval(() => {
  const now = Date.now();
  if (eventLock.isLocked && (now - eventLock.lastProcessedTime) > eventLock.LOCK_TIMEOUT) {
      console.warn('Lock timeout detected, resetting lock...');
      eventLock.reset();
  }
}, 5000);

const releaseLock = (): void => {
  if (eventLock.queue.length > 0) {
      const next = eventLock.queue.shift();
      if (next) next();
  } else {
      eventLock.isLocked = false;
      eventLock.lastProcessedTime = 0;
  }
};
  useEffect(() => {
    const listenForLoanRequests = async () => {
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const contractAddress = import.meta.env.VITE_BANK_CONTRACT_ADDRESS ?? "";
        const contract = new ethers.Contract(contractAddress, BankContractABI.abi, provider);

        contract.on("ReceivedForwardedLoan", (requester, loanAmount, identityHash, financialHash, loanType, event) => {
          console.log('ReceivedForwardedLoan event received');
          if (!acquireLock()) {
            console.log('Event processing is locked, skipping...');
            return;
          }
          // Add new request to the database
          const loanApplicationData = {
            loanAmount: loanAmount.toString(),
            identityHash: identityHash,
            financialHash: financialHash,
            loanType: "forwarded"
          };
          console.log(loanApplicationData);

          // Update state with new request
          saveLoanApplication(loanApplicationData);
          
        });
        console.log('Event listeners setup complete for ReceivedForwardedLoan');
      } catch (error) {
        console.error("Error setting up access request listener:", error);
      }
      finally {
        // Always release the lock when done
        releaseLock();
      }
    };

    listenForLoanRequests();
  }, []);

  const handleApproval = async (loanapplication: LoanApplication, action: 'approve' | 'deny') => {
    console.log(loanapplication.loanId);
    console.log(approvalStatus[loanapplication.loanId]);
    if (!approvalStatus[loanapplication.loanId]) return;
    setIsProcessing(true);
    try {
        // @ts-ignore
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          import.meta.env.VITE_LOAN_CONTRACT_ADDRESS ?? "",
            LoanContractABI.abi,
            signer
        );

        const borrowerAddress = await signer.getAddress();

        let tx;
        if (action === 'approve') {
          console.log(loanapplication.loanType);
            tx = await contract.approveLoan(
                loanapplication.loanId,
                ethers.parseEther(loanapplication.loanAmount),
                loanapplication.identityHash,
                loanapplication.financialHash,
                borrowerAddress,
                loanapplication.loanType ?? "bank"
            );
        } else {
            tx = await contract.denyLoan(
                loanapplication.loanId,
                ethers.parseEther(loanapplication.loanAmount),
                loanapplication.identityHash,
                loanapplication.financialHash,
                borrowerAddress,
                loanapplication.loanType
            );
        }
        await tx.wait();
        const applications = JSON.parse(localStorage.getItem('loanApplications') || '[]');
        console.log(applications);
      const updatedApplications = applications.map((app: any) => {
        if (app.loanId === loanapplication.loanId) {
          return {
            ...app,
            status: action === 'approve' ? 'approved' : 'denied'
          };
        }
        return app;
      });
      console.log(updatedApplications);
      localStorage.setItem('loanApplications', JSON.stringify(updatedApplications));
      setApplications(updatedApplications);
    } catch (error) {
        console.error('Error approving loan:', error);
    }
    finally {
        setIsProcessing(false);
    }
    
      setIsProcessing(false);
  }

  const handlePasswordSubmit = async (password: string) => {
    if (!selectedRequest) return;

    setIsVerifying(true);
    setPasswordError('');

    try {
      const encryptedData = await getFileFromIPFS(selectedRequest.ipfsHash);
      const decryptedData = await decryptFile(encryptedData, password);

      // Generate filename based on cidType and timestamp
      const filename = `document_${selectedRequest.cidType}_${Date.now()}.pdf`;

      downloadFile(decryptedData, filename);
      
      setIsPasswordModalOpen(false);
      setSelectedRequest(null);
      
      updateRequestStatus(selectedRequest.id, 'approved');
      if(selectedRequest.cidType === "personal") {
        setIsPersonalApproved(true);
      } else if(selectedRequest.cidType === "financial") {
        setIsFinancialApproved(true);
      }
      setIsApprovalReady(isPersonalApproved && isFinancialApproved);
      console.log('Password verified! Access granted.');
    } catch (error) {
      console.error('Error verifying password:', error);
      setPasswordError('Invalid password. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    const newApprovalStatus: Record<number, boolean> = {};
    
    applications.forEach(application => {
      const personalRequest = accessRequests.find(
        (req: any) => req.cidType === "personal" && req.ipfsHash === application.identityHash
      );
      const financialRequest = accessRequests.find(
        (req: any) => req.cidType === "financial" && req.ipfsHash === application.financialHash
      );
      
      newApprovalStatus[application.loanId] = 
        personalRequest?.status === 'approved' && 
        financialRequest?.status === 'approved';
    });

    setApprovalStatus(newApprovalStatus);
  }, [applications, accessRequests]);
  
  useEffect(() => {
    try {
      const savedApplications = getLoanApplications();
      setApplications(savedApplications);
    } catch (err) {
      setError('Failed to load loan applications');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Setup event listeners when component mounts
    setupEventListeners();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-lg">No loan applications found</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Loan Applications</h2>
      <div className="grid gap-6">
        {applications.map((application) => {
            const personalRequest = accessRequests.find((req: any) => req.cidType === "personal" && req.ipfsHash === application.identityHash);
            const financialRequest = accessRequests.find((req: any) => req.cidType === "financial" && req.ipfsHash === application.financialHash);          
            return (
          <div
            key={application.loanId}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold text-blue-600 mb-2">
                  Loan ID: {application.loanId}
                </h3>
                <p className="text-sm text-gray-500 mb-2">
                  Submitted: {new Date(application.timestamp).toLocaleString()}
                </p>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Amount:</span>{' '}
                    {application.loanAmount}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span>{' '}
                    {application.status}
                  </p>
                  <p>
                    <span className="font-medium">Personal CID:</span>{' '}
                    {application.identityHash} {personalRequest ? <button 
                      onClick={() => handleOpen(personalRequest)}
                      className="approveButton"
                      disabled={isVerifying}
                    >
                      {isVerifying ? 'Verifying...' : 'View'}
                    </button> : ''}
                  </p>
                  <p>
                    <span className="font-medium">Financial CID:</span>{' '}
                    {application.financialHash} {financialRequest ? <button 
                      onClick={() => handleOpen(financialRequest)}
                      className="approveButton"
                      disabled={isVerifying}
                    >
                      {isVerifying ? 'Verifying...' : 'View'}
                    </button> : ''}
                  </p>
                  <p>
                    <span className="font-medium">ZKP hash:</span>{' '}
                    {application.zkpHash}
                  </p>
                </div>
                {approvalStatus[application.loanId] && application.status !== "approved" && (
                <div className="flex space-x-4">
        <button
          onClick={() => handleApproval(application, 'approve')}
          disabled={isProcessing}
          className={`px-4 py-2 rounded-md text-white font-medium ${
            isProcessing
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Approve Loan'}
        </button>
        
        <button
          onClick={() => handleApproval(application, 'deny')}
          disabled={isProcessing}
          className={`px-4 py-2 rounded-md text-white font-medium ${
            isProcessing
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Deny Loan'}
        </button>
      </div>
      )}
              </div>
            </div>
          </div>
        )
        }
        )}
      </div>
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setSelectedRequest(null);
          setPasswordError('');
        }}
        onSubmit={handlePasswordSubmit}
        error={passwordError}
      />
    </div>
  );
};

export default LoanApplicationsList;