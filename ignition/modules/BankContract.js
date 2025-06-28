const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
import dotenv from "dotenv";

dotenv.config();

const BankContractModule = buildModule("BankContractModule", (m) => {
  // 1.  Use `m.contractAt` to get a reference to the deployed AccessControl.
  //  IMPORTANT: Replace this with the actual deployed address of your AccessControl contract.
  const accessControl = m.contractAt("AccessControl", process.env.VITE_ACCESS_CONTRACT_ADDRESS ?? "");

  // 2. Deploy BankContract, passing the AccessControl address.
  const bankContract = m.contract("BankContract", [accessControl]);

  return { bankContract };
});

export default BankContractModule;
