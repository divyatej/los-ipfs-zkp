// src/services/accessRequestDB.ts
import { AccessRequest } from '../types/AccessRequest';

class AccessRequestDB {
  private readonly STORAGE_KEY = 'access_requests';
  private requests: AccessRequest[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const storedRequests = localStorage.getItem(this.STORAGE_KEY);
      if (storedRequests) {
        this.requests = JSON.parse(storedRequests);
      }
    } catch (error) {
      console.error('Error loading requests from storage:', error);
      this.requests = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.requests));
    } catch (error) {
      console.error('Error saving requests to storage:', error);
    }
  }

  // Helper method to check if a request already exists
  private isDuplicateRequest(requester: string, cidType: string, ipfsHash: string): boolean {
    return this.requests.some(request => 
      request.requester === requester && 
      request.cidType === cidType &&
      request.ipfsHash === ipfsHash &&
      request.status === 'pending' // Only check pending requests
    );
  }

  addRequest(request: Omit<AccessRequest, 'id' | 'status'>): AccessRequest | null {
    // Check if a duplicate request exists
    if (this.isDuplicateRequest(request.requester, request.cidType, request.ipfsHash)) {
      console.log('Duplicate request found, skipping...');
      return null;
    }

    const newRequest: AccessRequest = {
      ...request,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending'
    };
    
    this.requests.push(newRequest);
    this.saveToStorage();
    return newRequest;
  }

  getRequests(): AccessRequest[] {
    return [...this.requests];
  }

  getPendingRequests(): AccessRequest[] {
    return this.requests.filter(request => request.status === 'pending');
  }

  updateRequestStatus(id: string, status: 'approved' | 'pending' | 'denied'): AccessRequest | null {
    const request = this.requests.find(req => req.id === id);
    if (request) {
      request.status = status;
      this.saveToStorage();
      return { ...request };
    }
    return null;
  }

  // Add method to get request by requester and cidType
  getRequestByRequesterAndCidType(requester: string, cidType: string): AccessRequest | null {
    return this.requests.find(request => 
      request.requester === requester && 
      request.cidType === cidType
    ) || null;
  }

  // Add method to clear all requests
  clearAllRequests(): void {
    this.requests = [];
    this.saveToStorage();
  }

  // Add method to remove a specific request
  removeRequest(id: string): boolean {
    const initialLength = this.requests.length;
    this.requests = this.requests.filter(req => req.id !== id);
    if (this.requests.length !== initialLength) {
      this.saveToStorage();
      return true;
    }
    return false;
  }
}

// Create a singleton instance
export const accessRequestDB = new AccessRequestDB();