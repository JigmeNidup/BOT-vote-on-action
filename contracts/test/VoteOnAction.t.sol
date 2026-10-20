// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {VoteOnAction} from "../src/VoteOnAction.sol";

contract VoteOnActionTest is Test {
    VoteOnAction internal vote;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function setUp() public {
        vote = new VoteOnAction();
    }

    function test_createTeamMakesCallerOwnerAndMember() public {
        vm.prank(alice);
        uint256 teamId = vote.createTeam("Core");

        VoteOnAction.Team memory team = vote.getTeam(teamId);
        assertEq(team.owner, alice);
        assertEq(team.name, "Core");
        assertEq(team.memberCount, 1);
        assertTrue(vote.isMember(teamId, alice));
        assertEq(vote.getMembers(teamId)[0], alice);
    }

    function test_createTeamRejectsEmptyName() public {
        vm.prank(alice);
        vm.expectRevert(VoteOnAction.EmptyName.selector);
        vote.createTeam("");
    }

    function test_ownerCannotRemoveSelf() public {
        uint256 teamId = _team();

        vm.prank(alice);
        vm.expectRevert(VoteOnAction.CannotRemoveOwner.selector);
        vote.removeMember(teamId, alice);
    }

    function test_onlyOwnerManagesMembers() public {
        uint256 teamId = _team();

        vm.prank(bob);
        vm.expectRevert(VoteOnAction.NotOwner.selector);
        vote.addMember(teamId, carol);

        vm.prank(alice);
        vote.addMember(teamId, bob);

        vm.prank(bob);
        vm.expectRevert(VoteOnAction.NotOwner.selector);
        vote.removeMember(teamId, bob);
    }

    function test_removeMemberKeepsRemainingMembers() public {
        uint256 teamId = _team();

        vm.startPrank(alice);
        vote.addMember(teamId, bob);
        vote.addMember(teamId, carol);
        vote.removeMember(teamId, bob);
        vm.stopPrank();

        assertFalse(vote.isMember(teamId, bob));
        assertTrue(vote.isMember(teamId, alice));
        assertTrue(vote.isMember(teamId, carol));
        assertEq(vote.getTeam(teamId).memberCount, 2);
        assertEq(vote.getMembers(teamId).length, 2);
    }

    function test_onlyMembersCanCreateProposals() public {
        uint256 teamId = _team();

        vm.prank(bob);
        vm.expectRevert(VoteOnAction.NotMember.selector);
        vote.createProposal(teamId, "Outside", "");

        vm.prank(alice);
        vm.expectRevert(VoteOnAction.EmptyTitle.selector);
        vote.createProposal(teamId, "", "missing title");
    }

    function test_snapshotIgnoresLaterMembershipChanges() public {
        uint256 teamId = _teamWith(bob);
        uint256 proposalId = _proposal(teamId, alice);

        vm.prank(alice);
        vote.addMember(teamId, carol);

        vm.prank(carol);
        vm.expectRevert(VoteOnAction.NotEligible.selector);
        vote.voteYes(proposalId);

        vm.prank(alice);
        vote.removeMember(teamId, bob);

        vm.prank(bob);
        vote.voteYes(proposalId);

        assertTrue(vote.isEligible(proposalId, bob));
        assertEq(vote.getEligibleVoters(proposalId).length, 2);
        assertEq(vote.getProposal(proposalId).yesCount, 1);
    }

    function test_oneVotePerVoter() public {
        uint256 teamId = _team();
        uint256 proposalId = _proposal(teamId, alice);

        vm.prank(alice);
        vote.voteYes(proposalId);

        vm.prank(alice);
        vm.expectRevert(VoteOnAction.AlreadyVoted.selector);
        vote.voteNo(proposalId, "changed my mind");
    }

    function test_voteNoRequiresSuggestionAndStoresIt() public {
        uint256 teamId = _teamWith(bob);
        uint256 proposalId = _proposal(teamId, alice);

        vm.prank(bob);
        vm.expectRevert(VoteOnAction.EmptySuggestion.selector);
        vote.voteNo(proposalId, "");

        vm.prank(bob);
        vote.voteNo(proposalId, "Try the other vendor");

        VoteOnAction.VoteRecord memory record = vote.getVote(proposalId, bob);
        assertEq(uint256(record.choice), uint256(VoteOnAction.VoteChoice.No));
        assertEq(record.suggestion, "Try the other vendor");
        assertTrue(record.hasVoted);
        assertGt(record.votedAt, 0);

        VoteOnAction.Proposal memory proposal = vote.getProposal(proposalId);
        assertEq(proposal.noCount, 1);
        assertEq(proposal.yesCount, 0);
    }

    function test_closePermissionsAndBlocksLaterVotes() public {
        uint256 teamId = _teamWith(bob);
        uint256 proposalId = _proposal(teamId, bob);

        vm.prank(carol);
        vm.expectRevert(VoteOnAction.NotCloser.selector);
        vote.closeProposal(proposalId);

        vm.prank(alice);
        vote.closeProposal(proposalId);

        VoteOnAction.Proposal memory proposal = vote.getProposal(proposalId);
        assertEq(uint256(proposal.status), uint256(VoteOnAction.ProposalStatus.Closed));
        assertGt(proposal.closedAt, 0);

        vm.prank(bob);
        vm.expectRevert(VoteOnAction.ProposalNotActive.selector);
        vote.voteYes(proposalId);

        vm.prank(bob);
        vm.expectRevert(VoteOnAction.AlreadyClosed.selector);
        vote.closeProposal(proposalId);
    }

    function test_proposerCanClose() public {
        uint256 teamId = _teamWith(bob);
        uint256 proposalId = _proposal(teamId, bob);

        vm.prank(bob);
        vote.closeProposal(proposalId);

        assertEq(
            uint256(vote.getProposal(proposalId).status),
            uint256(VoteOnAction.ProposalStatus.Closed)
        );
    }

    function _team() internal returns (uint256 teamId) {
        vm.prank(alice);
        teamId = vote.createTeam("Core");
    }

    function _teamWith(address member) internal returns (uint256 teamId) {
        teamId = _team();
        vm.prank(alice);
        vote.addMember(teamId, member);
    }

    function _proposal(uint256 teamId, address proposer) internal returns (uint256 proposalId) {
        vm.prank(proposer);
        proposalId = vote.createProposal(teamId, "Ship it", "Record the decision");
    }
}
