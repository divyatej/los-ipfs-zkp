// src/utils/fileUtils.ts
export const downloadFile = (data: ArrayBuffer, filename: string) => {
    const blob = new Blob([data], { type: 'application/pdf' });
    // Create a URL for the blob
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    window.URL.revokeObjectURL(url);
  };