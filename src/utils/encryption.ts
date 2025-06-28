// src/utils/encryption.ts
import CryptoJS from 'crypto-js';

export const decryptFile = async (encryptedData: string, password: string): Promise<ArrayBuffer> => {
  try {
    // Convert Blob to ArrayBuffer
    let encryptedDataBase64 = encryptedData;
    // Decrypt using CryptoJS
    const decryptedWordArray = CryptoJS.AES.decrypt(encryptedDataBase64, password);
    
    // Convert decrypted WordArray back to Uint8Array
    const byteArray = [];
    const words = decryptedWordArray.words;
    const sigBytes = decryptedWordArray.sigBytes;

    for (let i = 0; i < sigBytes; i++) {
        byteArray.push((words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff);
    }

    const decryptedArrayBuffer = new Uint8Array(byteArray).buffer;
    // Create a new Blob with the correct MIME type
    return decryptedArrayBuffer;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt file - invalid password');
  }
};