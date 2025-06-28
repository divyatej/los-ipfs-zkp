const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
require("dotenv").config();

const AccessControlModule = buildModule("AccessControlModule", (m) => {
  

  //const loanContract = m.contractAt("LoanContract", process.env.VITE_LOAN_CONTRACT_ADDRESS);

  // 2. Deploy BankContract, passing the AccessControl address.
  const accessControl = m.contract("AccessControl");

  return { accessControl };
});

module.exports = AccessControlModule;