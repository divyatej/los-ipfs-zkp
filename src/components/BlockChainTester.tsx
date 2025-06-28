import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ethers, Contract as BaseContract } from 'ethers';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Play, Square, Activity, Clock, Download, Gauge, DollarSign, XCircle, Wallet } from 'lucide-react';
import { Buffer } from 'buffer/';

// Import your contract ABIs directly
import AccessControlABI from '../../artifacts/contracts/AccessControl.sol/AccessControl.json';
import BankContractABI from '../../artifacts/contracts/BankContract.sol/BankContract.json';
import LoanContractABI from '../../artifacts/contracts/LoanContract.sol/LoanContract.json';

const ACCESS_CONTROL_ADDRESS = import.meta.env.VITE_ACCESS_CONTRACT_ADDRESS as string;
const BANK_CONTRACT_ADDRESS = import.meta.env.VITE_BANK_CONTRACT_ADDRESS as string;
const LOAN_CONTRACT_ADDRESS = import.meta.env.VITE_LOAN_CONTRACT_ADDRESS as string;

const TEST_PRIVATE_KEYS = [
    "0xd7419759388781a8f5e75ca655e3d62010a6255e066f41e4dc4a1911e7c40d65" // Hardhat account 19
];


interface DataPoint {
    time: number;
    value: number; // Actual Confirmed TPS
    currentTarget?: number; // Target Sending TPS for ramp-up
}

interface TransactionCounts {
    requestUserAccess: number;
    grantAccess: number;
    approveLoan: number;
}

interface TransactionData extends TransactionCounts {
    time: number;
}

interface TransactionRecord {
    type: 'requestUserAccess' | 'grantAccess' | 'approveLoan' | 'submitFileHash'; // Added submitFileHash for setup
    timeSent: number;
    timeConfirmed?: number;
    latency?: number;
    success: boolean;
    error?: string;
    gasUsed?: bigint;
    effectiveGasPrice?: bigint; // Added for EIP-1559 compatibility
    ethCost?: bigint; // Calculated cost in ETH
    blockNumber?: number;
    txHash?: string;
    fromAddress: string;
}

const BlockchainRealTester = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [tpsData, setTpsData] = useState<DataPoint[]>([]);
    const [transactionData, setTransactionData] = useState<TransactionData[]>([]);
    const [tps, setTps] = useState({ current: 0, peak: 0, average: 0 });
    const [isWalletsInitialized, setIsWalletsInitialized] = useState(false);
    const [provider, setProvider] = useState<ethers.JsonRpcProvider | null>(null);
    const [testWallets, setTestWallets] = useState<ethers.Wallet[]>([]);
    const [totalTransactionsConfirmed, setTotalTransactionsConfirmed] = useState(0);
    const [initializationStatus, setInitializationStatus] = useState('');
    const [testStatusMessage, setTestStatusMessage] = useState('');

    const [rampUpDuration, setRampUpDuration] = useState(120);
    const [rampUpStartTps, setRampUpStartTps] = useState(1);
    const [rampUpEndTps, setRampUpEndTps] = useState(30);
    const [currentRampUpTargetTps, setCurrentRampUpTargetTps] = useState(0);

    const [totalTransactionsAttempted, setTotalTransactionsAttempted] = useState(0);
    const [successRate, setSuccessRate] = useState(0);
    const [avgLatencyByType, setAvgLatencyByType] = useState<Record<string, number>>({});
    const [totalGasUnitsUsedByType, setTotalGasUnitsUsedByType] = useState<Record<string, bigint>>({ // Renamed
        requestUserAccess: BigInt(0), grantAccess: BigInt(0), approveLoan: BigInt(0), submitFileHash: BigInt(0)
    });
    const [totalEthCostByType, setTotalEthCostByType] = useState<Record<string, bigint>>({ // Added
        requestUserAccess: BigInt(0), grantAccess: BigInt(0), approveLoan: BigInt(0), submitFileHash: BigInt(0)
    });
    const [failedTransactionBreakdown, setFailedTransactionBreakdown] = useState<Record<string, number>>({});

    const accessControlContractRef = useRef<BaseContract | null>(null);
    const bankContractRef = useRef<BaseContract | null>(null);
    const loanContractRef = useRef<BaseContract | null>(null);

    // walletNoncePromisesRef now stores a Promise<number> which resolves to the *next available nonce*
    // for that wallet, after the last transaction in its queue has been processed.
    const walletNoncePromisesRef = useRef<Map<string, Promise<number>>>(new Map());
    // NEW: A ref to hold all transaction promises that are currently in flight
    const allInFlightTxPromisesRef = useRef<Promise<TransactionRecord>[]>([]);


    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const allTpsValuesRef = useRef<DataPoint[]>([]);
    const allTransactionRecordsRef = useRef<TransactionRecord[]>([]);

    const initializeTestClients = useCallback(async () => {
        try {
            setInitializationStatus('Initializing RPC Provider and Wallets...');

            const rpcProvider = new ethers.JsonRpcProvider("http://localhost:8545");
            setProvider(rpcProvider);

            const wallets: ethers.Wallet[] = [];
            const initialNoncePromises = new Map<string, Promise<number>>();

            for (const pk of TEST_PRIVATE_KEYS) {
                try {
                    const wallet = new ethers.Wallet(pk, rpcProvider);
                    wallets.push(wallet);
                    const address = await wallet.getAddress();
                    // Initialize each wallet's nonce promise with its current transaction count
                    initialNoncePromises.set(address, rpcProvider.getTransactionCount(address, "pending"));
                    console.log(`Initialized wallet ${address}`);
                } catch (walletError) {
                    console.error(`Failed to initialize wallet for private key (ensure it's valid): ${pk.substring(0, 10)}...`, walletError);
                }
            }

            if (wallets.length === 0) {
                throw new Error('No valid private keys found or wallets failed to initialize. Please check TEST_PRIVATE_KEYS and ensure accounts are funded.');
            }
            setTestWallets(wallets);
            walletNoncePromisesRef.current = initialNoncePromises; // Store the initial nonce promises
            setIsWalletsInitialized(true);
            setInitializationStatus(`Initialized ${wallets.length} programmatic wallets.`);

            accessControlContractRef.current = new ethers.Contract(
                ACCESS_CONTROL_ADDRESS,
                AccessControlABI.abi,
                wallets[0]
            );
            bankContractRef.current = new ethers.Contract(
                BANK_CONTRACT_ADDRESS,
                BankContractABI.abi,
                wallets[0]
            );
            loanContractRef.current = new ethers.Contract(
                LOAN_CONTRACT_ADDRESS,
                LoanContractABI.abi,
                wallets[0]
            );

            console.log('Programmatic wallets and contracts initialized.');
        } catch (error) {
            console.error('Error initializing programmatic wallets:', error);
            setInitializationStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            alert(`Failed to setup programmatic wallets: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, []);

    useEffect(() => {
        initializeTestClients();
    }, [initializeTestClients]);

    const generateRandomCID = () => {
        const randomBytes = ethers.randomBytes(32);
        const hash = ethers.sha256(randomBytes);
        return `Qm${Buffer.from(hash.substring(2), 'hex').toString('base64').substring(0, 42)}`;
    };

    const generateRandomLoanId = () => {
        const randomNumber = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        return ethers.toBigInt(randomNumber);
    };

    /**
     * Helper function to send a transaction using a specific signer and record its details.
     * Ensures sequential nonce usage for each wallet.
     *
     * IMPORTANT: This function now returns a Promise<TransactionRecord> that resolves
     * *after* the transaction has been mined and the record is fully populated.
     */
    const sendAndRecordTransaction = useCallback(async (
        contract: BaseContract,
        methodName: string,
        args: any[],
        type: TransactionRecord['type'],
        signer: ethers.Wallet // The specific wallet (signer) to use for this transaction
    ): Promise<TransactionRecord> => {
        const timeSent = Date.now();
        const fromAddress = await signer.getAddress();

        // Initialize record. It will be mutated and returned later.
        // Set success to false initially.
        const record: TransactionRecord = {
            type,
            timeSent,
            success: false,
            fromAddress: fromAddress,
        };

        // Get the current promise for this wallet's nonce chain
        let currentNoncePromise = walletNoncePromisesRef.current.get(fromAddress);
        if (!currentNoncePromise) {
            // Fallback: If for some reason not in map, get initial nonce
            console.warn(`Nonce promise not found for ${fromAddress}. Fetching current nonce for initialization.`);
            currentNoncePromise = signer.provider!.getTransactionCount(fromAddress, "pending");
        }

        // Chain the new transaction onto the existing promise for this wallet.
        // This creates a strict sequence of transactions for each individual wallet.
        const nextNoncePromise = currentNoncePromise.then(async (currentNonce) => {
            try {
                const txOptions = { nonce: currentNonce };
                const tx = await (contract as any)[methodName](...args, txOptions);

                record.txHash = tx.hash;
                // Await the receipt to ensure transaction is mined and confirmed
                const receipt = await tx.wait();

                if (receipt && receipt.status === 1) { // Check receipt status for success (1 means success)
                    record.timeConfirmed = Date.now();
                    record.latency = record.timeConfirmed - timeSent;
                    record.success = true; // Only set to true if receipt is valid and status is 1
                    record.gasUsed = receipt.gasUsed;
                    record.blockNumber = receipt.blockNumber;

                    // Capture effectiveGasPrice and calculate ethCost
                    if (receipt.effectiveGasPrice) {
                        record.effectiveGasPrice = receipt.effectiveGasPrice;
                    } else if (tx.gasPrice) { // Fallback for older transactions or non-EIP-1559 networks
                        record.effectiveGasPrice = tx.gasPrice;
                    }
                    if (record.gasUsed && record.effectiveGasPrice) {
                        record.ethCost = record.gasUsed * record.effectiveGasPrice;
                    }

                } else {
                    // If receipt exists but status is 0 (reverted), or receipt is null/undefined
                    record.success = false; // Explicitly set to false
                    record.error = receipt ? `Transaction Reverted (Status 0) in Block ${receipt.blockNumber}` : 'Transaction receipt not found or failed to be mined';
                    console.error(`Transaction ${type} failed from ${fromAddress} (no valid receipt or reverted):`, record.error, tx.hash);
                }
                return currentNonce + 1; // Resolve with the next nonce for the chain
            } catch (err: any) {
                console.error(`Transaction ${type} failed from ${fromAddress}:`, err);
                record.success = false; // Explicitly set to false on any error
                if (err.code === 'INSUFFICIENT_FUNDS') {
                    record.error = 'INSUFFICIENT_FUNDS';
                } else if (err.code === 'UNPREDICTABLE_GAS_LIMIT' || err.code === 'CALL_EXCEPTION') {
                    record.error = `CONTRACT_REVERT: ${err.reason || err.data?.message || err.message}`;
                } else if (err.message && (err.message.includes("nonce has already been used") || err.message.includes("Nonce too low"))) {
                    record.error = "NONCE_COLLISION: " + err.message;
                } else {
                    record.error = `UNKNOWN_ERROR: ${err.message || 'No message'}`;
                }
                // If the transaction fails, fetch the actual latest nonce from the network.
                // This is crucial to recover from a bad nonce state for subsequent transactions.
                // Await here to ensure we get the correct nonce for the next chained transaction.
                return signer.provider!.getTransactionCount(fromAddress, "pending");
            } finally {
                // Push the *fully populated* record to the global ref ONLY ONCE it's truly resolved/rejected
                allTransactionRecordsRef.current.push(record);
                // Remove this promise from the in-flight list
                allInFlightTxPromisesRef.current = allInFlightTxPromisesRef.current.filter(p => p !== promiseHoldingRecord);
            }
        });

        // Create a promise that resolves with the `record` *after* nextNoncePromise settles.
        // This intermediate promise is what we'll add to `allInFlightTxPromisesRef`.
        const promiseHoldingRecord = nextNoncePromise.then(() => record);

        // Update the walletNoncePromisesRef with the new promise (which resolves to the next nonce).
        walletNoncePromisesRef.current.set(fromAddress, nextNoncePromise);
        // Add the promise that holds the record to our overall in-flight list.
        allInFlightTxPromisesRef.current.push(promiseHoldingRecord);


        // Return a promise that resolves to the *final* TransactionRecord object
        // after the transaction has been completely processed (mined or failed).
        // This is the promise `executeLoanInteraction` will await.
        return promiseHoldingRecord;
    }, []);

    /**
     * Executes a full loan interaction flow involving multiple contract calls
     * using a specific signer for all calls within this interaction.
     * Returns an array of TransactionRecord for each step.
     */
    const executeLoanInteraction = useCallback(async (
        userAddress: string,
        personalIpfsHash: string,
        financialIpfsHash: string,
        signer: ethers.Wallet
    ): Promise<TransactionRecord[]> => {
        if (!accessControlContractRef.current || !bankContractRef.current || !loanContractRef.current) {
            console.error('Contracts not initialized!');
            return [];
        }

        const interactionRecords: TransactionRecord[] = [];

        const bankContractWithSigner = new ethers.Contract(
            BANK_CONTRACT_ADDRESS,
            BankContractABI.abi,
            signer
        );
        const accessControlContractWithSigner = new ethers.Contract(
            ACCESS_CONTROL_ADDRESS,
            AccessControlABI.abi,
            signer
        );
        const loanContractWithSigner = new ethers.Contract(
            LOAN_CONTRACT_ADDRESS,
            LoanContractABI.abi,
            signer
        );

        // Now, await each call to sendAndRecordTransaction.
        // This ensures that `interactionRecords` will contain fully resolved TransactionRecord objects
        // when this `executeLoanInteraction` promise resolves.
        interactionRecords.push(await sendAndRecordTransaction(
            bankContractWithSigner,
            'requestUserAccess',
            [userAddress, personalIpfsHash, financialIpfsHash],
            'requestUserAccess',
            signer
        ));

        interactionRecords.push(await sendAndRecordTransaction(
            accessControlContractWithSigner,
            'grantAccess',
            [userAddress, "personal", personalIpfsHash],
            'grantAccess',
            signer
        ));

        interactionRecords.push(await sendAndRecordTransaction(
            accessControlContractWithSigner,
            'grantAccess',
            [userAddress, "financial", financialIpfsHash],
            'grantAccess',
            signer
        ));

        const loanAmount = ethers.toBigInt(1);
        const loanId = generateRandomLoanId();
        const loanType = 'personal';

        interactionRecords.push(await sendAndRecordTransaction(
            loanContractWithSigner,
            'approveLoan',
            [loanId, loanAmount, personalIpfsHash, financialIpfsHash, userAddress, loanType],
            'approveLoan',
            signer
        ));

        return interactionRecords;
    }, [sendAndRecordTransaction]);

    const updateSummaryMetrics = useCallback(() => {
        const successfulRecords = allTransactionRecordsRef.current.filter(r => r.success);
        const failedRecords = allTransactionRecordsRef.current.filter(r => !r.success);

        // This is now the definitive source for total attempted transactions
        const totalAttempted = allTransactionRecordsRef.current.length;
        setTotalTransactionsAttempted(totalAttempted);

        const successRateCalc = totalAttempted > 0 ? (successfulRecords.length / totalAttempted) * 100 : 0;
        setSuccessRate(successRateCalc);

        const latencyByType: Record<string, { sum: number; count: number; }> = {};
        const gasUnitsUsedByType: Record<string, bigint> = { // Renamed
            requestUserAccess: BigInt(0), grantAccess: BigInt(0), approveLoan: BigInt(0), submitFileHash: BigInt(0)
        };
        const ethCostByType: Record<string, bigint> = { // Added
            requestUserAccess: BigInt(0), grantAccess: BigInt(0), approveLoan: BigInt(0), submitFileHash: BigInt(0)
        };
        const errorCounts: Record<string, number> = {};

        successfulRecords.forEach(record => {
            if (record.latency !== undefined) {
                latencyByType[record.type] = latencyByType[record.type] || { sum: 0, count: 0 };
                latencyByType[record.type].sum += record.latency;
                latencyByType[record.type].count++;
            }
            if (record.gasUsed !== undefined) {
                gasUnitsUsedByType[record.type] = gasUnitsUsedByType[record.type] + record.gasUsed;
            }
            if (record.ethCost !== undefined) { // Aggregate ETH cost
                ethCostByType[record.type] = ethCostByType[record.type] + record.ethCost;
            }
        });

        failedRecords.forEach(record => {
            const errorKey = record.error || 'Unknown Error';
            errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
        });

        const averageLatency: Record<string, number> = {};
        for (const type in latencyByType) {
            // Corrected: Use the 'type' variable directly to check against 'submitFileHash'
            averageLatency[type] = type === 'submitFileHash' ? 0 : (latencyByType[type].count > 0 ? latencyByType[type].sum / latencyByType[type].count : 0);
        }
        setAvgLatencyByType(averageLatency);
        setTotalGasUnitsUsedByType(gasUnitsUsedByType); // Set new state
        setTotalEthCostByType(ethCostByType); // Set new state
        setFailedTransactionBreakdown(errorCounts);
    }, []);

    const runTest = useCallback(async () => {
        if (!provider || testWallets.length === 0) {
            alert('Please initialize programmatic wallets first.');
            return;
        }

        setTestStatusMessage('Initializing test...');
        setIsRunning(true);
        const now = Date.now();
        setStartTime(now);
        setElapsedTime(0);
        // Reset all data and metrics for a new run
        setTpsData([]);
        setTransactionData([]);
        setTps({ current: 0, peak: 0, average: 0 });
        setTotalTransactionsConfirmed(0);
        setSuccessRate(0);
        setAvgLatencyByType({});
        setTotalGasUnitsUsedByType({ requestUserAccess: BigInt(0), grantAccess: BigInt(0), approveLoan: BigInt(0), submitFileHash: BigInt(0) }); // Reset state
        setTotalEthCostByType({ requestUserAccess: BigInt(0), grantAccess: BigInt(0), approveLoan: BigInt(0), submitFileHash: BigInt(0) }); // Reset state
        setFailedTransactionBreakdown({});

        allTpsValuesRef.current = [];
        allTransactionRecordsRef.current = []; // Clear all previous records
        allInFlightTxPromisesRef.current = []; // Clear all in-flight promises at the start of a new test

        try {
            const userAddresses = testWallets.map(wallet => wallet.address);

            setTestStatusMessage('Checking/Submitting initial IPFS hashes...');
            let personalIpfsHash = generateRandomCID();
            let financialIpfsHash = generateRandomCID();
            const cidTypePersonal = 'personal';
            const cidTypeFinancial = 'financial';

            if (!accessControlContractRef.current) {
                throw new Error('AccessControl contract not initialized for initial setup.');
            }

            const setupSigner = testWallets[0];
            const accessControlWithSigner = new ethers.Contract(
                ACCESS_CONTROL_ADDRESS,
                AccessControlABI.abi,
                setupSigner
            );

            try {
                let existingPersonalIpfsHash = '';
                try {
                    existingPersonalIpfsHash = await (accessControlWithSigner as any).getCID(cidTypePersonal);
                } catch (getCIDError: any) {
                    if (getCIDError.code === 'BAD_DATA' && getCIDError.value === '0x') {
                        console.warn(`getCID for personal returned 0x (likely not set yet).`);
                        existingPersonalIpfsHash = '';
                    } else {
                        throw getCIDError;
                    }
                }

                if (existingPersonalIpfsHash && existingPersonalIpfsHash !== '0x') {
                    personalIpfsHash = existingPersonalIpfsHash;
                    console.log('Using existing personal IPFS hash:', personalIpfsHash);
                } else {
                    console.log('Personal IPFS hash not found, submitting new hash...');
                    // Await the fully resolved record from sendAndRecordTransaction
                    const record = await sendAndRecordTransaction(
                        accessControlWithSigner,
                        'submitFileHash',
                        [personalIpfsHash, cidTypePersonal],
                        'submitFileHash', // Use the correct type for setup tx
                        setupSigner
                    );
                    if (!record.success) {
                        throw new Error(`Failed to submit initial personal IPFS hash: ${record.error}`);
                    }
                    console.log('Submitted new personal IPFS hash.');
                }

                let existingFinancialIpfsHash = '';
                try {
                    existingFinancialIpfsHash = await (accessControlWithSigner as any).getCID(cidTypeFinancial);
                } catch (getCIDError: any) {
                    if (getCIDError.code === 'BAD_DATA' && getCIDError.value === '0x') {
                        console.warn(`getCID for financial returned 0x (likely not set yet).`);
                        existingFinancialIpfsHash = '';
                    } else {
                        throw getCIDError;
                    }
                }

                if (existingFinancialIpfsHash && existingFinancialIpfsHash !== '0x') {
                    financialIpfsHash = existingFinancialIpfsHash;
                    console.log('Using existing financial IPFS hash:', financialIpfsHash);
                } else {
                    console.log('Financial IPFS hash not found, submitting new hash...');
                    const record = await sendAndRecordTransaction(
                        accessControlWithSigner,
                        'submitFileHash',
                        [financialIpfsHash, cidTypeFinancial],
                        'submitFileHash', // Use the correct type for setup tx
                        setupSigner
                    );
                    if (!record.success) {
                        throw new Error(`Failed to submit initial financial IPFS hash: ${record.error}`);
                    }
                    console.log('Submitted new financial IPFS hash.');
                }

            } catch (setupError) {
                console.error("Error during initial IPFS hash setup:", setupError);
                setTestStatusMessage(`Setup failed: ${setupError instanceof Error ? setupError.message : 'Unknown setup error'}`);
                setIsRunning(false);
                return;
            }

            setTestStatusMessage('Ramp-up test in progress...');

            const tpsIncrementPerSecond = (rampUpEndTps - rampUpStartTps) / rampUpDuration;
            setCurrentRampUpTargetTps(rampUpStartTps);

            // Store a reference to the main interval function so we can call it one last time
            // to process the final second's transactions.
            let finalIntervalProcessingPromise: Promise<void> | null = null;


            intervalRef.current = setInterval(async () => {
                const currentTime = Date.now();
                const elapsed = Math.floor((currentTime - now) / 1000);
                setElapsedTime(elapsed);

                const currentTarget = Math.min(rampUpEndTps, rampUpStartTps + tpsIncrementPerSecond * elapsed);
                setCurrentRampUpTargetTps(currentTarget);

                const interactionPromisesForThisSecond: Promise<TransactionRecord[]>[] = [];
                const numInteractionsThisSecond = Math.max(1, Math.round(currentTarget));

                for (let i = 0; i < numInteractionsThisSecond; i++) {
                    const walletIndex = i % testWallets.length;
                    const currentWallet = testWallets[walletIndex];
                    const userAddressForInteraction = userAddresses[walletIndex];

                    // Push the promise returned by executeLoanInteraction
                    interactionPromisesForThisSecond.push(executeLoanInteraction(userAddressForInteraction, personalIpfsHash, financialIpfsHash, currentWallet));
                }

                // --- Start of processing for this second ---
                // This is a self-contained async block for each second's processing
                // so it won't block the next second's interval from starting.
                const processSecond = async () => {
                    const results = await Promise.allSettled(interactionPromisesForThisSecond);

                    let currentSecondConfirmedTransactions = 0;
                    const aggregatedCurrentSecond: TransactionCounts = {
                        requestUserAccess: 0,
                        grantAccess: 0,
                        approveLoan: 0,
                    };

                    let tempFailedBreakdown: Record<string, number> = {};

                    results.forEach(result => {
                        if (result.status === 'fulfilled') {
                            result.value.forEach(record => {
                                if (record.success) {
                                    if (record.type === 'requestUserAccess' || record.type === 'grantAccess' || record.type === 'approveLoan') {
                                        aggregatedCurrentSecond[record.type]++;
                                    }
                                    currentSecondConfirmedTransactions++;
                                } else {
                                    console.log("Failed record (processed in runTest):", record);
                                    const errorKey = record.error || 'Unknown Error';
                                    tempFailedBreakdown[errorKey] = (tempFailedBreakdown[errorKey] || 0) + 1;
                                }
                            });
                        } else {
                            const errorKey = result.reason instanceof Error ? result.reason.message : String(result.reason) || 'Promise Rejected (Interaction Level)';
                            tempFailedBreakdown[errorKey] = (tempFailedBreakdown[errorKey] || 0) + 1;
                            console.warn('Loan interaction promise rejected (overall):', result.reason);
                        }
                    });

                    setTotalTransactionsConfirmed(prev => prev + currentSecondConfirmedTransactions);

                    setTpsData(prev => {
                        const newData = [...prev, { time: elapsed, value: currentSecondConfirmedTransactions, currentTarget: currentTarget }];
                        return newData;
                    });

                    setTransactionData(prev => {
                        const newData = [...prev, { time: elapsed, ...aggregatedCurrentSecond }];
                        return newData;
                    });

                    setTps(current => {
                        const newPeak = Math.max(current.peak, currentSecondConfirmedTransactions);
                        allTpsValuesRef.current.push({ time: elapsed, value: currentSecondConfirmedTransactions });

                        const newAverage = allTpsValuesRef.current.length > 0
                            ? allTpsValuesRef.current.reduce((sum, point) => sum + point.value, 0) / allTpsValuesRef.current.length
                            : 0;

                        return {
                            current: currentSecondConfirmedTransactions,
                            peak: newPeak,
                            average: newAverage
                        };
                    });

                    setFailedTransactionBreakdown(prev => {
                        const newState = { ...prev };
                        for (const key in tempFailedBreakdown) {
                            newState[key] = (newState[key] || 0) + tempFailedBreakdown[key];
                        }
                        return newState;
                    });
                };
                // --- End of processing for this second ---

                // Run the processing for this second
                processSecond();

                if (elapsed >= rampUpDuration) {
                    clearInterval(intervalRef.current!);
                    setTestStatusMessage('Ramp-up test completed. Waiting for remaining transactions...');

                    // NEW: Wait for all in-flight transactions to settle
                    // Create a promise for the very last second's processing
                    finalIntervalProcessingPromise = processSecond();

                    // Wait for all in-flight promises to resolve
                    // This will only resolve AFTER all `sendAndRecordTransaction` promises have run their `finally` blocks
                    // and pushed their records to `allTransactionRecordsRef.current`.
                    await Promise.allSettled(allInFlightTxPromisesRef.current);

                    setTestStatusMessage('All transactions processed. Finalizing metrics...');
                    setIsRunning(false);
                    updateSummaryMetrics(); // Call updateSummaryMetrics AFTER all transactions have settled
                    console.log('Ramp-up test completed and all transactions processed.');
                    return;
                }

            }, 1000); // Run every second

        } catch (error) {
            console.error('Error during test setup or execution:', error);
            setIsRunning(false);
            setTestStatusMessage(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            alert(`Failed to run test: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [provider, testWallets, rampUpDuration, rampUpStartTps, rampUpEndTps, executeLoanInteraction, sendAndRecordTransaction, updateSummaryMetrics]); // Added updateSummaryMetrics to deps

    const stopTest = useCallback(() => {
        console.log('Stopping test...');
        setIsRunning(false);
        setTestStatusMessage('Test stopped by user. Waiting for remaining transactions...');
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        // When stopping manually, also wait for in-flight transactions
        Promise.allSettled(allInFlightTxPromisesRef.current).then(() => {
            setTestStatusMessage('All transactions processed. Finalizing metrics...');
            updateSummaryMetrics();
            console.log('Test stopped and all transactions processed.');
        });
    }, [updateSummaryMetrics]); // Added updateSummaryMetrics to deps

    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            // Also clear any lingering promises if component unmounts unexpectedly
            allInFlightTxPromisesRef.current = [];
        };
    }, []);


    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleExportData = useCallback(async () => {
        // Ensure the latest metrics are calculated before export
        updateSummaryMetrics();

        const successfulRecords = allTransactionRecordsRef.current.filter(r => r.success);
        const failedRecords = allTransactionRecordsRef.current.filter(r => !r.success);

        const totalAttempted = allTransactionRecordsRef.current.length;
        const successRateCalc = totalAttempted > 0 ? (successfulRecords.length / totalAttempted) * 100 : 0;

        const latencyByType: Record<string, { sum: number; count: number; }> = {};
        const gasUnitsUsedByTypeExport: Record<string, bigint> = { // Renamed for export
            requestUserAccess: BigInt(0), grantAccess: BigInt(0), approveLoan: BigInt(0), submitFileHash: BigInt(0)
        };
        const ethCostByTypeExport: Record<string, bigint> = { // Added for export
            requestUserAccess: BigInt(0), grantAccess: BigInt(0), approveLoan: BigInt(0), submitFileHash: BigInt(0)
        };
        const errorCounts: Record<string, number> = {};

        successfulRecords.forEach(record => {
            if (record.latency !== undefined) {
                latencyByType[record.type] = latencyByType[record.type] || { sum: 0, count: 0 };
                latencyByType[record.type].sum += record.latency;
                latencyByType[record.type].count++;
            }
            if (record.gasUsed !== undefined) {
                gasUnitsUsedByTypeExport[record.type] = gasUnitsUsedByTypeExport[record.type] + record.gasUsed;
            }
            if (record.ethCost !== undefined) { // Aggregate ETH cost for export
                ethCostByTypeExport[record.type] = ethCostByTypeExport[record.type] + record.ethCost;
            }
        });

        failedRecords.forEach(record => {
            const errorKey = record.error || 'Unknown Error';
            errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
        });

        const averageLatency: Record<string, number> = {};
        for (const type in latencyByType) {
            // Corrected: Use the 'type' variable directly to check against 'submitFileHash'
            averageLatency[type] = type === 'submitFileHash' ? 0 : (latencyByType[type].count > 0 ? latencyByType[type].sum / latencyByType[type].count : 0);
        }

        const activeSignerAddresses = Array.from(new Set(allTransactionRecordsRef.current.map(rec => rec.fromAddress)));


        const dataToExport = {
            testParameters: {
                testType: "Ramp-Up Load Test (Programmatic Wallets)",
                rampUpDurationSeconds: rampUpDuration,
                rampUpStartTps: rampUpStartTps,
                rampUpEndTps: rampUpEndTps,
                programmaticWalletsUsedCount: TEST_PRIVATE_KEYS.length,
                activeSignerAddresses: activeSignerAddresses,
                rpcEndpoint: "http://localhost:8545",
                startTime: startTime ? new Date(startTime).toISOString() : 'N/A',
                endTime: isRunning ? 'N/A (Test still running)' : new Date().toISOString(),
                networkInfo: provider ? `Connected chain ID: ${(await provider.getNetwork()).chainId || 'N/A'}` : 'N/A',
                contractAddresses: {
                    ACCESS_CONTROL_ADDRESS,
                    BANK_CONTRACT_ADDRESS,
                    LOAN_CONTRACT_ADDRESS
                }
            },
            summaryMetrics: {
                finalElapsedTimeSeconds: elapsedTime,
                totalTransactionsAttempted: totalAttempted,
                totalTransactionsConfirmed: successfulRecords.length,
                overallSuccessRatePercent: successRateCalc.toFixed(2),
                finalAverageConfirmedTps: tps.average.toFixed(2),
                peakConfirmedTps: tps.peak.toFixed(2),
                averageLatencyMsByType: averageLatency,
                totalGasUnitsUsedByType: gasUnitsUsedByTypeExport, // Use the local calc here
                totalEthCostByType: ethCostByTypeExport, // Add ETH cost to export
                failedTransactionCount: failedRecords.length,
                detailedErrorBreakdown: errorCounts,
            },
            rawTpsDataPerSecond: tpsData,
            rawTransactionBreakdownPerSecond: transactionData,
            detailedTransactionRecords: allTransactionRecordsRef.current
        };

        const jsonString = JSON.stringify(dataToExport, (key, value) => {
            if (typeof value === 'bigint') {
                return value.toString();
            }
            return value;
        }, 2);

        const element = document.createElement("a");
        const file = new Blob([jsonString], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = `blockchain_tps_test_results_${Date.now()}.json`;
        document.body.appendChild(element);
        document.body.removeChild(element);
    }, [rampUpDuration, rampUpStartTps, rampUpEndTps, startTime, elapsedTime, isRunning, provider, tps.average, tps.peak, tpsData, transactionData, allTransactionRecordsRef, updateSummaryMetrics]);


    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-center">Blockchain Throughput Tester (Ramp-Up Mode - Direct RPC)</h1>

            {!isWalletsInitialized ? (
                <div className="text-center bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <p className="text-lg text-gray-700 mb-4">{initializationStatus || 'Initializing programmatic wallets for testing...'}</p>
                    <button
                        onClick={initializeTestClients}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 shadow-md"
                        disabled={initializationStatus.includes('Initializing')}
                    >
                        <Wallet className="inline-block mr-2 w-5 h-5" /> Initialize Test Wallets
                    </button>
                    {initializationStatus.includes('Error') && <p className="mt-4 text-red-600 text-sm">{initializationStatus}</p>}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label htmlFor="rampDuration" className="font-medium text-gray-700">Ramp Up Duration (s):</label>
                                <input
                                    type="number"
                                    id="rampDuration"
                                    min="10"
                                    max="600"
                                    className="w-28 border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={rampUpDuration}
                                    onChange={(e) => setRampUpDuration(parseInt(e.target.value) || 300)}
                                    disabled={isRunning}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <label htmlFor="startTps" className="font-medium text-gray-700">Start TPS:</label>
                                <input
                                    type="number"
                                    id="startTps"
                                    min="1"
                                    max="10"
                                    className="w-20 border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={rampUpStartTps}
                                    onChange={(e) => setRampUpStartTps(parseInt(e.target.value) || 1)}
                                    disabled={isRunning}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <label htmlFor="endTps" className="font-medium text-gray-700">End TPS:</label>
                                <input
                                    type="number"
                                    id="endTps"
                                    min="1"
                                    max="1000"
                                    className="w-20 border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={rampUpEndTps}
                                    onChange={(e) => setRampUpEndTps(parseInt(e.target.value) || 30)}
                                    disabled={isRunning}
                                />
                            </div>

                            <button
                                onClick={runTest}
                                className={`flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md ${
                                    isRunning ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                disabled={isRunning || !isWalletsInitialized}
                            >
                                <Play className="inline-block mr-2 w-4 h-4" /> Start Ramp-Up Test
                            </button>

                            <button
                                onClick={stopTest}
                                className={`flex items-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md ${
                                    !isRunning ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                disabled={!isRunning}
                            >
                                <Square className="inline-block mr-2 w-4 h-4" /> Stop Test
                            </button>

                            <div className="flex items-center text-gray-600 font-medium ml-auto">
                                <Clock className="inline-block mr-2 w-4 h-4" />
                                <span>Elapsed: {formatTime(elapsedTime)} / {formatTime(rampUpDuration)}</span>
                                <span className="ml-4 flex items-center">
                                    <Gauge className="inline-block mr-1 w-4 h-4" />
                                    Target: {currentRampUpTargetTps.toFixed(1)} TPS
                                </span>
                            </div>
                        </div>
                        {testStatusMessage && <p className="mt-3 text-sm text-gray-600">{testStatusMessage}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 flex flex-col justify-center items-center">
                            <h3 className="text-lg font-semibold mb-2 flex items-center text-gray-700">
                                <Activity className="mr-2 w-5 h-5 text-blue-600" />
                                Current Confirmed TPS
                            </h3>
                            <p className="text-4xl font-bold text-blue-600">{tps.current.toFixed(2)}</p>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 flex flex-col justify-center items-center">
                            <h3 className="text-lg font-semibold mb-2 text-gray-700">Peak Confirmed TPS</h3>
                            <p className="text-4xl font-bold text-green-600">{tps.peak.toFixed(2)}</p>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 flex flex-col justify-center items-center">
                            <h3 className="text-lg font-semibold mb-2 text-gray-700">Average Confirmed TPS</h3>
                            <p className="text-4xl font-bold text-purple-600">{tps.average.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">Confirmed TPS vs. Target TPS Over Time</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={tpsData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                    <XAxis
                                        dataKey="time"
                                        label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fill: '#666' }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        label={{ value: 'TPS', angle: -90, position: 'insideLeft', fill: '#666' }}
                                        allowDecimals={false}
                                    />
                                    <Tooltip
                                        formatter={(value: number, name: string) => [`${value.toFixed(2)}`, name]}
                                        labelFormatter={(label: number) => `Time: ${label}s`}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#3B82F6"
                                        strokeWidth={2}
                                        dot={false}
                                        name="Actual Confirmed TPS"
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="currentTarget"
                                        stroke="#FF5733"
                                        strokeWidth={1}
                                        dot={false}
                                        name="Target Sending TPS"
                                        strokeDasharray="5 5"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">Transaction Breakdown (Confirmed)</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={transactionData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                    <XAxis
                                        dataKey="time"
                                        label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fill: '#666' }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#666' }}
                                        allowDecimals={false}
                                    />
                                    <Tooltip
                                        formatter={(value: number, name: string) => [`${value} Confirmed`, name]}
                                        labelFormatter={(label: number) => `Time: ${label}s`}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                    <Line type="monotone" dataKey="requestUserAccess" stroke="#10B981" name="Request User Access" dot={false} />
                                    <Line type="monotone" dataKey="grantAccess" stroke="#F59E0B" name="Grant Access" dot={false} />
                                    <Line type="monotone" dataKey="approveLoan" stroke="#8B5CF6" name="Approve Loan" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold mb-4 text-gray-800">Detailed Test Summary</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
                            <div>
                                <p className="text-sm text-gray-600">Total Transactions Attempted:</p>
                                <p className="text-xl font-bold text-gray-800">{totalTransactionsAttempted}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Total Transactions Confirmed:</p>
                                <p className="text-xl font-bold text-gray-800">{totalTransactionsConfirmed}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Overall Success Rate:</p>
                                <p className="text-xl font-bold text-green-600">{successRate.toFixed(2)}%</p>
                            </div>

                            <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4">
                                <h4 className="text-base font-semibold text-gray-700 flex items-center mb-2"><Clock className="mr-2 w-4 h-4" /> Average Latency (ms):</h4>
                                <ul className="list-disc list-inside text-sm text-gray-700">
                                    {Object.keys(avgLatencyByType).length === 0 ? (
                                        <li>No successful transactions to calculate latency.</li>
                                    ) : (
                                        Object.entries(avgLatencyByType).map(([type, latency]) => (
                                            <li key={type}>{type}: {latency.toFixed(2)} ms</li>
                                        ))
                                    )}
                                </ul>
                            </div>

                            <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4">
                                <h4 className="text-base font-semibold text-gray-700 flex items-center mb-2"><DollarSign className="mr-2 w-4 h-4" /> Total Gas Units Used (by Type):</h4>
                                <ul className="list-disc list-inside text-sm text-gray-700">
                                    {Object.keys(totalGasUnitsUsedByType).length === 0 ? (
                                        <li>No successful transactions to show gas usage.</li>
                                    ) : (
                                        Object.entries(totalGasUnitsUsedByType).map(([type, gas]) => (
                                            <li key={type}>{type}: {gas.toString()}</li>
                                        ))
                                    )}
                                </ul>
                            </div>

                            <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4">
                                <h4 className="text-base font-semibold text-gray-700 flex items-center mb-2"><DollarSign className="mr-2 w-4 h-4" /> Total ETH Cost (by Type):</h4> {/* Added ETH Cost */}
                                <ul className="list-disc list-inside text-sm text-gray-700">
                                    {Object.keys(totalEthCostByType).length === 0 ? (
                                        <li>No successful transactions to show ETH cost.</li>
                                    ) : (
                                        Object.entries(totalEthCostByType).map(([type, ethCost]) => (
                                            <li key={type}>{type}: {ethers.formatEther(ethCost)} ETH</li>
                                        ))
                                    )}
                                </ul>
                            </div>

                            <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4">
                                <h4 className="text-base font-semibold text-gray-700 flex items-center mb-2"><XCircle className="mr-2 w-4 h-4 text-red-500" /> Failed Transactions Breakdown:</h4>
                                <ul className="list-disc list-inside text-sm text-gray-700">
                                    {Object.keys(failedTransactionBreakdown).length === 0 ? (
                                        <li>No failed transactions. Excellent!</li>
                                    ) : (
                                        Object.entries(failedTransactionBreakdown).map(([errorType, count]) => (
                                            <li key={errorType}>{errorType}: {count}</li>
                                        ))
                                    )}
                                </ul>
                            </div>

                        </div>
                        <div className="mt-6 text-center">
                            <button
                                onClick={handleExportData}
                                className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md"
                            >
                                <Download className="inline-block mr-2 w-4 h-4" /> Export All Test Data (.json)
                            </button>
                        </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-semibold text-yellow-800 mb-2">Important Notes for Research:</h4>
                        <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                            <li>Ensure your test accounts corresponding to the provided private keys have **ample ETH** for gas fees.</li>
                            <li>This test connects directly to `http://localhost:8545`. Ensure your local blockchain node (e.g., Hardhat Network, Ganache) is running on this address.</li>
                            <li>The 'grantAccess' function in your smart contracts might require specific **admin privileges**. Ensure the accounts associated with `TEST_PRIVATE_KEYS` have these roles or adjust your contract logic if not.</li>
                            <li>`Total Transactions Attempted` counts each individual transaction that was sent (e.g., one "loan interaction" leads to 3 attempted transactions). `Total Transactions Confirmed` is the actual count of successful contract calls.</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlockchainRealTester;