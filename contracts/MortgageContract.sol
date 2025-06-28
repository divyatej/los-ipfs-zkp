// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAccessControl {
    function requestAccess(address requester, string memory cidType, string memory ipfsHash) external;
}

contract MortgageContract {
    address public accessControlContractAddress;
    address public owner;

    event AccessRequestedByMortgage(address indexed requester, string personalIpfsHash, string financialIpfsHash);

    constructor(address _accessControlAddress) {
        accessControlContractAddress = _accessControlAddress;
        owner = msg.sender;
    }

    function requestUserAccess(address _userAddress, string memory _personalIpfsHash, string memory _financialIpfsHash) public {
        // Interact with the deployed AccessControl contract
        IAccessControl(accessControlContractAddress).requestAccess(_userAddress, "personal", _personalIpfsHash);
        IAccessControl(accessControlContractAddress).requestAccess(_userAddress, "financial", _financialIpfsHash);

        emit AccessRequestedByMortgage(_userAddress, _personalIpfsHash, _financialIpfsHash);
    }

}