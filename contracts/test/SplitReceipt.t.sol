// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, Vm} from "forge-std/Test.sol";
import {SplitReceipt} from "../SplitReceipt.sol";

// ─────────────────────────────────────────────────────────────────
// Helper: a contract that rejects all ETH — used to trigger
// ForwardFailed so we can verify the paid flag is NOT set.
// ─────────────────────────────────────────────────────────────────
contract RejectETH {
    receive() external payable {
        revert("no ETH");
    }
}

// ─────────────────────────────────────────────────────────────────
// Helper: a malicious contract that is BOTH a listed payer AND the
// recipient on the same bill.  When it receives ETH forwarded by
// payShare it immediately tries to call payShare again for itself.
//
// NOTE on what this test actually isolates:
//   The re-entry sender (this contract) is an eligible payer whose
//   paid flag was set to true BEFORE the .call{value:} forward fired
//   (checks-effects-interactions).  So on re-entry the contract would
//   hit the nonReentrant lock FIRST (set at function entry by OZ v5),
//   before reaching the AlreadyPaid check.  We assert the inner revert
//   carries the ReentrancyGuardReentrantCall selector to prove the guard
//   is the active barrier, not the AlreadyPaid check.
// ─────────────────────────────────────────────────────────────────
contract ReentrantAttacker {
    SplitReceipt public target;
    uint256 public billId;
    uint256 public share;
    bool public reentryAttempted;
    bytes public innerRevertData; // captured from the re-entry attempt

    constructor(SplitReceipt _target) {
        target = _target;
    }

    function setParams(uint256 _billId, uint256 _share) external {
        billId  = _billId;
        share   = _share;
    }

    // Called by the test to trigger the outer payShare as this contract.
    function attack() external {
        target.payShare{value: share}(billId);
    }

    // The forward from SplitReceipt lands here; try to re-enter.
    receive() external payable {
        if (!reentryAttempted) {
            reentryAttempted = true;
            // Attempt a second payShare for the same billId.
            // Capture the revert data so the test can assert the selector.
            // Swallow the revert so the outer call can complete normally.
            (bool ok, bytes memory data) = address(target).call{value: share}(
                abi.encodeWithSelector(SplitReceipt.payShare.selector, billId)
            );
            if (!ok) innerRevertData = data;
        }
    }

    // Accept ETH for test funding
    fallback() external payable {}
}

// ─────────────────────────────────────────────────────────────────
// Main test contract
// ─────────────────────────────────────────────────────────────────
contract SplitReceiptTest is Test {

    SplitReceipt internal split;

    // Deterministic labelled addresses
    address internal recipient  = vm.addr(1);
    address internal payer1     = vm.addr(2);
    address internal payer2     = vm.addr(3);
    address internal payer3     = vm.addr(4);
    address internal payer4     = vm.addr(5);
    address internal payer5     = vm.addr(6);
    address internal stranger   = vm.addr(7);

    uint256 internal constant SHARE  = 1 ether;
    uint256 internal constant BUDGET = 100 ether;

    // ── setUp ──────────────────────────────────────────────────
    function setUp() public {
        split = new SplitReceipt();

        // Fund every payer with native ETH
        deal(payer1, BUDGET);
        deal(payer2, BUDGET);
        deal(payer3, BUDGET);
        deal(payer4, BUDGET);
        deal(payer5, BUDGET);
        deal(stranger, BUDGET);
    }

    // ══════════════════════════════════════════════════════════════
    // 1. createBill — happy paths
    // ══════════════════════════════════════════════════════════════

    function test_CreateBill_TwoPayers_StorageAndEvent() public {
        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;

        // Expect the BillCreated event
        vm.expectEmit(true, true, false, true, address(split));
        emit SplitReceipt.BillCreated(1, recipient, SHARE, payers, "Lunch");

        uint256 id = split.createBill("Lunch", recipient, payers, SHARE);

        // billId should be 1
        assertEq(id, 1);
        assertEq(split.billCount(), 1);

        // Read back via getBill
        (
            string memory title,
            address recip,
            address[] memory storedPayers,
            uint256 share,
            bool[] memory paidStates
        ) = split.getBill(1);

        assertEq(title,            "Lunch");
        assertEq(recip,            recipient);
        assertEq(share,            SHARE);
        assertEq(storedPayers.length, 2);
        assertEq(storedPayers[0],  payer1);
        assertEq(storedPayers[1],  payer2);
        assertEq(paidStates.length, 2);
        assertFalse(paidStates[0]);
        assertFalse(paidStates[1]);
    }

    function test_CreateBill_FivePayers_StorageAndEvent() public {
        address[] memory payers = new address[](5);
        payers[0] = payer1;
        payers[1] = payer2;
        payers[2] = payer3;
        payers[3] = payer4;
        payers[4] = payer5;

        vm.expectEmit(true, true, false, true, address(split));
        emit SplitReceipt.BillCreated(1, recipient, SHARE, payers, "Dinner");

        uint256 id = split.createBill("Dinner", recipient, payers, SHARE);

        assertEq(id, 1);
        assertEq(split.billCount(), 1);

        (
            string memory title,
            address recip,
            address[] memory storedPayers,
            uint256 share,
            bool[] memory paidStates
        ) = split.getBill(1);

        assertEq(title,  "Dinner");
        assertEq(recip,  recipient);
        assertEq(share,  SHARE);
        assertEq(storedPayers.length, 5);
        for (uint256 i = 0; i < 5; i++) {
            assertEq(storedPayers[i], payers[i]);
            assertFalse(paidStates[i]);
        }
    }

    function test_CreateBill_IncrementsBillCount() public {
        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;

        split.createBill("A", recipient, payers, SHARE);
        split.createBill("B", recipient, payers, SHARE);

        assertEq(split.billCount(), 2);
    }

    // ══════════════════════════════════════════════════════════════
    // 2. payShare — happy path
    // ══════════════════════════════════════════════════════════════

    function _createTwoPayer() internal returns (uint256 billId) {
        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;
        billId = split.createBill("Tab", recipient, payers, SHARE);
    }

    function test_PayShare_EmitsSharePaid() public {
        uint256 id = _createTwoPayer();

        vm.expectEmit(true, true, false, true, address(split));
        emit SplitReceipt.SharePaid(id, payer1, SHARE);

        vm.prank(payer1);
        split.payShare{value: SHARE}(id);
    }

    function test_PayShare_PaidFlagFlipsToTrue() public {
        uint256 id = _createTwoPayer();

        vm.prank(payer1);
        split.payShare{value: SHARE}(id);

        (, , , , bool[] memory paidStates) = split.getBill(id);
        assertTrue(paidStates[0]);   // payer1 (index 0)
        assertFalse(paidStates[1]);  // payer2 still unpaid
    }

    function test_PayShare_RecipientReceivesCorrectValue() public {
        uint256 id = _createTwoPayer();

        uint256 balBefore = recipient.balance;

        vm.prank(payer1);
        split.payShare{value: SHARE}(id);

        assertEq(recipient.balance - balBefore, SHARE);
    }

    function test_PayShare_BothPayersCanPay() public {
        uint256 id = _createTwoPayer();

        uint256 balBefore = recipient.balance;

        vm.prank(payer1);
        split.payShare{value: SHARE}(id);

        vm.prank(payer2);
        split.payShare{value: SHARE}(id);

        assertEq(recipient.balance - balBefore, SHARE * 2);

        (, , , , bool[] memory paidStates) = split.getBill(id);
        assertTrue(paidStates[0]);
        assertTrue(paidStates[1]);
    }

    // ══════════════════════════════════════════════════════════════
    // 3. payShare — NotAPayer revert
    // ══════════════════════════════════════════════════════════════

    function test_PayShare_RevertsNotAPayer_Stranger() public {
        uint256 id = _createTwoPayer();

        vm.prank(stranger);
        vm.expectRevert(SplitReceipt.NotAPayer.selector);
        split.payShare{value: SHARE}(id);
    }

    function test_PayShare_RevertsNotAPayer_Recipient() public {
        uint256 id = _createTwoPayer();

        deal(recipient, BUDGET);
        vm.prank(recipient);
        vm.expectRevert(SplitReceipt.NotAPayer.selector);
        split.payShare{value: SHARE}(id);
    }

    // ══════════════════════════════════════════════════════════════
    // 4. payShare — WrongAmount revert (too low + too high)
    // ══════════════════════════════════════════════════════════════

    function test_PayShare_RevertsWrongAmount_TooLow() public {
        uint256 id = _createTwoPayer();

        vm.prank(payer1);
        vm.expectRevert(SplitReceipt.WrongAmount.selector);
        split.payShare{value: SHARE - 1}(id);
    }

    function test_PayShare_RevertsWrongAmount_TooHigh() public {
        uint256 id = _createTwoPayer();

        vm.prank(payer1);
        vm.expectRevert(SplitReceipt.WrongAmount.selector);
        split.payShare{value: SHARE + 1}(id);
    }

    function test_PayShare_RevertsWrongAmount_Zero() public {
        uint256 id = _createTwoPayer();

        vm.prank(payer1);
        vm.expectRevert(SplitReceipt.WrongAmount.selector);
        split.payShare{value: 0}(id);
    }

    // ══════════════════════════════════════════════════════════════
    // 5. payShare — AlreadyPaid revert (duplicate payment)
    // ══════════════════════════════════════════════════════════════

    function test_PayShare_RevertsAlreadyPaid() public {
        uint256 id = _createTwoPayer();

        vm.prank(payer1);
        split.payShare{value: SHARE}(id);

        vm.prank(payer1);
        vm.expectRevert(SplitReceipt.AlreadyPaid.selector);
        split.payShare{value: SHARE}(id);
    }

    // ══════════════════════════════════════════════════════════════
    // 6. payShare — InvalidBillId revert (0 and count+1)
    // ══════════════════════════════════════════════════════════════

    function test_PayShare_RevertsInvalidBillId_Zero() public {
        vm.prank(payer1);
        vm.expectRevert(SplitReceipt.InvalidBillId.selector);
        split.payShare{value: SHARE}(0);
    }

    function test_PayShare_RevertsInvalidBillId_BeyondCount() public {
        _createTwoPayer(); // billCount becomes 1

        vm.prank(payer1);
        vm.expectRevert(SplitReceipt.InvalidBillId.selector);
        split.payShare{value: SHARE}(2); // 2 > billCount(1)
    }

    function test_GetBill_RevertsInvalidBillId_Zero() public {
        vm.expectRevert(SplitReceipt.InvalidBillId.selector);
        split.getBill(0);
    }

    function test_GetBill_RevertsInvalidBillId_BeyondCount() public {
        _createTwoPayer();
        vm.expectRevert(SplitReceipt.InvalidBillId.selector);
        split.getBill(2);
    }

    // ══════════════════════════════════════════════════════════════
    // 7. createBill — ZeroRecipient revert
    // ══════════════════════════════════════════════════════════════

    function test_CreateBill_RevertsZeroRecipient() public {
        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;

        vm.expectRevert(SplitReceipt.ZeroRecipient.selector);
        split.createBill("Tab", address(0), payers, SHARE);
    }

    // ══════════════════════════════════════════════════════════════
    // 8. createBill — InvalidPayerCount revert (1 payer, 6 payers)
    // ══════════════════════════════════════════════════════════════

    function test_CreateBill_RevertsInvalidPayerCount_OnePayer() public {
        address[] memory payers = new address[](1);
        payers[0] = payer1;

        vm.expectRevert(SplitReceipt.InvalidPayerCount.selector);
        split.createBill("Tab", recipient, payers, SHARE);
    }

    function test_CreateBill_RevertsInvalidPayerCount_ZeroPayers() public {
        address[] memory payers = new address[](0);

        vm.expectRevert(SplitReceipt.InvalidPayerCount.selector);
        split.createBill("Tab", recipient, payers, SHARE);
    }

    function test_CreateBill_RevertsInvalidPayerCount_SixPayers() public {
        address[] memory payers = new address[](6);
        payers[0] = payer1;
        payers[1] = payer2;
        payers[2] = payer3;
        payers[3] = payer4;
        payers[4] = payer5;
        payers[5] = vm.addr(8); // 6th payer

        vm.expectRevert(SplitReceipt.InvalidPayerCount.selector);
        split.createBill("Tab", recipient, payers, SHARE);
    }

    // ══════════════════════════════════════════════════════════════
    // 9. createBill — ZeroPayer revert
    // ══════════════════════════════════════════════════════════════

    function test_CreateBill_RevertsZeroPayer_FirstSlot() public {
        address[] memory payers = new address[](2);
        payers[0] = address(0);
        payers[1] = payer2;

        vm.expectRevert(SplitReceipt.ZeroPayer.selector);
        split.createBill("Tab", recipient, payers, SHARE);
    }

    function test_CreateBill_RevertsZeroPayer_SecondSlot() public {
        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = address(0);

        vm.expectRevert(SplitReceipt.ZeroPayer.selector);
        split.createBill("Tab", recipient, payers, SHARE);
    }

    // ══════════════════════════════════════════════════════════════
    // 10. createBill — DuplicatePayer revert
    // ══════════════════════════════════════════════════════════════

    function test_CreateBill_RevertsDuplicatePayer_TwoSlots() public {
        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer1; // duplicate

        vm.expectRevert(SplitReceipt.DuplicatePayer.selector);
        split.createBill("Tab", recipient, payers, SHARE);
    }

    function test_CreateBill_RevertsDuplicatePayer_ThreeSlots() public {
        address[] memory payers = new address[](3);
        payers[0] = payer1;
        payers[1] = payer2;
        payers[2] = payer1; // duplicate of slot 0

        vm.expectRevert(SplitReceipt.DuplicatePayer.selector);
        split.createBill("Tab", recipient, payers, SHARE);
    }

    // ══════════════════════════════════════════════════════════════
    // 11. createBill — ZeroShare revert
    // ══════════════════════════════════════════════════════════════

    function test_CreateBill_RevertsZeroShare() public {
        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;

        vm.expectRevert(SplitReceipt.ZeroShare.selector);
        split.createBill("Tab", recipient, payers, 0);
    }

    // ══════════════════════════════════════════════════════════════
    // 12. createBill — TitleTooLong revert (>80 bytes)
    // ══════════════════════════════════════════════════════════════

    function test_CreateBill_RevertsTitleTooLong_81Bytes() public {
        // 81 ASCII characters = 81 bytes
        string memory longTitle =
            "AAAAAAAAAABBBBBBBBBBCCCCCCCCCCDDDDDDDDDDEEEEEEEEEEFFFFFFFFFF"
            "GGGGGGGGGGHHHHHHHHHHX"; // 81 chars total

        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;

        vm.expectRevert(SplitReceipt.TitleTooLong.selector);
        split.createBill(longTitle, recipient, payers, SHARE);
    }

    function test_CreateBill_AcceptsTitle_ExactlyEightyBytes() public {
        // Exactly 80 ASCII characters = 80 UTF-8 bytes — must NOT revert.
        // 10×A + 10×B + 10×C + 10×D + 10×E + 10×F + 10×G + 10×H = 80.
        string memory maxTitle =
            "AAAAAAAAAABBBBBBBBBBCCCCCCCCCCDDDDDDDDDDEEEEEEEEEEFFFFFFFFFF"
            "GGGGGGGGGGHHHHHHHHHH"; // 60 + 20 = 80 bytes

        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;

        uint256 id = split.createBill(maxTitle, recipient, payers, SHARE);
        assertEq(id, 1);
        // Verify stored title is exactly 80 bytes
        (string memory stored, , , ,) = split.getBill(id);
        assertEq(bytes(stored).length, 80, "title must be exactly 80 bytes");
    }

    // ══════════════════════════════════════════════════════════════
    // 13. Recipient transfer failure → ForwardFailed + no paid flag
    // ══════════════════════════════════════════════════════════════

    function test_PayShare_RevertsForwardFailed_PaidNotSet() public {
        // Deploy a recipient that rejects ETH
        RejectETH rejecter = new RejectETH();

        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;

        uint256 id = split.createBill("Reject", address(rejecter), payers, SHARE);

        // payShare should revert with ForwardFailed
        vm.prank(payer1);
        vm.expectRevert(SplitReceipt.ForwardFailed.selector);
        split.payShare{value: SHARE}(id);

        // Verify: payer1's paid flag must remain false (state was rolled back)
        (, , , , bool[] memory paidStates) = split.getBill(id);
        assertFalse(paidStates[0], "paid flag must not be set after ForwardFailed");
    }

    // ══════════════════════════════════════════════════════════════
    // 14. Reentrancy guard
    // ══════════════════════════════════════════════════════════════

    function test_PayShare_ReentrancyGuardPreventsDoubleEntry() public {
        // Deploy an attacker that is BOTH payer[0] AND recipient on the same bill,
        // funded with 2×SHARE so it could theoretically make two payments.
        ReentrantAttacker attacker = new ReentrantAttacker(split);
        deal(address(attacker), SHARE * 2);

        address[] memory payers = new address[](2);
        payers[0] = address(attacker);
        payers[1] = payer1;

        uint256 id = split.createBill(
            "Reentrant",
            address(attacker), // recipient == attacker
            payers,
            SHARE
        );
        attacker.setParams(id, SHARE);

        // ── Why this correctly isolates the reentrancy guard ─────────────
        // SplitReceipt uses checks-effects-interactions: paid[msg.sender] is
        // set to true BEFORE the .call{value:} forward that triggers receive().
        // In the re-entry attempt msg.sender (attacker) is eligible and
        // paid==true at that point.
        // The nonReentrant modifier (OZ v5) acquires the lock at function ENTRY,
        // before any body code runs — so the lock check fires first, producing
        // ReentrancyGuardReentrantCall, not AlreadyPaid.
        // We capture and assert the selector to prove the guard is the active
        // barrier, not the CEI paid-flag check.
        // ────────────────────────────────────────────────────────────────

        vm.recordLogs();
        attacker.attack(); // outer call succeeds; inner re-entry is swallowed

        // 1. The outer call fired exactly one SharePaid event.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 sharePaidTopic = keccak256("SharePaid(uint256,address,uint256)");
        uint256 sharePaidCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == sharePaidTopic) {
                sharePaidCount++;
            }
        }
        assertEq(sharePaidCount, 1, "reentrancy: SharePaid must fire exactly once");

        // 2. attacker's paid slot is true (the outer payment succeeded).
        (, , , , bool[] memory paidStates) = split.getBill(id);
        assertTrue(paidStates[0], "attacker payer slot must be marked paid");

        // 3. The inner re-entry was attempted and captured a revert.
        assertTrue(attacker.reentryAttempted(), "re-entry must have been attempted");

        // 4. Assert the captured revert data starts with ReentrancyGuardReentrantCall
        //    selector — proving the guard (not AlreadyPaid) rejected the re-entry.
        bytes memory revData = attacker.innerRevertData();
        assertTrue(revData.length >= 4, "inner revert must carry selector data");
        bytes4 gotSelector;
        assembly { gotSelector := mload(add(revData, 32)) }
        bytes4 expectedSelector = bytes4(keccak256("ReentrancyGuardReentrantCall()"));
        assertEq(gotSelector, expectedSelector, "inner revert must be ReentrancyGuardReentrantCall");

        // 5. Balance is net-unchanged: attacker paid SHARE out and received SHARE back.
        //    This is an inherent property of the payer==recipient setup and does not
        //    indicate a double-payment.  The event count (assertion 1) is definitive.
        assertEq(address(attacker).balance, SHARE * 2, "balance is net-unchanged (payer==recipient)");
    }

    // ══════════════════════════════════════════════════════════════
    // 15. Amount precision: small and exact shares (6-dp USDC)
    // These use the same scaling the frontend uses:
    //   1 USDC (6dp)   = 1_000_000 six-dp units
    //   1 native unit  = 10^18
    //   scale factor   = 10^12  (native = sixDp × 10^12)
    // ══════════════════════════════════════════════════════════════

    // Helper: convert a human USDC amount expressed as (whole, fractional 6dp)
    // into the 18-decimal native value stored in the contract.
    function _nativeShare(uint256 whole, uint256 fracSixDp) internal pure returns (uint256) {
        // fracSixDp is the fractional part already expressed in 6-dp units
        // e.g. 0.001 USDC → whole=0, fracSixDp=1000
        return (whole * 1_000_000 + fracSixDp) * 1e12;
    }

    function test_Amount_OneMicroUsdc() public {
        // 0.000001 USDC = 1 six-dp unit = 1e12 native units
        uint256 share = _nativeShare(0, 1); // 1 × 10^12
        assertEq(share, 1e12, "0.000001 USDC native value must be 1e12");

        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;
        uint256 id = split.createBill("Micro", recipient, payers, share);

        // payer1 pays the exact 1e12 native units
        uint256 balBefore = recipient.balance;
        vm.prank(payer1);
        split.payShare{value: share}(id);
        assertEq(recipient.balance - balBefore, share, "recipient must receive exactly 1e12");

        // Paid flag flips
        (, , , , bool[] memory paid) = split.getBill(id);
        assertTrue(paid[0], "payer1 must be marked paid");
    }

    function test_Amount_OneMilliUsdc() public {
        // 0.001 USDC = 1000 six-dp units = 1000 × 10^12 native units
        uint256 share = _nativeShare(0, 1_000);
        assertEq(share, 1_000 * 1e12, "0.001 USDC native value must be 1000x1e12");

        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;
        uint256 id = split.createBill("Milli", recipient, payers, share);

        uint256 balBefore = recipient.balance;
        vm.prank(payer1);
        split.payShare{value: share}(id);
        assertEq(recipient.balance - balBefore, share, "recipient must receive exact milli share");
    }

    function test_Amount_OnePointTwoThreeFourFiveSixSeven_Truncates() public {
        // 1.234567 USDC = 1_234_567 six-dp units
        // The frontend enforces max 6dp, so this is the boundary case.
        uint256 share = _nativeShare(1, 234_567);
        assertEq(share, 1_234_567 * 1e12, "1.234567 USDC native value");

        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;
        uint256 id = split.createBill("Exact6dp", recipient, payers, share);

        uint256 balBefore = recipient.balance;
        vm.prank(payer1);
        split.payShare{value: share}(id);
        assertEq(recipient.balance - balBefore, share, "recipient must receive 1.234567 USDC exactly");
    }

    function test_Amount_WrongAmountBy1Wei() public {
        // Even 1 native-unit off must revert — confirms no rounding in payShare.
        uint256 share = _nativeShare(0, 1); // 0.000001 USDC

        address[] memory payers = new address[](2);
        payers[0] = payer1;
        payers[1] = payer2;
        uint256 id = split.createBill("Wei", recipient, payers, share);

        vm.prank(payer1);
        vm.expectRevert(SplitReceipt.WrongAmount.selector);
        split.payShare{value: share - 1}(id);
    }

    // ══════════════════════════════════════════════════════════════
    // Fuzz: payShare accepts exactly the right amount, rejects all others
    // ══════════════════════════════════════════════════════════════

    function testFuzz_PayShare_WrongAmount(uint256 wrongValue) public {
        // exclude the exact share so the fuzz always hits the revert
        vm.assume(wrongValue != SHARE);
        vm.assume(wrongValue <= 10_000 ether); // keep gas sane

        uint256 id = _createTwoPayer();
        deal(payer1, wrongValue + 1 ether); // ensure payer1 can fund it

        vm.prank(payer1);
        vm.expectRevert(SplitReceipt.WrongAmount.selector);
        split.payShare{value: wrongValue}(id);
    }
}
