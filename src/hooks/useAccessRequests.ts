import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import LoanContract from '../../artifacts/contracts/LoanContract.sol/LoanContract.json';
import { accessRequestDB } from '../services/AccessRequestDB';
import { AccessRequest } from '../types/AccessRequest';

export const useAccessRequests = () => {
    const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  
    useEffect(() => {
      const listenForAccessRequests = async () => {
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const contractAddress = import.meta.env.VITE_LOAN_CONTRACT_ADDRESS ?? "";
          const contract = new ethers.Contract(contractAddress, LoanContract.abi, provider);
  
          // Load existing requests
          setAccessRequests(accessRequestDB.getRequests());
  
          contract.on("AccessRequestGranted", (requester, cidType, ipfsHash) => {
            // Add new request to the database
            const newRequest = accessRequestDB.addRequest({
              requester,
              cidType,
              ipfsHash,
              timestamp: Date.now()
            });
  
            // Update state with new request
            if (newRequest) {
              setAccessRequests(prev => [...prev, newRequest]);
            }
          });
  
          return () => {
            contract.removeAllListeners("AccessRequestGranted");
          };
        } catch (error) {
          console.error("Error setting up access request listener:", error);
        }
      };
  
      listenForAccessRequests();
    }, []);
  
    const updateRequestStatus = (id: string, status: 'approved' | 'pending' | 'denied') => {
      const updatedRequest = accessRequestDB.updateRequestStatus(id, status);
      if (updatedRequest) {
        setAccessRequests(prev => 
          prev.map(request => 
            request.id === id ? updatedRequest : request
          )
        );
      }
    };
  
    return {
      accessRequests,
      updateRequestStatus
    };
  };