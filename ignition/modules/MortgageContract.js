import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import dotenv from "dotenv";

dotenv.config();

const MortgageContractModule = buildModule("MortgageContractModule", (m) => {
  // 1.  Use `m.contractAt` to get a reference to the deployed AccessControl.
  //  IMPORTANT: Replace this with the actual deployed address of your AccessControl contract.
  console.log(process.env.VITE_ACCESS_CONTRACT_ADDRESS);
  const accessControl = m.contractAt("AccessControl", process.env.VITE_ACCESS_CONTRACT_ADDRESS ?? "");

  // 2. Deploy MortgageContract, passing the AccessControl address.
  const mortgageContract = m.contract("MortgageContract", [accessControl]);

  return { mortgageContract };
});

export default MortgageContractModule;
