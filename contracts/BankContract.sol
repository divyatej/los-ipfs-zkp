// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAccessControl {
    function requestAccess(address requester, string memory cidType, string memory ipfsHash) external;
}

contract BankContract {
    address public accessControlContractAddress;
    address public owner;

    event AccessRequestedByBank(address indexed requester, string personalIpfsHash, string financialIpfsHash);
    event ReceivedForwardedLoan(address indexed requester, uint256 amount, string personalIpfsHash, string financialIpfsHash);

    constructor(address _accessControlAddress) {
        accessControlContractAddress = _accessControlAddress;
        owner = msg.sender;
    }

    function requestUserAccess(address _userAddress, string memory _personalIpfsHash, string memory _financialIpfsHash) public {
        // Interact with the deployed AccessControl contract
        IAccessControl(accessControlContractAddress).requestAccess(_userAddress, "personal", _personalIpfsHash);
        IAccessControl(accessControlContractAddress).requestAccess(_userAddress, "financial", _financialIpfsHash);

        emit AccessRequestedByBank(_userAddress, _personalIpfsHash, _financialIpfsHash);
    }

    function receiveForwardedLoan(address _userAddress, uint256 amount, string memory _personalIpfsHash, string memory _financialIpfsHash) public {
        emit ReceivedForwardedLoan(_userAddress, amount, _personalIpfsHash, _financialIpfsHash);
    }
}