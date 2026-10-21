// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SplitReceipt} from "../SplitReceipt.sol";

/** Local EVM simulation only. vm.chainId and vm.deal do not connect to or fund a real network. */
contract SplitReceiptMainnetPreparationTest is Test {
    SplitReceipt internal split;
    address internal constant RECIPIENT = address(0xCAFE);
    address internal constant PAYER_ONE = address(0xA11CE);
    address internal constant PAYER_TWO = address(0xB0B);
    // 0.000001 native USDC at 18 decimals; this is the application's minimum input share.
    uint256 internal constant SHARE_ATOMS = 1_000_000_000_000;

    event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount);

    function setUp() public {
        vm.chainId(5042);
        split = new SplitReceipt();
        vm.deal(PAYER_ONE, SHARE_ATOMS * 3);
        vm.deal(PAYER_TWO, SHARE_ATOMS * 3);
        vm.deal(RECIPIENT, 777);
    }

    function createLocalBill() internal returns (uint256) {
        address[] memory payers = new address[](2);
        payers[0] = PAYER_ONE;
        payers[1] = PAYER_TWO;
        return split.createBill("Local EVM only - 5042 simulation", RECIPIENT, payers, SHARE_ATOMS);
    }

    function test_Local5042_TwoMinimumSharesSettleWithEventsAndNoCustody() public {
        assertEq(block.chainid, 5042, "local chain identity");
        uint256 recipientBefore = RECIPIENT.balance;
        uint256 billId = createLocalBill();
        (, address recipient, address[] memory payers, uint256 share, bool[] memory beforePaid) = split.getBill(billId);
        assertEq(recipient, RECIPIENT);
        assertEq(share, SHARE_ATOMS);
        assertEq(payers.length, 2);
        assertEq(payers[0], PAYER_ONE);
        assertEq(payers[1], PAYER_TWO);
        assertFalse(beforePaid[0]);
        assertFalse(beforePaid[1]);

        vm.expectEmit(true, true, false, true, address(split));
        emit SharePaid(billId, PAYER_ONE, SHARE_ATOMS);
        vm.prank(PAYER_ONE);
        split.payShare{value: SHARE_ATOMS}(billId);
        assertEq(RECIPIENT.balance - recipientBefore, SHARE_ATOMS);
        assertEq(address(split).balance, 0);
        (, , , , bool[] memory halfPaid) = split.getBill(billId);
        assertTrue(halfPaid[0]);
        assertFalse(halfPaid[1]);

        vm.expectEmit(true, true, false, true, address(split));
        emit SharePaid(billId, PAYER_TWO, SHARE_ATOMS);
        vm.prank(PAYER_TWO);
        split.payShare{value: SHARE_ATOMS}(billId);
        assertEq(RECIPIENT.balance - recipientBefore, SHARE_ATOMS * 2, "recipient receives the exact principal");
        assertEq(address(split).balance, 0, "contract retains no payment principal");
        (, , , , bool[] memory paid) = split.getBill(billId);
        assertTrue(paid[0]);
        assertTrue(paid[1]);
        assertEq(PAYER_ONE.balance, SHARE_ATOMS * 2);
        assertEq(PAYER_TWO.balance, SHARE_ATOMS * 2);
    }

    function test_Local5042_WrongAmountRevertsWithoutForwardingOrPaidFlag() public {
        uint256 billId = createLocalBill();
        uint256 recipientBefore = RECIPIENT.balance;
        vm.prank(PAYER_ONE);
        vm.expectRevert(SplitReceipt.WrongAmount.selector);
        split.payShare{value: SHARE_ATOMS - 1}(billId);
        vm.prank(PAYER_ONE);
        vm.expectRevert(SplitReceipt.WrongAmount.selector);
        split.payShare{value: SHARE_ATOMS + 1}(billId);
        (, , , , bool[] memory paid) = split.getBill(billId);
        assertFalse(paid[0]);
        assertFalse(paid[1]);
        assertEq(RECIPIENT.balance, recipientBefore);
        assertEq(address(split).balance, 0);
        assertEq(PAYER_ONE.balance, SHARE_ATOMS * 3);
    }

    function test_Local5042_DuplicatePaymentRevertsWithoutExtraTransfer() public {
        uint256 billId = createLocalBill();
        vm.prank(PAYER_ONE);
        split.payShare{value: SHARE_ATOMS}(billId);
        uint256 recipientAfterFirst = RECIPIENT.balance;
        vm.prank(PAYER_ONE);
        vm.expectRevert(SplitReceipt.AlreadyPaid.selector);
        split.payShare{value: SHARE_ATOMS}(billId);
        assertEq(RECIPIENT.balance, recipientAfterFirst);
        assertEq(address(split).balance, 0);
        (, , , , bool[] memory paid) = split.getBill(billId);
        assertTrue(paid[0]);
        assertFalse(paid[1]);
    }
}
