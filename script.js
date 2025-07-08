// 全域變數
let channels = [];
let minRespawnTime = 0;
let maxRespawnTime = 0;
let updateInterval;

// DOM元素
const minTimeInput = document.getElementById('min-time');
const maxTimeInput = document.getElementById('max-time');
const channelInput = document.getElementById('channel-input');
const confirmBtn = document.getElementById('confirm-btn');
const killBtn = document.getElementById('kill-btn');
const removeSelectedBtn = document.getElementById('remove-selected-btn');
const channelList = document.getElementById('channel-list');

// 頻道數據結構
class Channel {
    constructor(channelNumber, killTime, minRespawn, maxRespawn) {
        this.channelNumber = channelNumber;
        this.killTime = killTime;
        this.minRespawnTime = minRespawn;
        this.maxRespawnTime = maxRespawn;
        this.selected = false;
    }

    // 計算當前狀態
    getStatus() {
        const now = new Date();
        const timeSinceKillInSeconds = Math.floor((now - this.killTime) / 1000);

        const minTimeInSeconds = this.minRespawnTime * 60;
        const maxTimeInSeconds = this.maxRespawnTime * 60;
        const halfTimeInSeconds = minTimeInSeconds + (maxTimeInSeconds - minTimeInSeconds) / 2;
        const aboutToRespawnTimeInSeconds = minTimeInSeconds - 60; // 1 minute before

        if (timeSinceKillInSeconds < aboutToRespawnTimeInSeconds) {
            return '尚未重生';
        } else if (timeSinceKillInSeconds >= aboutToRespawnTimeInSeconds && timeSinceKillInSeconds < minTimeInSeconds) {
            return '即將重生';
        } else if (timeSinceKillInSeconds >= minTimeInSeconds && timeSinceKillInSeconds < halfTimeInSeconds) {
            return '出現(機率低)';
        } else if (timeSinceKillInSeconds >= halfTimeInSeconds && timeSinceKillInSeconds <= maxTimeInSeconds) {
            return '出現(機率高)';
        } else {
            return '已失效';
        }
    }

    // 獲取超時分鐘數（僅用於已失效狀態）
    getExpiredMinutes() {
        const now = new Date();
        const timeSinceKill = Math.floor((now - this.killTime) / (1000 * 60));
        return timeSinceKill - this.maxRespawnTime;
    }

    // 獲取排序優先級（數字越小優先級越高）
    getSortPriority() {
        const status = this.getStatus();
        const statusPriority = {
            '已失效': 1,
            '出現(機率高)': 2,
            '出現(機率低)': 3,
            '即將重生': 4,
            '尚未重生': 5
        };

        const now = new Date();
        const timeSinceKill = Math.floor((now - this.killTime) / (1000 * 60));

        if (status === '已失效') {
            // 已失效的頻道，按超時時間長到短排序（timeSinceKill越大，超時越長，優先級越高）
            return statusPriority[status] * 10000 - timeSinceKill;
        } else {
            // 其他狀態，按進入狀態的時間先後排序
            return statusPriority[status] * 10000 + timeSinceKill;
        }
    }
}

// 初始化事件監聽器
function initEventListeners() {
    // 重生時間輸入驗證
    minTimeInput.addEventListener('input', validateRespawnTime);
    maxTimeInput.addEventListener('input', validateRespawnTime);

    // 頻道輸入
    channelInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            addChannel();
        }
    });

    // 按鈕事件
    confirmBtn.addEventListener('click', addChannel);
    killBtn.addEventListener('click', killSelectedChannels);
    removeSelectedBtn.addEventListener('click', removeSelectedChannels);
}

// 驗證重生時間輸入
function validateRespawnTime() {
    const minTime = parseInt(minTimeInput.value) || 0;
    const maxTime = parseInt(maxTimeInput.value) || 0;

    if (minTime > 0 && maxTime > 0 && maxTime > minTime) {
        minRespawnTime = minTime;
        maxRespawnTime = maxTime;
        confirmBtn.disabled = false;
    } else {
        confirmBtn.disabled = true;
    }
}

// 新增頻道
function addChannel() {
    const channelNumber = channelInput.value.trim();

    // 驗證輸入
    if (!channelNumber || isNaN(channelNumber) || channelNumber.length > 4) {
        alert('請輸入有效的頻道號碼（1-4位數字）');
        return;
    }

    if (minRespawnTime === 0 || maxRespawnTime === 0) {
        alert('請先設定重生時間');
        return;
    }

    // 檢查是否已存在
    if (channels.find(ch => ch.channelNumber === channelNumber)) {
        alert('此頻道已存在');
        return;
    }

    // 創建新頻道（擊殺時間為當前時間）
    const newChannel = new Channel(channelNumber, new Date(), minRespawnTime, maxRespawnTime);
    channels.push(newChannel);

    // 清空輸入框
    channelInput.value = '';

    // 更新顯示
    updateChannelList();
}

// 更新頻道列表顯示
function updateChannelList() {
    // 排序頻道
    channels.sort((a, b) => a.getSortPriority() - b.getSortPriority());

    // 清空列表
    channelList.innerHTML = '';

    // 生成頻道項目
    channels.forEach(channel => {
        const channelItem = createChannelItem(channel);
        channelList.appendChild(channelItem);
    });

    // 更新擊殺按鈕狀態
    updateKillButtonState();
}

// 創建頻道項目元素
function createChannelItem(channel) {
    const item = document.createElement('div');
    item.className = 'channel-item';
    item.dataset.channelNumber = channel.channelNumber;

    const status = channel.getStatus();
    item.dataset.status = status;

    if (channel.selected) {
        item.classList.add('selected');
    }

    // 頻道號碼
    const channelNumber = document.createElement('span');
    channelNumber.className = 'channel-number';
    channelNumber.textContent = `ch ${channel.channelNumber}`;

    // 狀態顯示
    const statusContainer = document.createElement('div');
    const channelStatus = document.createElement('span');
    channelStatus.className = 'channel-status';
    channelStatus.textContent = status;

    statusContainer.appendChild(channelStatus);

    // 如果是已失效狀態，顯示超時分鐘數
    if (status === '已失效') {
        const expiredInfo = document.createElement('span');
        expiredInfo.className = 'expired-info';
        expiredInfo.textContent = `(超時${channel.getExpiredMinutes()}分鐘)`;
        statusContainer.appendChild(expiredInfo);
    }

    item.appendChild(channelNumber);
    item.appendChild(statusContainer);

    // 點擊事件
    item.addEventListener('click', () => {
        toggleChannelSelection(channel.channelNumber);
    });

    return item;
}

// 切換頻道選擇狀態
function toggleChannelSelection(channelNumber) {
    const channel = channels.find(ch => ch.channelNumber === channelNumber);
    if (channel) {
        channel.selected = !channel.selected;
        updateChannelList();
    }
}

// 更新擊殺按鈕狀態
function updateKillButtonState() {
    const hasSelected = channels.some(ch => ch.selected);
    killBtn.disabled = !hasSelected;
}

// 擊殺選中的頻道
function killSelectedChannels() {
    const selectedChannels = channels.filter(ch => ch.selected);

    if (selectedChannels.length === 0) {
        return;
    }

    // 更新擊殺時間為當前時間，並取消選中狀態
    selectedChannels.forEach(channel => {
        channel.killTime = new Date();
        channel.minRespawnTime = minRespawnTime;
        channel.maxRespawnTime = maxRespawnTime;
        channel.selected = false;
    });

    // 更新顯示
    updateChannelList();
}

// 移除選中的頻道
function removeSelectedChannels() {
    const selectedChannels = channels.filter(ch => ch.selected);

    if (selectedChannels.length === 0) {
        alert('請先選擇要移除的頻道');
        return;
    }

    if (confirm(`確定要移除 ${selectedChannels.length} 個選定的頻道嗎？`)) {
        channels = channels.filter(ch => !ch.selected);
        updateChannelList();
    }
}

// 開始即時更新
function startRealTimeUpdate() {
    updateInterval = setInterval(() => {
        updateChannelList();
    }, 1000); // 每秒更新一次
}

// 停止即時更新
function stopRealTimeUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
}

// 頁面初始化
document.addEventListener('DOMContentLoaded', function () {
    initEventListeners();
    validateRespawnTime();
    startRealTimeUpdate();
});

// 頁面卸載時清理
window.addEventListener('beforeunload', function () {
    stopRealTimeUpdate();
});
