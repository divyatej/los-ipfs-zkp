// utils/loanIdManager.ts

export const getNextLoanId = (): number => {
    const lastId = localStorage.getItem('lastLoanId');
    const nextId = lastId ? parseInt(lastId) + 1 : 1;
    localStorage.setItem('lastLoanId', nextId.toString());
    return nextId;
  };

  export const updateLoanStatus = (loanId: number, status: string) => {
    const loanApplications = JSON.parse(localStorage.getItem('loanApplications') || '[]');
    const loanApplication = loanApplications.find((loan: any) => loan.loanId === loanId);
    loanApplication.status = status;
    localStorage.setItem('loanApplications', JSON.stringify(loanApplications));
  };
  
  export const saveLoanApplication = (loanData: any) => {
    const loanId = getNextLoanId();
    console.log('loanId', loanId);
    const loanWithId = {
      ...loanData,
      loanId,
      timestamp: new Date().toISOString(),
      status: "pending"
    };
    console.log('loanWithId', loanWithId);
    // Get existing loans or initialize empty array
    const existingLoans = JSON.parse(localStorage.getItem('loanApplications') || '[]');
    console.log('existingLoans', existingLoans);
    existingLoans.push(loanWithId);
    console.log('existingLoans after push', existingLoans);
    // Save back to localStorage
    try{
      localStorage.setItem('loanApplications', JSON.stringify(existingLoans));
    }
    catch(error){
      console.error('Error saving loan applications:', error);
    }
    console.log('loanApplications', localStorage.getItem('loanApplications'));
    return loanId;
  };
  
  export const getLoanApplications = () => {
    return JSON.parse(localStorage.getItem('loanApplications') || '[]');
  };
  

  export const getProcessedLoanIds = (): Set<number> => {
    const stored = localStorage.getItem('processedLoanIds');
    return new Set(stored ? JSON.parse(stored) : []);
  };
  
  const saveProcessedLoanId = (loanId: number) => {
    const processedIds = getProcessedLoanIds();
    processedIds.add(loanId);
    localStorage.setItem('processedLoanIds', JSON.stringify([...processedIds]));
  };