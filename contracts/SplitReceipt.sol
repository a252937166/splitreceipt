// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SplitReceipt is ReentrancyGuard {
    struct Bill {
        string title;
        address recipient;
        address[] payers;
        uint256 share;
        mapping(address => bool) paid;
    }

    mapping(uint256 => Bill) private _bills;
    uint256 public billCount;

    event BillCreated(uint256 indexed billId, address indexed recipient, uint256 share, address[] payers, string title);
    event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount);

    error TitleTooLong();
    error ZeroRecipient();
    error InvalidPayerCount();
    error ZeroPayer();
    error DuplicatePayer();
    error ZeroShare();
    error InvalidBillId();
    error NotAPayer();
    error AlreadyPaid();
    error WrongAmount();
    error ForwardFailed();

    function createBill(
        string calldata title,
        address recipient,
        address[] calldata payers,
        uint256 share
    ) external returns (uint256 billId) {
        if (bytes(title).length > 80) revert TitleTooLong();
        if (recipient == address(0)) revert ZeroRecipient();

        uint256 payerCount = payers.length;
        if (payerCount < 2 || payerCount > 5) revert InvalidPayerCount();
        if (share == 0) revert ZeroShare();

        for (uint256 i = 0; i < payerCount; i++) {
            address payer = payers[i];
            if (payer == address(0)) revert ZeroPayer();

            for (uint256 j = i + 1; j < payerCount; j++) {
                if (payer == payers[j]) revert DuplicatePayer();
            }
        }

        billCount++;
        billId = billCount;

        Bill storage bill = _bills[billId];
        bill.title = title;
        bill.recipient = recipient;
        bill.share = share;

        for (uint256 i = 0; i < payerCount; i++) {
            bill.payers.push(payers[i]);
        }

        emit BillCreated(billId, recipient, share, payers, title);
    }

    function payShare(uint256 billId) external payable nonReentrant {
        if (billId == 0 || billId > billCount) revert InvalidBillId();

        Bill storage bill = _bills[billId];

        bool isPayer = false;
        uint256 payerCount = bill.payers.length;
        for (uint256 i = 0; i < payerCount; i++) {
            if (bill.payers[i] == msg.sender) {
                isPayer = true;
                break;
            }
        }
        if (!isPayer) revert NotAPayer();

        if (bill.paid[msg.sender]) revert AlreadyPaid();
        if (msg.value != bill.share) revert WrongAmount();

        bill.paid[msg.sender] = true;

        (bool ok,) = bill.recipient.call{value: msg.value}("");
        if (!ok) revert ForwardFailed();

        emit SharePaid(billId, msg.sender, msg.value);
    }

    function getBill(
        uint256 billId
    )
        external
        view
        returns (string memory title, address recipient, address[] memory payers, uint256 share, bool[] memory paidStates)
    {
        if (billId == 0 || billId > billCount) revert InvalidBillId();

        Bill storage bill = _bills[billId];

        title = bill.title;
        recipient = bill.recipient;
        payers = bill.payers;
        share = bill.share;

        uint256 payerCount = payers.length;
        paidStates = new bool[](payerCount);
        for (uint256 i = 0; i < payerCount; i++) {
            paidStates[i] = bill.paid[payers[i]];
        }
    }
}
