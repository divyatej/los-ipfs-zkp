// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

interface IMortgageLoanContract {
    function ForwardedLoanApproved(address _userAddress, uint256 loanId,
        uint256 amount,
        string memory personalCID,
        string memory financialCID,
        address borrower,
        string memory loanType) external;

    function ForwardedLoanDenied(address _userAddress, 
        uint256 _loanId,
        uint256 _amount,
        string memory _personalCID,
        string memory _financialCID,
        address _borrower,
        string memory loanType
    ) external;
}

interface IAccessControl {
    function verifyProof(bytes32 proofId) external returns (bool isValid, bool isQualified);
}

contract LoanContract {

    address public mortgageLoanContractAddress;
    address public userContractAddress;
    struct LoanApplication {
        address applicant;
        uint256 amount;
        bytes32 proofId;
        bool isApproved;
        uint256 timestamp;
    }

    mapping(address => LoanApplication[]) public loanApplications;

    event LoanApplicationSubmitted(
        address indexed applicant,
        bytes32 indexed proofId,
        uint256 amount,
        uint256 timestamp
    );
    
    event LoanApplicationProcessed(
        address indexed applicant,
        bytes32 indexed proofId,
        bool isApproved,
        uint256 timestamp
    );

    constructor(address _mortgageLoanContractAddress, address _userContractAddress) {
        mortgageLoanContractAddress = _mortgageLoanContractAddress;
        userContractAddress = _userContractAddress;
    }

    struct Loan {
        uint256 loanId;
        uint256 amount;
        string personalCID;
        string financialCID;
        bool isApproved;
        bool isDenied;
        address borrower;
        string loanType;
    }

    mapping(uint256 => Loan) public loans;

    event LoanApproved(
        uint256 indexed loanId,
        uint256 amount,
        string personalCID,
        string financialCID,
        address borrower,
        string loanType
    );

    event LoanDenied(
        uint256 indexed loanId,
        uint256 amount,
        string personalCID,
        string financialCID,
        address borrower,
        string loanType
    );

    event AccessRequestGranted(address indexed requester, string cidType, string ipfsHash);

    function requestAccessGranted(address requester, string memory cidType, string memory ipfsHash) external {
        emit AccessRequestGranted(requester, cidType, ipfsHash);
    }

    function approveLoan(
        uint256 _loanId,
        uint256 _amount,
        string memory _personalCID,
        string memory _financialCID,
        address _borrower,
        string memory loanType
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
            borrower: _borrower,
            loanType: loanType
        });

        if(keccak256(abi.encodePacked(loanType)) == keccak256(abi.encodePacked("forwarded"))) {
            IMortgageLoanContract(mortgageLoanContractAddress).ForwardedLoanApproved(mortgageLoanContractAddress, _loanId,_amount, _personalCID, _financialCID, _borrower, loanType);
        }
        else{
            // Emit approval event
            emit LoanApproved(
                _loanId,
                _amount,
                _personalCID,
                _financialCID,
                _borrower,
                loanType
            );
        }
        
    }

    function denyLoan(
        uint256 _loanId,
        uint256 _amount,
        string memory _personalCID,
        string memory _financialCID,
        address _borrower,
        string memory loanType
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
            borrower: _borrower,
            loanType: loanType
        });

        if(keccak256(abi.encodePacked(loanType)) == keccak256(abi.encodePacked("forwarded"))) {
            IMortgageLoanContract(mortgageLoanContractAddress).ForwardedLoanDenied(mortgageLoanContractAddress, _loanId,_amount, _personalCID, _financialCID, _borrower, loanType);
        }
        else{

            // Emit denial event
            emit LoanDenied(
                _loanId,
                _amount,
                _personalCID,
                _financialCID,
                _borrower,
                loanType
            );
        }
    }

    function applyForLoan(
        address sender,
        uint256 amount,
        bytes32 proofId
    ) external {
        // Basic validation
        console.log("In solidity:");
        require(amount > 0, "Loan amount must be greater than 0");
        
        // Submit loan application
        LoanApplication memory application = LoanApplication({
            applicant: sender,
            amount: amount,
            proofId: proofId,
            isApproved: false,
            timestamp: block.timestamp
        });
        console.log("Loan submitted");
        // Store the application
        loanApplications[sender].push(application);
        console.log("Loan pushed");
        emit LoanApplicationSubmitted(
            sender,
            proofId,
            amount,
            block.timestamp
        );
        console.log("Loan submitted and emitted");
        // Verify the proof with the user contract
        (bool isValid, bool isQualified) = IAccessControl(userContractAddress).verifyProof(proofId);
        console.log("proof validated");
        // Approve the loan if the proof is valid and user is qualified
        bool isApproved = isValid && isQualified;
        // Update the application status
        uint256 applicationIndex = loanApplications[sender].length - 1;
        loanApplications[sender][applicationIndex].isApproved = isApproved;
        console.log("Loan updated and about to send event");
        emit LoanApplicationProcessed(
            sender,
            proofId,
            isApproved,
            block.timestamp
        );
    }

    // Function to get loan details
    function getLoanDetails(uint256 _loanId) external view returns (
        uint256 amount,
        string memory personalCID,
        string memory financialCID,
        bool isApproved,
        bool isDenied,
        address borrower,
        string memory loanType
    ) {
        Loan memory loan = loans[_loanId];
        return (
            loan.amount,
            loan.personalCID,
            loan.financialCID,
            loan.isApproved,
            loan.isDenied,
            loan.borrower,
            loan.loanType
        );
    }
}