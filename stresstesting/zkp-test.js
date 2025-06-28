const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// --- Configuration ---
const rpcUrl = 'http://127.0.0.1:8501'; // Connect to Node 1's HTTP RPC port
const web3 = new Web3(rpcUrl);

// --- Deployed Contract Addresses (!!! REPLACE WITH YOUR ACTUAL DEPLOYED ADDRESSES !!!) ---
const DEPLOYED_ACCESS_CONTROL_ADDRESS = '0x7E9802eFCCF458EC5D4f695B3F8Ce325bE7f2522';
const DEPLOYED_BANK_CONTRACT_ADDRESS = '0xF1854165c72809F943791B9Fe3715b25042fE9d9'; // Still needed for setup, even if not directly called in ZKP path
const DEPLOYED_LOAN_CONTRACT_ADDRESS = '0x04a418883515b8f683Df060710121E0d627d10DB';
const DEPLOYED_VERIFIER_ADDRESS = '0x52127a32b09a7493cA404eae222d15cE0ab25c09'; // LoanEligibilityVerifier

// --- Function to load ABI from Hardhat artifact ---
function loadHardhatABI(contractName) {
    const artifactPath = path.resolve(
        __dirname,
        'artifacts',
        'contracts',
        `${contractName}.sol`,
        `${contractName}.json`
    );

    try {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        return artifact.abi;
    } catch (error) {
        console.error(`Error loading ABI for ${contractName} from ${artifactPath}:`, error.message);
        console.error("Please ensure Hardhat has compiled your contracts and the 'artifacts' folder exists at the expected path.");
        process.exit(1);
    }
}

// Load compiled contract ABIs using the helper function
const accessControlAbi = loadHardhatABI('AccessControl');
const bankContractAbi = loadHardhatABI('BankContract');
const loanContractAbi = loadHardhatABI('LoanContract');
const verifierAbi = loadHardhatABI('LoanEligibilityVerifier');


// !!! REPLACE WITH YOUR ACTUAL GETH ACCOUNT ADDRESSES AND PRIVATE KEYS !!!
// Account 0: Miner/Owner, also acts as the "Bank" in the script
// Accounts 1, 2, 3: Users
const accounts = [
    '0xd33e00FB055F9868D7Ee4345C6DC22bC51e6469E', // Account 0: Miner/Owner, also acts as the "Bank"
    '0x096A113EFfD92f0CcBE000DB45C48edD339AEc47', // Account 1: User 1
    '0xF1E17977b8ff024F418EA1a7F47F08A8C32A57E8', // Account 2: User 2
];

const privateKeys = { // Use an object for easier lookup by address
    '0xd33e00FB055F9868D7Ee4345C6DC22bC51e6469E': '0x1d7385436033d025e59a6c8133d2184f00d6af4e4c2c46dd7764c86b8831f0cb',
    '0x096A113EFfD92f0CcBE000DB45C48edD339AEc47': '0xf359c315123de5d8bfb7e642ad9acbd85d7e45fb8ecc1c7f1f32bc441b2f5aef',
    '0xF1E17977b8ff024F418EA1a7F47F08A8C32A57E8': '0xbc7c200c07cd6b148c4274cd99221cc166d2351497265da6b281ad1dbf799013',
};
// !!! REPLACE WITH YOUR MINER ACCOUNT'S PASSPHRASE (ONLY needed for initial ETH distribution) !!!
const minerPassphrase = 'test123';

// Test Parameters (!!! CHANGE THIS FOR EACH RUN: 500, 1000, 2000 !!!)
const numZkpFlows = 500; // <--- CHANGE THIS VALUE FOR EACH TEST RUN
const concurrentTransactions = 50; // Number of transactions to send concurrently
const gasPrice = web3.utils.toWei('10', 'gwei');

// ETH Distribution amounts
const initialEthForUsers = web3.utils.toWei('0.1', 'ether');

// Log file for performance data
const logFilePath = `zkp_throughput_log_${numZkpFlows}.csv`;
const resultsJsonPath = `results_zkp_${numZkpFlows}_flows.json`; // Output JSON file

// --- Global Contract Instances ---
let accessControlInstance;
let bankContractInstance;
let loanContractInstance;
let verifierInstance;

// --- Manual Nonce Management ---
const accountNonces = {}; // Stores the *next* nonce for each account (address -> nonce)
const blockSizes = {}; // Object to store block sizes by block number to avoid duplicates
const blockTimestamps = {}; // Object to store block timestamps by block number
let firstBlockNumberInTest = Infinity;
let lastBlockNumberInTest = 0;

// Function to send a transaction and log its performance
async function sendAndLogTransaction(contractInstance, methodName, args, senderAddress, txIdentifier) {
    const privateKey = privateKeys[senderAddress];
    if (!privateKey) {
        console.error(`Private key not found for sender: ${senderAddress}`);
        fs.appendFileSync(logFilePath, `${txIdentifier},${methodName},${senderAddress},ERROR,${performance.now()},${performance.now()},0,,NoPrivateKey\n`);
        return null;
    }

    const encodedABI = contractInstance.methods[methodName](...args).encodeABI();
    let gas;
    try {
        gas = await contractInstance.methods[methodName](...args).estimateGas({ from: senderAddress });
    } catch (e) {
        console.error(`Error estimating gas for ${methodName} (TxID: ${txIdentifier}): ${e.message}`);
        fs.appendFileSync(logFilePath, `${txIdentifier},${methodName},${senderAddress},ERROR,${performance.now()},${performance.now()},0,,${e.message}\n`);
        return null;
    }

    const currentNonce = accountNonces[senderAddress];
    accountNonces[senderAddress]++; // Increment for the next use

    const tx = {
        from: senderAddress,
        to: contractInstance.options.address,
        data: encodedABI,
        gas: gas,
        gasPrice: gasPrice,
        nonce: currentNonce
    };

    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

    const startTime = performance.now();
    try {
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        const endTime = performance.now();
        const latency = endTime - startTime;

        let blockSize = 0;
        if (receipt.blockNumber) {
            if (!blockSizes[receipt.blockNumber]) { // Only fetch if not already fetched
                try {
                    const block = await web3.eth.getBlock(receipt.blockNumber);
                    blockSize = block.size;
                    blockSizes[receipt.blockNumber] = blockSize;
                    blockTimestamps[receipt.blockNumber] = parseInt(block.timestamp) * 1000; // Convert to milliseconds
                } catch (blockError) {
                    console.warn(`Could not fetch block ${receipt.blockNumber} details: ${blockError.message}`);
                }
            } else {
                blockSize = blockSizes[receipt.blockNumber]; // Use stored size
            }
            // Update min/max block numbers seen during the test
            firstBlockNumberInTest = Math.min(firstBlockNumberInTest, receipt.blockNumber);
            lastBlockNumberInTest = Math.max(lastBlockNumberInTest, receipt.blockNumber);
        }
        fs.appendFileSync(logFilePath, `${txIdentifier},${methodName},${senderAddress},${receipt.transactionHash},${startTime},${endTime},${latency.toFixed(2)},${receipt.blockNumber},SUCCESS,${gas},${receipt.gasUsed},${blockSize}\n`);
        
        return receipt;
    } catch (error) {
        const endTime = performance.now();
        const latency = endTime - startTime;
        console.error(`Error sending Tx ${txIdentifier} (${methodName}):`, error.message);
        fs.appendFileSync(logFilePath, `${txIdentifier},${methodName},${senderAddress},ERROR,${startTime},${endTime},${latency.toFixed(2)},,${error.message}\n`);

        console.warn(`Attempting to resync nonce for ${senderAddress} after error...`);
        accountNonces[senderAddress] = await web3.eth.getTransactionCount(senderAddress, 'pending');
        console.warn(`Nonce for ${senderAddress} resynced to: ${accountNonces[senderAddress]}`);

        return null;
    }
}

// Function to generate a random 32-byte hash (for proofId and publicSignals)
function generateRandomBytes32() {
    return web3.utils.randomHex(32);
}

// Function to generate dummy ZKP data for simulation
function generateDummyZkpData() {
    const proofId = generateRandomBytes32();
    const proof = Array(8).fill(0).map(() => web3.utils.randomHex(32)); // Dummy 8 uint256 values
    const publicSignals = Array(4).fill(0).map(() => generateRandomBytes32()); // Dummy 4 bytes32 values
    const isQualified = Math.random() < 0.8; // 80% chance of being qualified

    return { proofId, proof, publicSignals, isQualified };
}


// Function to generate an ASCII histogram
function generateAsciiHistogram(data, bins = 10, label = "Latency (ms)") {
    if (data.length === 0) return "\nNo data to generate histogram.\n";

    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const range = maxVal - minVal;

    if (range === 0) {
        return `\n${label} Distribution (All values are ${minVal.toFixed(2)} ms):\n${minVal.toFixed(2)} | #\n`;
    }

    const binSize = range / bins;
    const histogram = new Array(bins).fill(0);
    const binLabels = [];

    for (let i = 0; i < bins; i++) {
        const lowerBound = minVal + i * binSize;
        const upperBound = minVal + (i + 1) * binSize;
        binLabels.push(`${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)}`);
    }

    data.forEach(val => {
        let binIndex = Math.floor((val - minVal) / binSize);
        if (binIndex === bins) {
            binIndex--;
        }
        histogram[binIndex]++;
    });

    const maxCount = Math.max(...histogram);
    const scale = maxCount > 50 ? 50 / maxCount : 1;

    let output = `\n${label} Distribution (Histogram):\n`;
    output += `Min: ${minVal.toFixed(2)}ms, Max: ${maxVal.toFixed(2)}ms, Avg: ${(data.reduce((a, b) => a + b, 0) / data.length).toFixed(2)}ms\n`;
    output += `Bin Size: ${binSize.toFixed(2)}ms\n`;
    output += "---------------------------------------------------------\n";

    for (let i = 0; i < bins; i++) {
        const bar = "#".repeat(Math.ceil(histogram[i] * scale));
        output += `${binLabels[i].padEnd(20)} | ${bar} (${histogram[i]} transactions)\n`;
    }
    output += "---------------------------------------------------------\n";

    return output;
}

// Function to generate an ASCII bar chart for TPS per method
function generateTpsBarChart(tpsData, totalDurationSeconds) {
    if (Object.keys(tpsData).length === 0) return "\nNo TPS data to generate bar chart.\n";

    let output = `\nTransaction Throughput (TPS) per Method:\n`;
    output += `Total Test Duration: ${totalDurationSeconds.toFixed(2)} seconds\n`;
    output += "---------------------------------------------------------\n";

    const methods = Object.keys(tpsData);
    const maxMethodNameLength = Math.max(...methods.map(m => m.length));
    const maxTps = Math.max(...Object.values(tpsData));

    const barScale = maxTps > 0 ? 50 / maxTps : 0;

    for (const method of methods) {
        const tps = tpsData[method];
        const bar = "#".repeat(Math.ceil(tps * barScale));
        output += `${method.padEnd(maxMethodNameLength)} | ${bar} ${tps.toFixed(2)} TPS\n`;
    }
    output += "---------------------------------------------------------\n";
    return output;
}


// --- Main Test Function ---
async function runZkpThroughputTest() {
    console.log('Starting ZKP Throughput Test...');

    // 0. Account Unlocking and ETH Distribution
    console.log('\n--- Unlocking Miner Account and Distributing ETH ---');
    try {
        const unlockResult = await web3.eth.personal.unlockAccount(accounts[0], minerPassphrase, 3600); // Unlock for 1 hour
        if (unlockResult) {
            console.log(`Miner account ${accounts[0]} unlocked successfully.`);
        } else {
            console.error(`Failed to unlock miner account ${accounts[0]}. Check passphrase and Geth configuration.`);
            return;
        }
    } catch (error) {
        console.error(`Error unlocking miner account: ${error.message}`);
        console.error("Make sure your Geth node has the 'personal' API enabled (e.g., --rpcapi eth,net,web3,personal) and the passphrase is correct.");
        return;
    }

    // Initialize Nonces for all sending accounts
    console.log('\n--- Initializing Account Nonces ---');
    for (const accountAddress of accounts) {
        accountNonces[accountAddress] = await web3.eth.getTransactionCount(accountAddress, 'pending');
        console.log(`Nonce for ${accountAddress}: ${accountNonces[accountAddress]}`);
    }

    // Distribute ETH to user accounts
    const ethTransferPromises = [];
    for (let i = 1; i < accounts.length; i++) {
        const userAddress = accounts[i];
        console.log(`Distributing ${web3.utils.fromWei(initialEthForUsers, 'ether')} ETH to ${userAddress}...`);

        const currentMinerNonce = accountNonces[accounts[0]];
        accountNonces[accounts[0]]++;

        ethTransferPromises.push(
            web3.eth.sendTransaction({
                from: accounts[0],
                to: userAddress,
                value: initialEthForUsers,
                gas: 21000,
                gasPrice: gasPrice,
                nonce: currentMinerNonce
            })
            .then(receipt => {
                console.log(`ETH to ${userAddress} confirmed in block ${receipt.blockNumber}.`);
                return receipt;
            })
            .catch(error => {
                console.error(`Failed to send ETH to ${userAddress}: ${error.message}`);
                web3.eth.getTransactionCount(accounts[0], 'pending').then(nonce => {
                    accountNonces[accounts[0]] = nonce;
                    console.warn(`Miner nonce resynced to: ${accountNonces[accounts[0]]}`);
                });
                return null;
            })
        );
    }
    await Promise.all(ethTransferPromises);
    console.log('ETH distribution complete. Waiting for block confirmations...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Optional: Check balances after distribution
    for (let i = 0; i < accounts.length; i++) {
        const balance = await web3.eth.getBalance(accounts[i]);
        console.log(`Balance of ${accounts[i]}: ${web3.utils.fromWei(balance, 'ether')} ETH`);
    }

    // 1. Initialize Contract Instances with Deployed Addresses
    console.log('\n--- Initializing Contract Instances with Deployed Addresses ---');
    try {
        accessControlInstance = new web3.eth.Contract(accessControlAbi, DEPLOYED_ACCESS_CONTROL_ADDRESS);
        bankContractInstance = new web3.eth.Contract(bankContractAbi, DEPLOYED_BANK_CONTRACT_ADDRESS); // Still needed for setup
        loanContractInstance = new web3.eth.Contract(loanContractAbi, DEPLOYED_LOAN_CONTRACT_ADDRESS);
        verifierInstance = new web3.eth.Contract(verifierAbi, DEPLOYED_VERIFIER_ADDRESS);
        console.log('Contract instances initialized.');
    } catch (error) {
        console.error("Failed to initialize contract instances. Ensure addresses and ABIs are correct.");
        console.error(error);
        return;
    }


    // Initialize CSV log file
    fs.writeFileSync(logFilePath, 'TxID,Method,Sender,TxHash,StartTime,EndTime,LatencyMs,BlockNumber,Status,EstimatedGas,GasUsed,BlockSize\n');

    console.log(`\n--- Sending ${numZkpFlows} ZKP-only Loan Flows for Throughput Measurement ---`);

    let transactionPromises = [];
    const zkpDataStore = {}; // Store generated ZKP data for reuse

    for (let i = 0; i < numZkpFlows; i++) {
        const numUserAccounts = accounts.length - 1; // Subtract 1 for the miner/bank account (accounts[0])
        const userAccountIndex = (i % numUserAccounts) + 1; // Cycle through accounts[1], accounts[2], etc.
        const userAddress = accounts[userAccountIndex];

        // P6: Generate dummy ZKP data
        const { proofId, proof, publicSignals, isQualified } = generateDummyZkpData();
        zkpDataStore[proofId] = { proof, publicSignals, isQualified }; // Store for potential future reference

        // P7: Store ZKP on AccessControl contract
        transactionPromises.push(
            sendAndLogTransaction(
                accessControlInstance,
                'storeProof',
                [proofId, proof, publicSignals, isQualified],
                userAddress,
                `P7_StoreProof_${i}`
            )
        );
        
        // P14: User applies for loan using the ZKP
        // The LoanContract will then internally trigger P15 (verifyProof) and P16 (approval/denial)
        const loanAmount = web3.utils.toWei('100', 'ether'); // Dummy loan amount
        transactionPromises.push(
            sendAndLogTransaction(
                loanContractInstance,
                'applyForLoan',
                [userAddress, loanAmount, proofId], // Note: sender is userAddress here, first arg is applicant
                userAddress, // The transaction sender is the user
                `P14_ApplyLoan_${i}`
            )
        );

        // Manage concurrency
        if (transactionPromises.length >= concurrentTransactions) {
            await Promise.all(transactionPromises);
            transactionPromises = [];
        }
    }

    // Wait for any remaining transactions to complete
    console.log(`Waiting for ${transactionPromises.length} remaining transactions to confirm...`);
    await Promise.all(transactionPromises);
    console.log('All ZKP-related transactions sent and confirmation awaited.');

    // --- Analysis ---
    console.log('\n--- Analyzing Throughput ---');
    // Read the entire log file
    const fullLogs = fs.readFileSync(logFilePath, 'utf-8')
                        .split('\n')
                        .slice(1) // Skip header
                        .filter(line => line.length > 0); // Filter out empty lines

    let firstTxStartTime = Infinity;
    let lastTxEndTime = 0;
    let successfulTransactions = 0;
    let failedTransactions = 0;
    const latencies = [];
    const tpsByMethod = {};
    const methodCounts = {};
    const transactionStartTimes = []; // To track all transaction start times for overall duration
    const transactionEndTimes = [];   // To track all transaction end times for overall duration


    fullLogs.forEach(line => {
        const parts = line.split(',');
        const txStatus = parts[8]; // Assuming 'SUCCESS' or 'ERROR'
        const methodName = parts[1];
        const startTime = parseFloat(parts[4]);
        const endTime = parseFloat(parts[5]);
        const latency = parseFloat(parts[6]);

        if (!isNaN(startTime)) {
            transactionStartTimes.push(startTime);
        }
        if (!isNaN(endTime)) {
            transactionEndTimes.push(endTime);
        }

        if (txStatus === 'SUCCESS') {
            successfulTransactions++;
            if (!isNaN(latency)) {
                latencies.push(latency);
            }

            methodCounts[methodName] = (methodCounts[methodName] || 0) + 1;
        } else {
            failedTransactions++;
        }
    });

    // Determine overall test duration based on the first start and last end time
    if (transactionStartTimes.length > 0) {
        firstTxStartTime = Math.min(...transactionStartTimes);
    }
    if (transactionEndTimes.length > 0) {
        lastTxEndTime = Math.max(...transactionEndTimes);
    }

    const totalDurationMs = lastTxEndTime - firstTxStartTime;
    const totalDurationSeconds = totalDurationMs / 1000;

    const overallTps = successfulTransactions / totalDurationSeconds;

    console.log(`\n--- ZKP Throughput Results ---`);
    console.log(`Total successful ZKP-related transactions: ${successfulTransactions}`);
    console.log(`Total failed ZKP-related transactions: ${failedTransactions}`);
    console.log(`Total test duration: ${totalDurationSeconds.toFixed(2)} seconds`);
    console.log(`**Overall Calculated Throughput (TPS): ${overallTps.toFixed(2)} transactions/second**`);
    console.log(`\nDetailed logs saved to: ${logFilePath}`);

    for (const method in methodCounts) {
        if (totalDurationSeconds > 0) {
            tpsByMethod[method] = methodCounts[method] / totalDurationSeconds;
        } else {
            tpsByMethod[method] = 0;
        }
    }

    // Calculate average and max latency
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

    // --- Calculate Average Block Size ---
    const uniqueBlockNumbers = Object.keys(blockSizes);
    let totalBlockSize = 0;
    uniqueBlockNumbers.forEach(blockNum => {
        totalBlockSize += blockSizes[blockNum];
    });
    const averageBlockSize = uniqueBlockNumbers.length > 0 ? totalBlockSize / uniqueBlockNumbers.length : 0;
    const maxBlockSize = uniqueBlockNumbers.length > 0 ? Math.max(...Object.values(blockSizes)) : 0;

    // --- Calculate Average Block Time ---
    let averageBlockTime = 0;
    if (lastBlockNumberInTest >= firstBlockNumberInTest && firstBlockNumberInTest !== Infinity) {
        const totalBlocksInInterval = lastBlockNumberInTest - firstBlockNumberInTest;
        if (totalBlocksInInterval > 0) {
            const totalTimeForInterval = blockTimestamps[lastBlockNumberInTest] - blockTimestamps[firstBlockNumberInTest];
            averageBlockTime = totalTimeForInterval / totalBlocksInInterval;
        }
    }

    const results = {
        numZkpFlows: numZkpFlows,
        totalTransactions: successfulTransactions + failedTransactions,
        successfulTransactions: successfulTransactions,
        failedTransactions: failedTransactions,
        totalDurationSeconds: totalDurationSeconds,
        overallTps: overallTps,
        averageLatencyMs: avgLatency,
        maxLatencyMs: maxLatency,
        tpsByMethod: tpsByMethod,
        // NEW METRICS
        averageBlockSize: averageBlockSize,
        maxBlockSize: maxBlockSize,
        averageBlockTimeMs: averageBlockTime
    };

    fs.writeFileSync(resultsJsonPath, JSON.stringify(results, null, 2));
    console.log(`\nTest results saved to: ${resultsJsonPath}`);

    // Print ASCII charts for immediate console view (optional, but good for quick checks)
    console.log(generateTpsBarChart(tpsByMethod, totalDurationSeconds));
    if (latencies.length > 0) {
        console.log(generateAsciiHistogram(latencies, 20, "Transaction Latency (ms)"));
    } else {
        console.log("\nNo successful transactions to generate latency histogram.");
    }

    console.log('Test complete!');
}

// Run the test
runZkpThroughputTest().catch(console.error);