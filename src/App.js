// App.js
import React, { useState, useEffect } from "react";
import Popup from "./Popup";
import Modal from "./Modal";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { ethers, keccak256, toUtf8Bytes } from "ethers";
import VotingPlatformABI from "./VotingPlatformABI.json";
import "./App.css";

function App() {
  // ================== React 状态管理 ==================
  const [items, setItems] = useState([]); // 从合约加载的投票信息，每项包含 id, title, details, options, deadline
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [fingerprint, setFingerprint] = useState("");

  // MetaMask 相关
  const [walletAddress, setWalletAddress] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState(null);

  // 当前时间（秒），用于倒计时显示
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // 合约地址从环境变量中读取（请在 .env 中配置 REACT_APP_VOTING_CONTRACT_ADDRESS）
  const contractAddress = process.env.REACT_APP_VOTING_CONTRACT_ADDRESS;

  // ================== 定时更新当前时间 ==================
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ================== useEffect 初始化 ==================
  useEffect(() => {
    const init = async () => {
      // 获取浏览器指纹
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setFingerprint(result.visitorId);
      console.log("User Fingerprint:", result.visitorId);

      // 检查钱包并（若已连接）从合约加载投票
      const connected = await checkIfWalletIsConnected();
      if (connected) {
        await loadPollsFromContract();
      }
    };

    init();
    setupEventListeners();
    return () => removeEventListeners();
  }, []);

  // ================== MetaMask 事件监听 ==================
  const setupEventListeners = () => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
      window.ethereum.on("connect", handleConnect);
      window.ethereum.on("disconnect", handleDisconnect);
    }
  };

  const removeEventListeners = () => {
    if (window.ethereum) {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
      window.ethereum.removeListener("connect", handleConnect);
      window.ethereum.removeListener("disconnect", handleDisconnect);
    }
  };

  // 事件处理
  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setIsConnected(false);
      setWalletAddress("");
      console.log("请连接 MetaMask.");
    } else {
      setWalletAddress(accounts[0]);
      setIsConnected(true);
      loadPollsFromContract();
    }
  };

  const handleChainChanged = (chainId) => {
    setChainId(chainId);
    window.location.reload();
  };

  const handleConnect = (connectInfo) => {
    console.log("MetaMask 已连接!", connectInfo);
  };

  const handleDisconnect = (error) => {
    console.log("MetaMask 已断开连接!", error);
    setIsConnected(false);
    setWalletAddress("");
  };

  // ================== 检查/连接/断开钱包 ==================
  const checkIfWalletIsConnected = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        console.log("请安装 MetaMask!");
        return false;
      }
      const currentChainId = await ethereum.request({ method: "eth_chainId" });
      setChainId(currentChainId);
      const accounts = await ethereum.request({ method: "eth_accounts" });
      if (accounts.length !== 0) {
        setWalletAddress(accounts[0]);
        setIsConnected(true);
        console.log("找到已授权账户:", accounts[0]);
        return true;
      }
      console.log("未找到授权账户");
      return false;
    } catch (error) {
      console.error("检查钱包连接状态时出错:", error);
      return false;
    }
  };

  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        alert("请安装 MetaMask!");
        return;
      }
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      setWalletAddress(accounts[0]);
      setIsConnected(true);
      console.log("已连接到钱包:", accounts[0]);
      const currentChainId = await ethereum.request({ method: "eth_chainId" });
      setChainId(currentChainId);
      await loadPollsFromContract();
    } catch (error) {
      console.error("连接钱包时出错:", error);
      if (error.code === 4001) {
        alert("用户拒绝连接钱包");
      } else {
        alert("连接钱包时出错");
      }
    }
  };

  const disconnectWallet = () => {
    setWalletAddress("");
    setIsConnected(false);
    setChainId(null);
    setItems([]);
  };

  // ================== 连接合约的帮助函数 ==================
  const getContract = async () => {
    if (!contractAddress) {
      alert(
        "合约地址未设置，请在 .env 中配置 REACT_APP_VOTING_CONTRACT_ADDRESS！"
      );
      return null;
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(contractAddress, VotingPlatformABI.abi, signer);
  };

  // ================== 从合约加载已有投票列表 ==================
  const loadPollsFromContract = async () => {
    try {
      const contract = await getContract();
      if (!contract) return;
      // 调用 getPollSummaries 返回 [ids, titles, deadlines]
      const [ids, titles, deadlines] = await contract.getPollSummaries();
      let loadedPolls = [];
      for (let i = 0; i < ids.length; i++) {
        const pollId = Number(ids[i]);
        // 调用 getPoll 获取详细信息 (返回 [title, details, options, votes, deadline])
        const pollData = await contract.getPoll(pollId);
        const title = pollData[0];
        const details = pollData[1];
        const options = pollData[2];
        const votes = pollData[3];
        const deadline = Number(pollData[4]);
        let optionObjects = options.map((optText, idx) => ({
          text: optText,
          number: Number(votes[idx]),
        }));
        loadedPolls.push({
          id: pollId,
          title,
          details,
          options: optionObjects,
          deadline,
        });
      }
      setItems(loadedPolls);
    } catch (error) {
      console.error("加载投票失败:", error);
    }
  };

  // ================== 创建投票（在 Modal 中操作） ==================
  // 新的 createPollOnChain 需要传入 duration（单位：秒）
  const createPollOnChain = async (title, details, optionsArray, duration) => {
    try {
      const contract = await getContract();
      if (!contract) return;
      const optionTexts = optionsArray.map((opt) => opt.text);
      if (
        optionTexts.length === 0 ||
        optionTexts.some((text) => text.trim() === "")
      ) {
        alert("请确保所有选项都有内容");
        return;
      }
      // 发起交易，传入 duration 参数
      const txResponse = await contract.createPoll(
        title,
        details,
        optionTexts,
        duration,
        {
          gasLimit: 300000,
        }
      );
      const txReceipt = await txResponse.wait();
      // 尝试从 PollCreated 事件中解析新投票 ID
      let newPollId;
      for (const log of txReceipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          if (parsedLog.name === "PollCreated") {
            newPollId = parsedLog.args.pollId;
            break;
          }
        } catch (e) {
          // 忽略无法解析的日志
        }
      }
      if (newPollId) {
        console.log("New poll ID:", newPollId.toString());
      } else {
        console.warn("未能解析到 PollCreated 事件，新 pollId 为空");
      }
      alert("投票已创建成功!");
      await loadPollsFromContract();
    } catch (error) {
      console.error("createPollOnChain 出错:", error);
      alert("创建投票时出错，请查看控制台日志");
    }
  };

  // ================== 进行投票（单选） ==================
  // 进行投票（单选）时，增加 fingerprint 参数
  const voteOnChain = async (pollId, optionIndex) => {
    try {
      if (pollId === undefined) {
        throw new Error("pollId is undefined");
      }
      const contract = await getContract();
      if (!contract) return;
      // 使用 ethers v6 的导入函数计算 fingerprint 的哈希
      const fpHash = keccak256(toUtf8Bytes(fingerprint));
      const tx = await contract.vote(pollId, optionIndex, fpHash);
      await tx.wait();
      alert("投票成功!");
      await loadPollsFromContract();
    } catch (error) {
      console.error("voteOnChain 出错:", error);
    }
  };

  // ================== 原有弹窗等 UI 逻辑 ==================
  const openModal = () => setIsModalOpen(true);
  const openPopup = (item) => {
    setSelectedItem(item);
    setIsPopupOpen(true);
  };
  const closePopup = () => {
    setIsPopupOpen(false);
    setSelectedItem(null);
  };
  const closeModal = async () => {
    setIsModalOpen(false);
  };

  // 投票操作（点击投票选项前检查是否还在有效期）
  const handleOptionClick = (option, pollId, index) => {
    // 在 items 中查找当前投票对象
    const poll = items.find((item) => item.id === pollId);
    if (poll) {
      if (currentTime >= poll.deadline) {
        alert("投票已结束");
        return;
      }
    }
    voteOnChain(pollId, index);
  };

  // 渲染倒计时文本
  const renderCountdown = (deadline) => {
    const remaining = deadline - currentTime;
    if (remaining > 0) {
      // 格式化为 分:秒 或直接显示秒数
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      return `剩余时间：${minutes}分${seconds}秒`;
    } else {
      return "已结束";
    }
  };

  // ================== 页面渲染 ==================
  return (
    <div className="App" style={{ position: "relative" }}>
      <h1>去中心化投票 Demo</h1>

      {/* MetaMask 连接状态 */}
      <div className="wallet-section" style={{ margin: "20px 0" }}>
        {!isConnected ? (
          <button onClick={connectWallet} className="wallet-button">
            连接 MetaMask
          </button>
        ) : (
          <div className="wallet-info">
            <p>
              已连接钱包: {walletAddress.slice(0, 6)}...
              {walletAddress.slice(-4)}
            </p>
            <p>当前网络 ChainId: {chainId}</p>
            <button onClick={disconnectWallet} className="wallet-button">
              断开连接
            </button>
          </div>
        )}
      </div>

      {/* 创建投票按钮 */}
      <button onClick={openModal}>添加投票</button>

      <div>
        <h3>当前链上已有投票:</h3>
        <ul>
          {items.length > 0 ? (
            items.map((item, index) => (
              <li key={index} onClick={() => openPopup(item)}>
                {item.title} - {renderCountdown(item.deadline)}
              </li>
            ))
          ) : (
            <p>没有任何投票</p>
          )}
        </ul>
      </div>

      {/* 弹出创建投票的 Modal */}
      {isModalOpen && (
        <Modal closeModal={closeModal} createPollOnChain={createPollOnChain} />
      )}

      {/* 投票详情弹窗 */}
      {isPopupOpen && selectedItem && (
        <Popup
          title={selectedItem.title}
          details={selectedItem.details}
          options={selectedItem.options}
          closePopup={closePopup}
          pollId={selectedItem.id}
          handleOptionClick={handleOptionClick}
        />
      )}

      {/* 显示用户指纹 */}
      <div>{fingerprint && <p>User Fingerprint: {fingerprint}</p>}</div>
    </div>
  );
}

export default App;
