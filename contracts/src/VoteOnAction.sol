// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title VoteOnAction
/// @notice Records team membership, proposal snapshots, and yes/no votes.
contract VoteOnAction {
    enum ProposalStatus {
        Active,
        Closed
    }

    enum VoteChoice {
        None,
        Yes,
        No
    }

    struct Team {
        uint256 id;
        address owner;
        string name;
        uint256 memberCount;
        uint256 createdAt;
    }

    struct Proposal {
        uint256 id;
        uint256 teamId;
        address proposer;
        string title;
        string description;
        uint256 yesCount;
        uint256 noCount;
        ProposalStatus status;
        uint256 createdAt;
        uint256 closedAt;
    }

    struct VoteRecord {
        VoteChoice choice;
        string suggestion;
        uint256 votedAt;
        bool hasVoted;
    }

    uint256 public teamCount;
    uint256 public proposalCount;

    mapping(uint256 => Team) private teams;
    mapping(uint256 => address[]) private teamMemberList;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => mapping(address => uint256)) private memberIndex;

    mapping(uint256 => Proposal) private proposals;
    mapping(uint256 => address[]) private eligibleVoterList;
    mapping(uint256 => mapping(address => bool)) public isEligible;
    mapping(uint256 => mapping(address => VoteRecord)) private votes;

    event TeamCreated(uint256 indexed teamId, address indexed owner, string name, uint256 createdAt);
    event MemberAdded(uint256 indexed teamId, address indexed member);
    event MemberRemoved(uint256 indexed teamId, address indexed member);
    event ProposalCreated(
        uint256 indexed proposalId,
        uint256 indexed teamId,
        address indexed proposer,
        string title,
        uint256 createdAt
    );
    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        VoteChoice choice,
        string suggestion,
        uint256 votedAt
    );
    event ProposalClosed(uint256 indexed proposalId, address indexed closer, uint256 closedAt);

    error EmptyName();
    error EmptyTitle();
    error TeamNotFound();
    error ProposalNotFound();
    error NotOwner();
    error NotMember();
    error AlreadyMember();
    error NotAMember();
    error CannotRemoveOwner();
    error ZeroAddress();
    error NotEligible();
    error AlreadyVoted();
    error ProposalNotActive();
    error EmptySuggestion();
    error NotCloser();
    error AlreadyClosed();

    function createTeam(string calldata name) external returns (uint256 teamId) {
        if (bytes(name).length == 0) revert EmptyName();

        teamId = ++teamCount;
        teams[teamId] = Team({
            id: teamId,
            owner: msg.sender,
            name: name,
            memberCount: 1,
            createdAt: block.timestamp
        });
        teamMemberList[teamId].push(msg.sender);
        isMember[teamId][msg.sender] = true;
        memberIndex[teamId][msg.sender] = 1;

        emit TeamCreated(teamId, msg.sender, name, block.timestamp);
    }

    function addMember(uint256 teamId, address member) external {
        Team storage team = _requireTeam(teamId);
        if (msg.sender != team.owner) revert NotOwner();
        if (member == address(0)) revert ZeroAddress();
        if (isMember[teamId][member]) revert AlreadyMember();

        teamMemberList[teamId].push(member);
        isMember[teamId][member] = true;
        memberIndex[teamId][member] = teamMemberList[teamId].length;
        team.memberCount += 1;

        emit MemberAdded(teamId, member);
    }

    function removeMember(uint256 teamId, address member) external {
        Team storage team = _requireTeam(teamId);
        if (msg.sender != team.owner) revert NotOwner();
        if (member == team.owner) revert CannotRemoveOwner();
        if (!isMember[teamId][member]) revert NotAMember();

        uint256 index = memberIndex[teamId][member];
        uint256 lastIndex = teamMemberList[teamId].length;
        if (index != lastIndex) {
            address lastMember = teamMemberList[teamId][lastIndex - 1];
            teamMemberList[teamId][index - 1] = lastMember;
            memberIndex[teamId][lastMember] = index;
        }
        teamMemberList[teamId].pop();
        delete memberIndex[teamId][member];
        isMember[teamId][member] = false;
        team.memberCount -= 1;

        emit MemberRemoved(teamId, member);
    }

    function createProposal(uint256 teamId, string calldata title, string calldata description)
        external
        returns (uint256 proposalId)
    {
        _requireTeam(teamId);
        if (!isMember[teamId][msg.sender]) revert NotMember();
        if (bytes(title).length == 0) revert EmptyTitle();

        proposalId = ++proposalCount;
        proposals[proposalId] = Proposal({
            id: proposalId,
            teamId: teamId,
            proposer: msg.sender,
            title: title,
            description: description,
            yesCount: 0,
            noCount: 0,
            status: ProposalStatus.Active,
            createdAt: block.timestamp,
            closedAt: 0
        });

        address[] storage members = teamMemberList[teamId];
        uint256 length = members.length;
        for (uint256 i = 0; i < length; i++) {
            address voter = members[i];
            eligibleVoterList[proposalId].push(voter);
            isEligible[proposalId][voter] = true;
        }

        emit ProposalCreated(proposalId, teamId, msg.sender, title, block.timestamp);
    }

    function voteYes(uint256 proposalId) external {
        _castVote(proposalId, VoteChoice.Yes, "");
    }

    function voteNo(uint256 proposalId, string calldata suggestion) external {
        if (bytes(suggestion).length == 0) revert EmptySuggestion();
        _castVote(proposalId, VoteChoice.No, suggestion);
    }

    function closeProposal(uint256 proposalId) external {
        Proposal storage proposal = _requireProposal(proposalId);
        if (proposal.status == ProposalStatus.Closed) revert AlreadyClosed();

        Team storage team = teams[proposal.teamId];
        if (msg.sender != proposal.proposer && msg.sender != team.owner) revert NotCloser();

        proposal.status = ProposalStatus.Closed;
        proposal.closedAt = block.timestamp;

        emit ProposalClosed(proposalId, msg.sender, block.timestamp);
    }

    function getTeam(uint256 teamId) external view returns (Team memory) {
        return _requireTeam(teamId);
    }

    function getTeams() external view returns (Team[] memory result) {
        result = new Team[](teamCount);
        for (uint256 i = 0; i < teamCount; i++) {
            result[i] = teams[i + 1];
        }
    }

    function getMembers(uint256 teamId) external view returns (address[] memory) {
        _requireTeam(teamId);
        return teamMemberList[teamId];
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return _requireProposal(proposalId);
    }

    function getProposals() external view returns (Proposal[] memory result) {
        result = new Proposal[](proposalCount);
        for (uint256 i = 0; i < proposalCount; i++) {
            result[i] = proposals[i + 1];
        }
    }

    function getEligibleVoters(uint256 proposalId) external view returns (address[] memory) {
        _requireProposal(proposalId);
        return eligibleVoterList[proposalId];
    }

    function getVote(uint256 proposalId, address voter) external view returns (VoteRecord memory) {
        _requireProposal(proposalId);
        return votes[proposalId][voter];
    }

    function _castVote(uint256 proposalId, VoteChoice choice, string memory suggestion) internal {
        Proposal storage proposal = _requireProposal(proposalId);
        if (proposal.status != ProposalStatus.Active) revert ProposalNotActive();
        if (!isEligible[proposalId][msg.sender]) revert NotEligible();
        if (votes[proposalId][msg.sender].hasVoted) revert AlreadyVoted();

        votes[proposalId][msg.sender] = VoteRecord({
            choice: choice,
            suggestion: suggestion,
            votedAt: block.timestamp,
            hasVoted: true
        });

        if (choice == VoteChoice.Yes) {
            proposal.yesCount += 1;
        } else {
            proposal.noCount += 1;
        }

        emit Voted(proposalId, msg.sender, choice, suggestion, block.timestamp);
    }

    function _requireTeam(uint256 teamId) internal view returns (Team storage team) {
        team = teams[teamId];
        if (team.id == 0) revert TeamNotFound();
    }

    function _requireProposal(uint256 proposalId) internal view returns (Proposal storage proposal) {
        proposal = proposals[proposalId];
        if (proposal.id == 0) revert ProposalNotFound();
    }
}
