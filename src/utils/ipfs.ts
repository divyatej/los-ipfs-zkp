// src/utils/ipfs.ts
export const getFileFromIPFS = async (ipfsHash: string): Promise<string> => {
    try {
        const response = await fetch(`http://127.0.0.1:5001/api/v0/cat?arg=${ipfsHash}`, {
          method: 'POST',
        });
    
        if (!response.ok) {
          throw new Error(`Failed to fetch file from IPFS: ${response.statusText}`);
        }
    
        // Get the data as ArrayBuffer
        const reader = response.body?.getReader();
        let base64String = '';
        let done = false;
        while (!done) {
            const result = await reader?.read();
            if (!result) break;
            
            const { value, done: streamDone } = result;

            if (streamDone) {
                done = true;
            } else {
                const textDecoder = new TextDecoder('utf-8'); // Or the appropriate encoding
                base64String += textDecoder.decode(value);
            }
        }

        return base64String;
      } catch (error) {
        console.error('Error fetching from IPFS:', error);
        throw new Error('Failed to retrieve file from IPFS');
      }
  };