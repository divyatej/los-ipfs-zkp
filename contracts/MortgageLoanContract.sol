// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBankContract {
    function requestUserAccess(address userAddress, string memory personalIpfsHash, string memory financialIpfsHash) external;
    function receiveForwardedLoan(address userAddress, uint256 amount, string memory personalIpfsHash, string memory financialIpfsHash) external;
}

contract MortgageLoanContract {
    address public bankContractAddress;
    struct Loan {
        uint256 loanId;
        uint256 amount;
        string personalCID;
        string financialCID;
        bool isApproved;
        bool isDenied;
        address borrower;
    }

    constructor(address _bankContractAddress) {
        bankContractAddress = _bankContractAddress;
    }


    mapping(uint256 => Loan) public loans;

    event LoanApproved(
        uint256 indexed loanId,
        uint256 amount,
        string personalCID,
        string financialCID,
        address borrower
    );

    event ForwardedLoanApprovedEvent(
        uint256 indexed loanId,
        uint256 amount,
        string personalCID,
        string financialCID,
        address borrower
    );

    event LoanForwarded(
        uint256 indexed loanId,
        uint256 amount,
        string personalCID,
        string financialCID,
        address borrower
    );

    event ForwardedLoanDeniedEvent(
        uint256 indexed loanId,
        uint256 amount,
        string personalCID,
        string financialCID,
        address borrower
    );

    event LoanDenied(
        uint256 indexed loanId,
        uint256 amount,
        string personalCID,
        string financialCID,
        address borrower
    );

    event AccessRequestGranted(address indexed requester, string cidType, string ipfsHash);
    event LoanForwarded(address indexed requester,uint256 amount, string cidType, string ipfsHash);

    function requestAccessGranted(address requester, string memory cidType, string memory ipfsHash) external {
        emit AccessRequestGranted(requester, cidType, ipfsHash);
    }

    function forwardLoanApplication(address requester, uint256 amount, string memory personalIpfsHash, string memory financialIpfsHash) public {
        IBankContract(bankContractAddress).receiveForwardedLoan(requester, amount, personalIpfsHash, financialIpfsHash);
        IBankContract(bankContractAddress).requestUserAccess(requester, personalIpfsHash, financialIpfsHash);
        emit LoanForwarded(requester, amount, personalIpfsHash, financialIpfsHash);
    }

    function ForwardedLoanApproved(address _userAddress, uint256 loanId, uint256 amount, string memory personalCID, string memory financialCID, address borrower, string memory loanType) external {
            loans[loanId] = Loan({
            loanId: loanId,
            amount: amount,
            personalCID: personalCID,
            financialCID: financialCID,
            isApproved: true,
            isDenied: false,
            borrower: borrower
        });

        // Emit approval event
        emit ForwardedLoanApprovedEvent(
            loanId,
            amount,
            personalCID,
            financialCID,
            borrower
        );
    }

    function ForwardedLoanDenied(address _userAddress, uint256 _loanId,uint256 _amount,string memory _personalCID, string memory _financialCID, address _borrower) external {
        
        // Store loan details
        loans[_loanId] = Loan({
            loanId: _loanId,
            amount: _amount,
            personalCID: _personalCID,
            financialCID: _financialCID,
            isApproved: false,
            isDenied: true,
            borrower: _borrower
        });

        // Emit denial event
        emit ForwardedLoanDeniedEvent(
            _loanId,
            _amount,
            _personalCID,
            _financialCID,
            _borrower
        );
    }

    function approveLoan(
        uint256 _loanId,
        uint256 _amount,
        string memory _personalCID,
        string memory _financialCID,
        address _borrower
    ) external {
        require(!loans[_loanId].isApproved && !loans[_loanId].isDenied, "Loan already processed");
        
        // Store loan details
        loans[_loanId] = Loan({
            loanId: _loanId,
            amount: _amount,
            personalCID: _personalCID,
            financialCID: _financialCID,
            isApproved: true,
            isDenied: false,
            borrower: _borrower
        });

        // Emit approval event
        emit LoanApproved(
            _loanId,
            _amount,
            _personalCID,
            _financialCID,
            _borrower
        );
    }

    function denyLoan(
        uint256 _loanId,
        uint256 _amount,
        string memory _personalCID,
        string memory _financialCID,
        address _borrower
    ) external {
        require(!loans[_loanId].isApproved && !loans[_loanId].isDenied, "Loan already processed");
        
        // Store loan details
        loans[_loanId] = Loan({
            loanId: _loanId,
            amount: _amount,
            personalCID: _personalCID,
            financialCID: _financialCID,
            isApproved: false,
            isDenied: true,
            borrower: _borrower
        });

        // Emit denial event
        emit LoanDenied(
            _loanId,
            _amount,
            _personalCID,
            _financialCID,
            _borrower
        );
    }

    // Function to get loan details
    function getLoanDetails(uint256 _loanId) external view returns (
        uint256 amount,
        string memory personalCID,
        string memory financialCID,
        bool isApproved,
        bool isDenied,
        address borrower
    ) {
        Loan memory loan = loans[_loanId];
        return (
            loan.amount,
            loan.personalCID,
            loan.financialCID,
            loan.isApproved,
            loan.isDenied,
            loan.borrower
        );
    }
}