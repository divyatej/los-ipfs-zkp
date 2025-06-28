export interface AccessRequest {
    id: string;
    requester: string;
    cidType: string;
    ipfsHash: string;
    timestamp: number;
    status: 'pending' | 'approved' | 'denied';
  }