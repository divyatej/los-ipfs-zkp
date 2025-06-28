# 🏦 los-ipfs-zkp: Loan Origination System with IPFS and ZKP

This repository contains the code for a decentralized Loan Origination System (LOS) leveraging IPFS for document storage and Zero-Knowledge Proofs (ZKPs) for privacy-preserving eligibility verification. The project integrates smart contracts, a frontend application, and provides configurations for local development and cloud-based stress testing.

## ✨ Features

* **Smart Contracts:** Core logic for loan eligibility, access control, banking operations, and mortgage/general loans implemented in Solidity.
* **IPFS Integration:** Utilizes IPFS for secure and decentralized storage of loan application artifacts.
* **Zero-Knowledge Proofs (ZKPs):** Incorporates ZKPs for privacy-preserving verification of loan eligibility criteria.
* **Frontend Application:** A user-friendly web interface built with React and Vite for interacting with the blockchain and IPFS.
* **Hardhat Development Environment:** Streamlined development, compilation, and deployment of smart contracts.
* **Geth Stress Testing Setup:** Comprehensive instructions for setting up a multi-node Geth network on cloud virtual machines for performance and scalability analysis.

## 🚀 Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites

Before you begin, ensure you have the following installed:

* **Node.js & npm:** [Download Node.js](https://nodejs.org/en/download/) (includes npm).
* **IPFS CLI:**
    ```bash
    # Install IPFS CLI (refer to official IPFS documentation for your OS)
    # Example for Linux/macOS:
    # go get -u [github.com/ipfs/go-ipfs/cmd/ipfs](https://github.com/ipfs/go-ipfs/cmd/ipfs)
    ```
* **Hardhat:** `npx hardhat init` (if not already initialized in your project root)

### 🛠️ Local Development Setup

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/your-username/los-ipfs-zkp.git](https://github.com/your-username/los-ipfs-zkp.git)
    cd los-ipfs-zkp
    ```

2.  **Initialize Hardhat Project (if not already done):**
    If this is a fresh clone and `hardhat.config.js` or `package.json` are missing, initialize a Hardhat project.
    ```bash
    npm init -y
    npx hardhat init
    ```

3.  **Install Node.js Dependencies:**
    ```bash
    npm install
    ```

4.  **IPFS Daemon Setup:**
    * Initialize IPFS:
        ```bash
        ipfs init
        ```
    * **Enable CORS for DApp interaction:** This is crucial for your frontend to communicate with your local IPFS node.
        ```bash
        ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
        ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET", "POST", "PUT", "DELETE"]'
        ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers '["Authorization", "Content-Type"]'
        ipfs config --json API.HTTPHeaders.Access-Control-Expose-Headers '["Location"]'
        ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials '["true"]'
        ```
    * Run the IPFS daemon:
        ```bash
        ipfs daemon
        ```
        Keep this terminal window open.

5.  **Start Hardhat Local Network:**
    In a new terminal, start a local blockchain node for development:
    ```bash
    npx hardhat node
    ```
    Keep this terminal window open.

6.  **Configure Environment Variables:**
    Create a `.env` file in the root directory of your project. This file should contain:
    * `WALLET_PASSPHRASE`: A passphrase for your test wallet.
    * `CONTRACT_ADDRESSES`: (Will be updated after deployment) Deployment addresses of your smart contracts.

    Example `.env` (initially, you might just have the passphrase):
    ```
    WALLET_PASSPHRASE="your_test_passphrase_here"
    # CONTRACT_ACCESS_CONTROL="0x..."
    # CONTRACT_BANK="0x..."
    # ... and so on for other contracts
    ```
    **Note:** **Never commit your `.env` file to version control.** Ensure it's in your `.gitignore`.

### ⛓️ Smart Contract Deployment (Local Hardhat Network)

1.  **Compile Smart Contracts:**
    ```bash
    npx hardhat compile
    ```

2.  **Deploy Smart Contracts:**
    It's recommended to deploy in the following order to manage dependencies, especially for `InitializeAccessControlModule`.

    ```bash
    npx hardhat ignition deploy ./ignition/modules/LoanEligibilityVerifier.js --network localhost
    npx hardhat ignition deploy ./ignition/modules/AccessControl.js --network localhost
    npx hardhat ignition deploy ./ignition/modules/BankContract.js --network localhost
    npx hardhat ignition deploy ./ignition/modules/MortgageLoanContract.js --network localhost
    npx hardhat ignition deploy ./ignition/modules/LoanContract.js --network localhost
    npx hardhat ignition deploy ./ignition/modules/MortgageContract.js --network localhost
    npx hardhat ignition deploy ./ignition/modules/InitializeAccessControlModule.js --network localhost
    ```
    **Important:** After each deployment, Hardhat Ignition will output the deployed contract address. **Update your `.env` file** with these addresses accordingly.

### 🌐 Frontend Application

1.  **Run the Frontend:**
    In a new terminal, from the project root:
    ```bash
    npm run dev
    ```
    This will start the Vite development server, and you can access the frontend in your browser (usually `http://localhost:5173/`).

## 📈 Stress Testing on Cloud Virtual Machines (Geth)

This section details how to set up a multi-node Geth private network for stress testing and performance analysis. This assumes you have access to cloud VMs (e.g., Azure, AWS, GCP) with SSH access.

### Prerequisites for Stress Testing

* **Geth:** Install a Geth version that supports Proof of Work (PoW) on your VMs.
* **SSH Access** to your cloud VMs.

### 1. Clean Existing Geth Data (on each VM)

It's crucial to start with clean data directories.
```bash
sudo rm -rf /mnt/ethereum_data/node1/geth \
&& sudo rm -rf /mnt/ethereum_data/node1/lightchaindata

sudo rm -rf /mnt/ethereum_data/node2/geth \
&& sudo rm -rf /mnt/ethereum_data/node2/lightchaindata
# repeat for other nodes
```

### 2. Initialize Geth with genesis.json

Ensure your genesis.json file (which defines your private network's initial state) is present in the directory where you run these commands on each VM.

```bash
geth --datadir /mnt/ethereum_data/node1 init genesis.json
geth --datadir /mnt/ethereum_data/node2 init genesis.json
# repeat for other nodes
```
Grant appropriate file permissions for the Geth data directory:
```bash
sudo chown azureuser:azureuser /mnt/ethereum_data # Adjust 'azureuser:azureuser' to your VM's user/group
```

### 3. Create Accounts (Node 1 - Miner/Bootnode)

On your designated "Node 1" (which will act as the network's miner and bootnode):
```bash
geth --datadir /mnt/ethereum_data/node1 account new
```
Note down the address of the newly created account. This will be your primary miner's address for the private network.

### 4. Start Geth Node 1 (Miner/Bootnode)
This node will begin mining blocks and serve as the bootnode for other peer nodes to connect to. Replace address_of_user_created with the account address you generated in the previous step.

```bash
geth --datadir /mnt/ethereum_data/node1 \
--networkid 1337 \
--http \
--http.addr "0.0.0.0" \
--http.port 8501 \
--http.api "eth,net,web3,personal,miner,admin" \
--ws \
--ws.addr "0.0.0.0" \
--ws.port 8502 \
--ws.api "eth,net,web3,personal,miner,admin" \
--authrpc.addr "0.0.0.0" \
--authrpc.port 8503 \
--authrpc.vhosts "*" \
--port 30303 \
--mine \
--miner.etherbase address_of_user_created \
--allow-insecure-unlock \
--ipcdisable \
--bootnodes "" # This node is the initial bootnode; it doesn't connect to others yet.
```
Keep this terminal window open and running.

### 5. Attach to Geth Node 1 and Start Mining
In a new terminal connected to Node 1 via SSH:

```bash
geth attach [http://127.0.0.1:8501](http://127.0.0.1:8501)
```
Once inside the Geth console:
Get the enode URL for Node 1: This URL is crucial for other nodes to discover and connect to Node 1.
```bash
admin.nodeInfo.enode
// Example output: "enode://89dd018932872afbeeb923502417a997962bcfbbad474cf446ef0e56d884ca841c01b2b4199c08385c2da6e8cf3faca7071760c85ebd374f46674deba27d4823@127.0.0.1:30303"
```
Important: Modify this enode URL to reflect Node 1's public IP address instead of 127.0.0.1. For example, if Node 1's public IP is 4.198.137.45, the enode would become:
enode://89dd018932872afbeeb923502417a997962bcfbbad474cf446ef0e56d884ca841c01b2b4199c08385c2da6e8cf3faca7071760c85ebd374f46674deba27d4823@4.198.137.45:30303
Save this modified enode URL; you'll need it for Node 2 setup.

Unlock the miner account to allow it to receive rewards:
```bash
personal.unlockAccount("0xd33e00FB055F9868D7Ee4345C6DC22bC51e6469E", "test123", 0); // Replace with your miner address and its password
```

Start mining blocks:
```bash
miner.start(1) // Start mining with 1 thread. Adjust thread count as needed.
```

### 6. Create Additional Accounts (Optional, for other users)
Still within Node 1's Geth console, create additional accounts if you plan to simulate multiple users or transactions from different entities:

```bash
personal.newAccount()
personal.newAccount()
# ... create as many as needed
```
Note down these new account addresses.

### 7. Copy Keystore Files to Other Nodes

To enable other peer nodes to use the accounts created on Node 1 (including the miner account and other user accounts), copy the keystore files.

First, list the keystore files on Node 1 to confirm their names:

```bash
ls /mnt/ethereum_data/node1/keystore
```

Then, from Node 1's terminal, securely copy all keystore files to Node 2 (and any other peer nodes). Replace <Node2_IP_Address> with the actual IP address of Node 2:

```bash
# On Node 1's terminal:
scp /mnt/ethereum_data/node1/keystore/* azureuser@<Node2_IP_Address>:/mnt/ethereum_data/node2/keystore/
# Repeat this 'scp' command for Node3, Node4, etc., if applicable.
```

Ensure that the copied files retain correct permissions on the destination nodes.

### 8. Start Geth Node 2 (and other peers)

On your designated "Node 2" (and any subsequent peer nodes):

```bash
geth --datadir /mnt/ethereum_data/node2 \
--networkid 1337 \
--http \
--http.addr "0.0.0.0" \
--http.port 8511 \
--http.api "eth,net,web3,personal,miner,admin" \
--ws \
--ws.addr "0.0.0.0" \
--ws.port 8512 \
--ws.api "eth,net,web3,personal,miner,admin" \
--authrpc.addr "0.0.0.0" \
--authrpc.port 8513 \
--authrpc.vhosts "*" \
--port 30304 \
--mine \
--miner.etherbase 0xd33e00FB055F9868D7Ee4345C6DC22bC51e6469E \ # Use an account from the copied keystore on Node 2
--allow-insecure-unlock \
--ipcdisable \
--bootnodes "enode://89dd018932872afbeeb923502417a997962bcfbbad474cf446ef0e56d884ca841c01b2b4199c08385c2da6e8cf3faca7071760c85ebd374f46674deba27d4823@4.198.137.45:30303" # Use the modified enode from Node 1 (its public IP)
```

Keep this terminal open and running. Node 2 should now connect to Node 1.

### 9. Attach to Geth Node 2 and Fund Accounts

In a new terminal connected to Node 2 via SSH:

```bash
geth attach [http://127.0.0.1:8511](http://127.0.0.1:8511)
```

Inside the Geth console:

List accounts available on Node 2 (should include those copied from Node 1):

```bash
personal.listAccounts
```

Check the balance of the miner account (from Node 1). It should be increasing as Node 1 mines:

```bash
eth.getBalance("0xd33e00FB055F9868D7Ee4345C6DC22bC51e6469E")
```

Unlock the miner account on Node 2 to allow it to send transactions:

```bash
personal.unlockAccount("0xd33e00FB055F9868D7Ee4345C6DC22bC51e6469E", "test123", 0); // Replace with your miner address and password
```

Send funds from the miner account to other user accounts (replace addresses with your actual user accounts created in step 6):

```bash
eth.sendTransaction({from: "0xd33e00FB055F9868D7Ee4345C6DC22bC51e6469E", to: "0x096a113effd92f0ccbe000db45c48edd339aec47", value: web3.toWei("10", "ether")})
eth.sendTransaction({from: "0xd33e00FB055F9868D7Ee4345C6DC22bC51e6469E", to: "0xf1e17977b8ff024f418ea1a7f47f08a8c32a57e8", value: web3.toWei("10", "ether")})
```

### 10. Decrypt Private Keys (for testing/automation)

If your stress testing scripts or automated tests require the private keys of the Geth accounts (e.g., for direct transaction signing via Hardhat), use the decrypt.js script.

Set Environment Variables:
Before running decrypt.js, set the account addresses as environment variables in your terminal:

```bash
export miner="0xd33e00FB055F9868D7Ee4345C6DC22bC51e6469E"
export user1="0x096a113effd92f0ccbe000db45c48edd339aec47"
export user2="0xf1e17977b8ff024f418ea1a7f47f08a8c32a57e8"
```

Point to Keystore Volume: Ensure the decrypt.js script (check its contents) is configured to point to the correct path of the keystore volume (e.g., /mnt/ethereum_data/node1/keystore or /mnt/ethereum_data/node2/keystore).

Run decrypt.js:
```bash
node decrypt.js # Or specify the full path, e.g., node scripts/decrypt.js
```

The output will provide the addresses and their corresponding private keys, similar to this:
const accounts = [
    '0xd33e00FB055F9868D7Ee4345C6DC22bC51e6469E', // Account 0: Miner/Owner, also acts as the "Bank"
    '0x096A113EFfD92f0CcBE000DB45C48edD339AEc47', // Account 1: User 1
    '0xF1E17977b8ff024F418EA1a7F47F08A8C32A57E8', // Account 2: User 2
];

const privateKeys = { // Use an object for easier lookup by address
    '0xd33e00FB055F9868D7Ee4345C6DC22bC51e6469E': '0x1d7385436033d025e59a6c8133d2184f00d6af4e4c2c46dd7764cxxxxxxxx',
    '0x096A113EFfD92f0CcBE000DB45C48edD339AEc47': '0xf359c315123de5d8bfb7e642ad9acbd85d7e45fb8ecc1c7f1f32bc4xxxxxx',
    '0xF1E17977b8ff024F418EA1a7F47F08A8C32A57E8': '0xbc7c200c07cd6b148c4274cd99221cc166d2351497265da6b281ad1xxxxxx',
};

Security Warning: Be extremely careful with private keys. Never hardcode them into public repositories. Use environment variables or secure key management practices like secret managers.

### 11. Clean Hardhat Ignition Deployments (before Geth deployment)

Before deploying smart contracts specifically to the Geth network, it's good practice to clear any prior Hardhat Ignition deployment artifacts to ensure a fresh deployment:

```bash
rm journal.jsonl
rm deployed_addresses.json
rm build-info/*
rm artifacts/*
```

### 12. Update .env for Geth Deployment

Update your project's .env file (in the main project directory) with the private key of your miner account on the Geth network (obtained from decrypt.js). This private key will be used by Hardhat to deploy contracts to your Geth node via its RPC endpoint.

```bash
# ... any other .env variables
MINER_PRIVATE_KEY="0x1d7385436033d025e59a6c8133d2184f00d6af4e4c2c46dd7764xxxxx" # Replace with your actual Geth miner private key
```

13. Smart Contract Deployment (to Geth Node 1)

Deploy your smart contracts to the Geth network. Ensure your Hardhat configuration (hardhat.config.js in the main project) has a network defined for gethNode1 that points to your Node 1's RPC endpoint (e.g., http://<Node1_IP_Address>:8501).

```bash
# From your main project directory (where Hardhat is configured)
npx hardhat ignition deploy ./ignition/modules/LoanEligibilityVerifier.js --network gethNode1
# Update .env with new contract address, e.g., CONTRACT_LOANELIGIBILITYVERIFIER="0x..."

npx hardhat ignition deploy ./ignition/modules/AccessControl.js --network gethNode1
# Update .env with new contract address, e.g., CONTRACT_ACCESSCONTROL="0x..."

npx hardhat ignition deploy ./ignition/modules/BankContract.js --network gethNode1
# Update .env with new contract address

npx hardhat ignition deploy ./ignition/modules/MortgageLoanContract.js --network gethNode1
# Update .env with new contract address

npx hardhat ignition deploy ./ignition/modules/LoanContract.js --network gethNode1
# Update .env with new contract address

npx hardhat ignition deploy ./ignition/modules/MortgageContract.js --network gethNode1
# Update .env with new contract address

npx hardhat ignition deploy ./ignition/modules/InitializeAccessControlModule.js --network gethNode1
# Update .env with new contract address
```

Important: Update your .env file with the deployed contract addresses after each successful deployment to the Geth network. These addresses will be needed by your stress testing scripts.

### 14. Configure Stress Testing Scripts

Locate and open fin-test.js (for IPFS-related stress testing) and zkp-test.js (for zero-knowledge proof stress testing) in your project.

Update these scripts to point to the correct Geth network RPC endpoint (http://<Node1_IP_Address>:8501 or similar) and use the contract addresses you deployed in the previous step (from your .env file).

Also update the user accounts, private keys and miner password. Use the same password for all accounts for testing purposes.

### 15. Run Stress Tests and Collect Data

Execute the automation scripts provided in your repository. These scripts will trigger the transactions and interactions required for the stress tests:

```bash
./test-automator.sh
./zkp-automate.sh
```

These scripts are designed to collect key metrics such as disk growth, CPU usage, memory consumption, and transaction latency during the stress tests.

### 16. Analyze Results

Utilize the generated JSON files and log files produced by the test-automator.sh and zkp-automate.sh scripts.

Use the provided Python code (likely located in a utils/plots/ or similar directory within your repository) to process the collected data and generate comparison graphs and visualizations needed for your performance analysis.



