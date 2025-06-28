import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import dotenv from "dotenv";

dotenv.config();

const InitializeAccessControlModule = buildModule("InitializeAccessControlModule", (m) => {
  const accessControl = m.contractAt("AccessControl", process.env.VITE_ACCESS_CONTRACT_ADDRESS);
  const loanContract = m.contractAt("LoanContract", process.env.VITE_LOAN_CONTRACT_ADDRESS);
  const loanEligibilityVerifier = m.contractAt("LoanEligibilityVerifier", process.env.VITE_LOAN_ELIGIBILITY_VERIFIER_ADDRESS);
  // Assuming AccessControl has a function like `setLoanContractAddress`
  m.call(accessControl, "setLoanContractAddress", [loanContract]);
  m.call(accessControl, "setVerifierAddress", [loanEligibilityVerifier]);

  return { accessControl }; // Optionally return the updated AccessControl instance
});

export default InitializeAccessControlModule;