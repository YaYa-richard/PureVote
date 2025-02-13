// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VotingPlatform {
    // 定义投票结构体，包含标题、详情、选项、票数、截止时间及防止重复投票的映射
    struct Poll {
        string title;                   // 投票标题
        string details;                 // 投票详情
        string[] options;               // 投票选项文本
        uint256[] votes;                // 各选项票数
        mapping(address => bool) hasVoted; // 限制同一地址只能投一次
        bool exists;                    // 标记投票是否存在
        uint256 deadline;               // 投票截止时间（block.timestamp + duration）
    }
    
    uint256 public pollCount;           // 投票总数（投票 ID 从 1 开始）
    mapping(uint256 => Poll) private polls;

    // 新增：每个投票对应一个 mapping，存储已使用过的 fingerprint 哈希
    mapping(uint256 => mapping(bytes32 => bool)) private pollFingerprints;

    // 事件：创建投票时触发（返回截止时间）
    event PollCreated(uint256 indexed pollId, string title, uint256 deadline);
    // 事件：用户投票时触发（不暴露投票者信息）
    event Voted(uint256 indexed pollId, uint256 optionIndex);

    /**
     * @notice 创建投票
     * @param _title 投票标题
     * @param _details 投票详情
     * @param _options 投票选项数组（前端传入时建议仅传选项文本）
     * @param _duration 投票持续时长（秒）
     * @return 返回新投票的 ID
     */
    function createPoll(
        string memory _title, 
        string memory _details, 
        string[] memory _options,
        uint256 _duration
    ) public returns (uint256) {
        require(_options.length > 0, "at least one vote");
        pollCount++; // 投票 ID 自增

        Poll storage newPoll = polls[pollCount];
        newPoll.title = _title;
        newPoll.details = _details;
        newPoll.exists = true;
        newPoll.deadline = block.timestamp + _duration; // 设定截止时间

        for (uint256 i = 0; i < _options.length; i++) {
            newPoll.options.push(_options[i]);
            newPoll.votes.push(0);
        }
        emit PollCreated(pollCount, _title, newPoll.deadline);
        return pollCount;
    }

    /**
     * @notice 对指定投票进行投票（单选）
     * @param _pollId 投票的 ID
     * @param _optionIndex 选择的选项下标（从 0 开始）
     * @param _fingerprint 用户 fingerprint 的哈希（例如 keccak256 后的值）
     */
    function vote(uint256 _pollId, uint256 _optionIndex, bytes32 _fingerprint) public {
        require(_pollId > 0 && _pollId <= pollCount, "vote does not exist");
        Poll storage poll = polls[_pollId];
        require(poll.exists, "vote does not exist");
        require(block.timestamp <= poll.deadline, "voting period ended");
        require(_optionIndex < poll.options.length, "choice does not exist");
        require(!poll.hasVoted[msg.sender], "already voted by address");
        require(!pollFingerprints[_pollId][_fingerprint], "already voted by fingerprint");
        
        poll.votes[_optionIndex] += 1;
        poll.hasVoted[msg.sender] = true;
        pollFingerprints[_pollId][_fingerprint] = true;
        emit Voted(_pollId, _optionIndex);
    }

    /**
     * @notice 获取指定投票的详细信息
     * @param _pollId 投票的 ID
     * @return title 投票标题
     * @return details 投票详情
     * @return options 投票选项数组
     * @return votes 各选项的票数数组
     * @return deadline 投票截止时间（时间戳）
     */
    function getPoll(uint256 _pollId) public view returns (
        string memory title, 
        string memory details, 
        string[] memory options, 
        uint256[] memory votes,
        uint256 deadline
    ) {
        require(_pollId > 0 && _pollId <= pollCount, "vote does not exist");
        Poll storage poll = polls[_pollId];
        uint256 len = poll.options.length;
        string[] memory optionsMemory = new string[](len);
        uint256[] memory votesMemory = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            optionsMemory[i] = poll.options[i];
            votesMemory[i] = poll.votes[i];
        }
        return (poll.title, poll.details, optionsMemory, votesMemory, poll.deadline);
    }
    
    /**
     * @notice 获取所有投票的摘要信息（ID、标题、截止时间），便于前端展示列表
     * @return ids 所有投票的 ID 数组
     * @return titles 所有投票的标题数组
     * @return deadlines 所有投票的截止时间数组
     */
    function getPollSummaries() public view returns (
        uint256[] memory ids, 
        string[] memory titles,
        uint256[] memory deadlines
    ) {
        ids = new uint256[](pollCount);
        titles = new string[](pollCount);
        deadlines = new uint256[](pollCount);
        for (uint256 i = 0; i < pollCount; i++) {
            Poll storage poll = polls[i + 1];
            ids[i] = i + 1;
            titles[i] = poll.title;
            deadlines[i] = poll.deadline;
        }
        return (ids, titles, deadlines);
    }
}



