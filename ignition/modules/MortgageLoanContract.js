import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import dotenv from "dotenv";

dotenv.config();

const MortgageLoanContractModule = buildModule("MortgageLoanContractModule", (m) => {
  const bankContract = m.contractAt("BankContract", process.env.VITE_BANK_CONTRACT_ADDRESS ?? "");
  const mortgageLoanContract = m.contract("MortgageLoanContract", [bankContract]);

  return { mortgageLoanContract };
});

export default MortgageLoanContractModule;
