// 野王資料庫
const monsterDatabase = {
    'custom': {
        name: '自訂',
        minRespawn: null,
        maxRespawn: null,
        expired: 5,
        description: '手動設定重生時間'
    },
    'snow_yeti': {
        name: '雪毛怪人',
        minRespawn: 45,
        maxRespawn: 68,
        expired: 10,
        description: '重生時間：45-68分鐘'
    },
    'black_ring_king': {
        name: '黑輪王',
        minRespawn: 780,  // 13小時 = 780分鐘
        maxRespawn: 1020, // 17小時 = 1020分鐘
        expired: 60,      // 較長的失效時間，適合長時間重生的野王
        description: '重生時間：13-17小時'
    }
};

// 全域變數
let channels = [];
let minRespawnTime = 0;
let maxRespawnTime = 0;
let expiredTime = 5; // 預設值
let currentMonsterType = 'custom'; // 當前選擇的野王類型
let updateInterval;

// DOM元素
const monsterSelect = document.getElementById('monster-select');
const minTimeInput = document.getElementById('min-time');
const maxTimeInput = document.getElementById('max-time');
const expiredTimeInput = document.getElementById('expired-time');
const channelInput = document.getElementById('channel-input');
const confirmBtn = document.getElementById('confirm-btn');
const killBtn = document.getElementById('kill-btn');
const removeSelectedBtn = document.getElementById('remove-selected-btn');
const clearBtn = document.getElementById('clear-btn');
const shareBtn = document.getElementById('share-btn');
const channelList = document.getElementById('channel-list');

// Modal DOM 元素
const shareModal = document.getElementById('share-modal');
const shareUrlInput = document.getElementById('share-url-input');
const closeModalBtn = document.getElementById('close-modal-btn');


// 頻道數據結構
class Channel {
    constructor(channelNumber, killTime, minRespawn, maxRespawn, expired) {
        this.channelNumber = channelNumber;
        this.killTime = killTime;
        this.minRespawnTime = minRespawn;
        this.maxRespawnTime = maxRespawn;
        this.expiredTime = expired;
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
            const expiredMinutes = this.getExpiredMinutes();
            return `超過重生時間 ${expiredMinutes} 分鐘`;
        }
    }

    // 獲取超時分鐘數
    getExpiredMinutes() {
        const now = new Date();
        const timeSinceKill = Math.floor((now - this.killTime) / (1000 * 60));
        return timeSinceKill - this.maxRespawnTime;
    }

    // 獲取排序優先級（數字越小優先級越高）
    getSortPriority() {
        const status = this.getStatus();
        const statusPriority = {
            '出現(機率高)': 2,
            '出現(機率低)': 3,
            '即將重生': 4,
            '尚未重生': 5
        };

        const now = new Date();
        const timeSinceKill = Math.floor((now - this.killTime) / (1000 * 60));

        if (status.startsWith('超過重生時間')) {
            // 超過重生時間的頻道，按超時時間長到短排序（timeSinceKill越大，超時越長，優先級越高）
            return 1 * 10000 - timeSinceKill;
        } else {
            // 其他狀態，按進入狀態的時間先後排序
            return statusPriority[status] * 10000 + timeSinceKill;
        }
    }

    // 新增：計算重生倒數時間
    getCountdown() {
        const now = new Date();
        const timeSinceKillInSeconds = Math.floor((now - this.killTime) / 1000);
        const maxTimeInSeconds = this.maxRespawnTime * 60;
        const remainingSeconds = maxTimeInSeconds - timeSinceKillInSeconds;

        if (remainingSeconds > 0) {
            const minutes = Math.ceil(remainingSeconds / 60);
            return `倒數 ${minutes} 分`;
        } else {
            return null; // 不顯示倒數
        }
    }
}

// 野王選擇處理函數
function handleMonsterSelection() {
    const selectedMonster = monsterSelect.value;
    currentMonsterType = selectedMonster;
    
    const monster = monsterDatabase[selectedMonster];
    
    if (selectedMonster === 'custom') {
        // 自訂模式：啟用輸入框
        minTimeInput.disabled = false;
        maxTimeInput.disabled = false;
        expiredTimeInput.disabled = false;
        
        // 清空輸入框或保持現有值
        if (minRespawnTime === 0 && maxRespawnTime === 0) {
            minTimeInput.value = '';
            maxTimeInput.value = '';
            expiredTimeInput.value = '5';
        }
    } else {
        // 預設野王模式：填入預設值並禁用輸入框
        minTimeInput.value = monster.minRespawn;
        maxTimeInput.value = monster.maxRespawn;
        expiredTimeInput.value = monster.expired;
        
        minTimeInput.disabled = true;
        maxTimeInput.disabled = true;
        expiredTimeInput.disabled = true;
        
        // 更新全域變數
        minRespawnTime = monster.minRespawn;
        maxRespawnTime = monster.maxRespawn;
        expiredTime = monster.expired;
        
        // 啟用確認按鈕
        confirmBtn.disabled = false;
    }
    
    // 驗證並儲存
    validateRespawnTime();
    saveData();
}

// 初始化事件監聽器
function initEventListeners() {
    // 野王選擇
    monsterSelect.addEventListener('change', handleMonsterSelection);
    
    // 重生時間輸入驗證
    minTimeInput.addEventListener('input', validateRespawnTime);
    maxTimeInput.addEventListener('input', validateRespawnTime);
    expiredTimeInput.addEventListener('input', validateRespawnTime);

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
    clearBtn.addEventListener('click', clearAllData);
    shareBtn.addEventListener('click', exportData);

    // Modal 事件
    closeModalBtn.addEventListener('click', closeShareModal);
    shareModal.addEventListener('click', function (e) {
        if (e.target === shareModal) {
            closeShareModal();
        }
    });
}

// 驗證重生時間輸入
function validateRespawnTime() {
    const minTime = parseInt(minTimeInput.value) || 0;
    const maxTime = parseInt(maxTimeInput.value) || 0;
    const expired = parseInt(expiredTimeInput.value) || 0;

    if (minTime > 0 && maxTime > 0 && maxTime > minTime && expired > 0) {
        minRespawnTime = minTime;
        maxRespawnTime = maxTime;
        expiredTime = expired;
        confirmBtn.disabled = false;
    } else {
        confirmBtn.disabled = true;
    }
    saveData();
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
    const newChannel = new Channel(channelNumber, new Date(), minRespawnTime, maxRespawnTime, expiredTime);
    channels.push(newChannel);

    // 清空輸入框
    channelInput.value = '';

    // 更新顯示
    updateChannelList();
    saveData();
}

// 更新頻道列表顯示
function updateChannelList() {
    // 移除超時的頻道
    channels = channels.filter(channel => {
        if (channel.getStatus().startsWith('超過重生時間')) {
            return channel.getExpiredMinutes() <= channel.expiredTime;
        }
        return true;
    });

    // 排序頻道：從擊殺後經過最久時間到擊殺後經過時間最短的頻道
    channels.sort((a, b) => a.killTime.getTime() - b.killTime.getTime());

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
    statusContainer.className = 'status-container'; // Add this class
    const channelStatus = document.createElement('span');
    channelStatus.className = 'channel-status';
    channelStatus.textContent = status;

    statusContainer.appendChild(channelStatus);

    // 倒數計時
    const countdown = channel.getCountdown();
    if (countdown) {
        const countdownSpan = document.createElement('span');
        countdownSpan.className = 'channel-countdown';
        countdownSpan.textContent = countdown;
        statusContainer.appendChild(countdownSpan);
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
        channel.expiredTime = expiredTime;
        channel.selected = false;
    });

    // 更新顯示
    updateChannelList();
    saveData();
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
        saveData();
    }
}

// 清除所有資料
function clearAllData() {
    if (confirm('確定要清除所有頻道和設定嗎？')) {
        localStorage.removeItem('monsterBornTimeData');
        location.reload();
    }
}

// 儲存資料到localStorage
function saveData() {
    const data = {
        channels: channels,
        minRespawnTime: minRespawnTime,
        maxRespawnTime: maxRespawnTime,
        expiredTime: expiredTime,
        currentMonsterType: currentMonsterType
    };
    localStorage.setItem('monsterBornTimeData', JSON.stringify(data));
}

// 從localStorage載入資料
function loadData() {
    const savedData = localStorage.getItem('monsterBornTimeData');
    if (savedData) {
        const data = JSON.parse(savedData);
        minRespawnTime = data.minRespawnTime || 0;
        maxRespawnTime = data.maxRespawnTime || 0;
        expiredTime = data.expiredTime || 5;
        currentMonsterType = data.currentMonsterType || 'custom';

        // 設定野王選擇
        monsterSelect.value = currentMonsterType;
        
        // 根據野王類型設定輸入框狀態
        if (currentMonsterType === 'custom') {
            minTimeInput.disabled = false;
            maxTimeInput.disabled = false;
            expiredTimeInput.disabled = false;
        } else {
            minTimeInput.disabled = true;
            maxTimeInput.disabled = true;
            expiredTimeInput.disabled = true;
        }

        minTimeInput.value = minRespawnTime;
        maxTimeInput.value = maxRespawnTime;
        expiredTimeInput.value = expiredTime;

        channels = data.channels.map(ch => {
            const channel = new Channel(ch.channelNumber, new Date(ch.killTime), ch.minRespawnTime, ch.maxRespawnTime, ch.expiredTime);
            channel.selected = ch.selected;
            return channel;
        });

        updateChannelList();
    }
}

// 從URL匯入資料
function importDataFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('data');

    if (data) {
        try {
            const decodedString = atob(data);
            const importedChannels = JSON.parse(decodedString);

            if (Array.isArray(importedChannels)) {
                const currentSettings = {
                    minRespawnTime: minRespawnTime,
                    maxRespawnTime: maxRespawnTime,
                    expiredTime: expiredTime
                };

                const newData = {
                    ...currentSettings,
                    channels: importedChannels
                };

                localStorage.setItem('monsterBornTimeData', JSON.stringify(newData));
                // 清理URL，避免重新整理時重複匯入
                window.history.replaceState({}, document.title, window.location.pathname);
                alert('頻道資訊已成功匯入！');
                return true;
            }
        } catch (e) {
            console.error('無法解析分享的資料:', e);
            alert('匯入資料失敗，分享連結可能已損毀。');
        }
    }
    return false;
}

// Share Modal Functions
function showShareModal(url) {
    shareUrlInput.value = url;
    shareModal.style.display = 'flex';
    shareUrlInput.select();
}

function closeShareModal() {
    shareModal.style.display = 'none';
}

// 匯出資料為URL
function exportData() {
    const savedData = localStorage.getItem('monsterBornTimeData');
    if (!savedData || JSON.parse(savedData).channels.length === 0) {
        alert('沒有可分享的頻道資訊。');
        return;
    }

    const data = JSON.parse(savedData);
    const channelsToShare = data.channels;

    try {
        const jsonString = JSON.stringify(channelsToShare);
        const encodedData = btoa(jsonString);
        const shareUrl = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('分享連結已複製到剪貼簿！');
            }).catch(err => {
                console.error('自動複製失敗，顯示手動複製視窗: ', err);
                showShareModal(shareUrl);
            });
        } else {
            showShareModal(shareUrl);
        }

    } catch (e) {
        console.error('建立分享連結失敗:', e);
        alert('建立分享連結時發生錯誤。');
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
    importDataFromUrl();
    loadData();
    initEventListeners();
    validateRespawnTime();
    startRealTimeUpdate();
});

// 頁面卸載時清理
window.addEventListener('beforeunload', function () {
    stopRealTimeUpdate();
});
