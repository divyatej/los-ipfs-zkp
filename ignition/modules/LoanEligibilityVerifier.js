const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
require("dotenv").config();

const LoanEligibilityVerifierModule = buildModule("LoanEligibilityVerifierModule", (m) => {
  

  //const loanContract = m.contractAt("LoanContract", process.env.VITE_LOAN_CONTRACT_ADDRESS);

  // 2. Deploy BankContract, passing the AccessControl address.
  const loanEligibilityVerifier = m.contract("LoanEligibilityVerifier");

  return { loanEligibilityVerifier };
});

module.exports = LoanEligibilityVerifierModule;