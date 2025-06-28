// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "@openzeppelin/contracts/utils/Strings.sol";
import "hardhat/console.sol";

interface ILoanContract {
    function requestAccessGranted(address requester, string memory cidType, string memory ipfsHash) external;
}

interface IVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[4] memory input
    ) external view returns (bool);
}

contract AccessControl {
    using Strings for *;

    struct ProofData {
        bytes proofBytes; // Serialized ZK proof
        bytes32[] publicSignals; // Public inputs/outputs of the ZK proof
        bool isQualified; // Whether the user qualifies for a loan based on their financial data
        bool isUsed; // Whether this proof has been used in a loan application
        uint256 timestamp; // When the proof was created
    }

    mapping(bytes32 => ProofData) public proofs;
    IVerifier public verifier;
    mapping(address => bool) public approvedBanks;
    event ProofStored(address indexed user, bytes32 indexed proofId, bool isQualified, uint256 timestamp);
    event ProofVerified(address indexed verifier, bytes32 indexed proofId, bool isValid, uint256 timestamp);

    address public loanContractAddress;
    address public verifierAddress;
    mapping(address => mapping(string => bool)) public accessGranted;
    mapping(string => string) private cidStorage;

    event FileSubmitted(string indexed cidType, string indexed ipfsHash, address indexed uploader);
    event AccessRequested(address indexed requester, string cidType, string ipfsHash);
    event AccessGranted(address indexed requester, string cidType, string ipfsHash);
    event AccessDenied(address indexed requester, string cidType, string ipfsHash);

    function setLoanContractAddress(address _loanContractAddress) public {
        loanContractAddress = _loanContractAddress;
    }

    function setVerifierAddress(address _verifierAddress) public {
        verifierAddress = _verifierAddress;
        verifier = IVerifier(_verifierAddress);
    }

    function addApprovedBank(address bankAddress) external {
        approvedBanks[bankAddress] = true;
    }

    function removeApprovedBank(address bankAddress) external {
        approvedBanks[bankAddress] = false;
    }

    function storeProof(
        bytes32 proofId,
        uint256[8] calldata proof,
        bytes32[] calldata publicSignals,
        bool isQualified
    ) external {
        // Check if the proof ID is already used
        require(proofs[proofId].timestamp == 0, "Proof ID already exists");
        
        // Serialize the proof for storage
        bytes memory proofBytes = abi.encode(proof);
        
        // Store the proof data
        proofs[proofId] = ProofData({
            proofBytes: proofBytes,
            publicSignals: publicSignals,
            isQualified: isQualified,
            isUsed: false,
            timestamp: block.timestamp
        });
        
        emit ProofStored(msg.sender, proofId, isQualified, block.timestamp);
    }

    function verifyProof(bytes32 proofId) external returns (bool isValid, bool isQualified) {
        // Check if the proof exists
        console.log("In verification");
        console.log(proofs[proofId].timestamp > 0);
        require(proofs[proofId].timestamp > 0, "Proof does not exist");
        console.log(!proofs[proofId].isUsed);
        // Check if the proof has already been used
        require(!proofs[proofId].isUsed, "Proof has already been used");
        
        // Get proof data
        ProofData storage proofData = proofs[proofId];
        
        // Deserialize the proof
        uint256[8] memory proof = abi.decode(proofData.proofBytes, (uint256[8]));
        console.log("validating proof");
        uint256[4] memory publicSignalsUint;
        for (uint i = 0; i < proofData.publicSignals.length && i < 4; i++) {
            publicSignalsUint[i] = uint256(proofData.publicSignals[i]);
        }
        // Verify the ZK proof using the verifier contract
        bool isValidProof = verifier.verifyProof(
            [proof[0], proof[1]],
            [[proof[2], proof[3]], [proof[4], proof[5]]],
            [proof[6], proof[7]],
            publicSignalsUint
        );
        console.log("proof validated");
        // Mark the proof as used if valid
        if (isValidProof) {
            proofs[proofId].isUsed = true;
        }
        console.log("emitting event and returning");
        emit ProofVerified(msg.sender, proofId, isValidProof, block.timestamp);
        
        return (isValidProof, proofData.isQualified);
    }

    function submitFileHash(string memory _ipfsHash, string memory _cidType) public {
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(bytes(_cidType).length > 0, "CID Type cannot be empty");
        require(bytes(cidStorage[_cidType]).length == 0, "CID Type already submitted");
        cidStorage[_cidType] = _ipfsHash;
        emit FileSubmitted(_cidType, _ipfsHash, msg.sender);
    }

    function requestAccess(address requester, string memory cidType, string memory ipfsHash) external {
        emit AccessRequested(requester, cidType, ipfsHash);
    }

    function grantAccess(address requester, string memory cidType, string memory ipfsHash) public {
        accessGranted[requester][cidType] = true;
        ILoanContract(loanContractAddress).requestAccessGranted(requester, cidType, ipfsHash);
        emit AccessGranted(requester, cidType, ipfsHash);
    }

    function denyAccess(address requester, string memory cidType, string memory ipfsHash) public {
        accessGranted[requester][cidType] = false;
        emit AccessDenied(requester, cidType, ipfsHash);
    }

    function checkAccess(address requester, string memory cidType, string memory ipfsHash) public view returns (bool) {
        return accessGranted[requester][cidType] && keccak256(bytes(cidStorage[cidType])) == keccak256(bytes(ipfsHash));
    }

    function getCID(string memory cidType) public view returns (string memory) {
        return cidStorage[cidType];
    }
}
