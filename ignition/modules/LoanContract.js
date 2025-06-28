import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LoanContractModule = buildModule("LoanContractModule", (m) => {
  const mortgageLoanContract = m.contractAt("MortgageLoanContract", process.env.VITE_MORTGAGE_LOAN_CONTRACT_ADDRESS ?? "");
  const accessControl = m.contractAt("AccessControl", process.env.VITE_ACCESS_CONTRACT_ADDRESS ?? "");
  const loanContract = m.contract("LoanContract", [mortgageLoanContract, accessControl]);

  return { loanContract };
});

export default LoanContractModule;
