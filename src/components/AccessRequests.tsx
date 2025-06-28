// src/components/AccessRequests.tsx
import React, { useState } from 'react';
import { useAccessRequests } from '../hooks/useAccessRequests';
import { PasswordModal } from './PasswordModal';
import { decryptFile } from '../utils/encryption';
 
import './AccessRequests.css';
import { AccessRequest } from '../types/AccessRequest';
import { getFileFromIPFS } from '../utils/ipfs';
import { downloadFile } from '../utils/fileUtils';
import { useWalletProvider } from '../hooks/useWalletProvider';


export const AccessRequests = () => {
  const { accessRequests, updateRequestStatus } = useAccessRequests();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [passwordError, setPasswordError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { selectedAccount } = useWalletProvider() ?? {};

  const handleApprove = async (request: AccessRequest) => {
    if (!request) return; // Add null check
    setSelectedRequest(request);
    setIsPasswordModalOpen(true);
    setPasswordError('');
  };

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
      
      updateRequestStatus(selectedRequest.id, 'pending'); //test
      console.log('Password verified! Access granted.');
    } catch (error) {
      console.error('Error verifying password:', error);
      setPasswordError('Invalid password. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDeny = async (id: string) => {
    try {
      updateRequestStatus(id, 'denied');
    } catch (error) {
      console.error('Error denying request:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="accessRequests">
      <h2>Access Requests</h2>
      {!accessRequests || accessRequests.length === 0 ? (
        <div className="noRequests">
          <p>No access requests found</p>
        </div>
      ) : (
        <div className="requestsList">
          {accessRequests.map(request => {
            if (!request) return null; // Skip null requests
            const existingLoans = JSON.parse(localStorage.getItem('loanApplications') || '[]');
            const loan = existingLoans.find((loan: any) => loan.identityHash === request.ipfsHash);
            return (
              <div key={request.id} className={`requestCard ${request.status || 'pending'}`}>
                <div className="requestInfo">
                  <p><strong>Requester:</strong> {request.requester}</p>
                  <p><strong>Document Type:</strong> {request.cidType}</p>
                  <p><strong>Document CID:</strong> {request.ipfsHash}</p>
                  <p><strong>Loan ID:</strong> {loan?.loanId}</p>
                  <p><strong>Loan Amount:</strong> {loan?.loanAmount}</p>
                  <p><strong>Requested:</strong> {formatDate(request.timestamp)}</p>
                  <p><strong>Status:</strong> {request.status || 'pending'}</p>
                </div>
                {(!request.status || request.status === 'pending') && (
                  <div className="requestActions">
                    <button 
                      onClick={() => handleApprove(request)}
                      className="approveButton"
                      disabled={isVerifying}
                    >
                      {isVerifying ? 'Verifying...' : 'View'}
                    </button>
                    <button 
                      onClick={() => handleDeny(request.id)}
                      className="denyButton"
                      disabled={isVerifying}
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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