// extract_keys.js
const Web3 = require('web3');
const fs = require('fs');
const path = require('path');

const web3 = new Web3();

const KEYSTORE_BASE_DIR = '/mnt/ethereum_data/node1/keystore';
const PASSWORD = 'test123';

async function getPrivateKey(keystorePath) {
    try {
        const keystoreJson = fs.readFileSync(keystorePath, 'utf8');
        const wallet = await web3.eth.accounts.decrypt(keystoreJson, PASSWORD);
        return { privateKey: wallet.privateKey, address: wallet.address };
    } catch (error) {
        // Log errors to stderr so they don't interfere with stdout JSON output
        console.error(`Error decrypting ${keystorePath}:`, error.message);
        return null;
    }
}

async function main() {
    const accountsArray = [];
    const privateKeysObject = {};

    try {
        const files = fs.readdirSync(KEYSTORE_BASE_DIR);
        const keystoreFiles = files.filter(file => file.startsWith('UTC--'));

        if (keystoreFiles.length === 0) {
            console.error(`No keystore files found in ${KEYSTORE_BASE_DIR}. Please ensure accounts are created and files exist.`);
            return;
        }

        const minerAddress = process.env.MINER_ADDRESS;
        const user1Address = process.env.USER1_ADDRESS;
        const user2Address = process.env.USER2_ADDRESS;

        const addressesToProcess = [
            { type: 'Miner/Owner', address: minerAddress },
            { type: 'User 1', address: user1Address },
            { type: 'User 2', address: user2Address }
        ].filter(item => item.address); // Filter out any undefined addresses

        for (const { type, address } of addressesToProcess) {
            const matchingFile = keystoreFiles.find(file => file.toLowerCase().includes(address.toLowerCase().substring(2)));
            if (matchingFile) {
                const walletInfo = await getPrivateKey(path.join(KEYSTORE_BASE_DIR, matchingFile));
                if (walletInfo) {
                    accountsArray.push(walletInfo.address);
                    privateKeysObject[walletInfo.address] = walletInfo.privateKey;
                }
            } else {
                console.error(`Keystore file not found for address: ${address} (${type})`);
            }
        }

    } catch (error) {
        console.error("Error reading keystore directory:", error.message);
    }

    // Output the JavaScript code directly to stdout
    console.log(`const accounts = [`);
    accountsArray.forEach((addr, index) => {
        let comment = '';
        if (index === 0) comment = ' // Account 0: Miner/Owner, also acts as the "Bank"';
        else if (index === 1) comment = ' // Account 1: User 1';
        else if (index === 2) comment = ' // Account 2: User 2';
        console.log(`    '${addr}',${comment}`);
    });
    console.log(`];\n`);

    console.log(`const privateKeys = { // Use an object for easier lookup by address`);
    for (const address in privateKeysObject) {
        console.log(`    '${address}': '${privateKeysObject[address]}',`);
    }
    console.log(`};`);
}

main();