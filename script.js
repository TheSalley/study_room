document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const scheduleList = document.getElementById('schedule-list');
    const currentTimeElement = document.getElementById('current-time');
    const statusIndicator = document.getElementById('status-indicator');
    const connectionStatus = document.getElementById('connection-status');
    const bell = document.getElementById('bell');
    
    // 获取倒计时元素
    const countdownHours = document.getElementById('countdown-hours');
    const countdownMinutes = document.getElementById('countdown-minutes');
    const countdownSeconds = document.getElementById('countdown-seconds');
    const countdownTarget = document.getElementById('countdown-target');
    const countdownTimer = document.getElementById('countdown-timer');
    
    // 存储时间表数据
    let scheduleData = [];
    
    // 跟踪当前状态
    let currentStatus = 'free'; // 'class' 或 'free'
    let lastPlayedTime = 0; // 防止频繁播放铃声
    let nextEventTime = null; // 下一个事件的时间
    let nextEventName = ''; // 下一个事件的名称
    
    // 加载时间表数据
    async function loadScheduleData() {
        try {
            const response = await fetch('time.json');
            scheduleData = await response.json();
            renderSchedule();
        } catch (error) {
            console.error('加载时间表失败:', error);
            scheduleList.innerHTML = '<div class="load-error">加载时间表失败，请刷新页面重试。</div>';
        }
    }
    
    // 渲染时间表
    function renderSchedule() {
        scheduleList.innerHTML = '';
        
        scheduleData.forEach(item => {
            const scheduleItem = document.createElement('div');
            scheduleItem.className = 'schedule-item';
            scheduleItem.innerHTML = `
                <span class="schedule-time">${item.time}</span>
                <span class="schedule-name">${item.name}</span>
            `;
            scheduleList.appendChild(scheduleItem);
        });
        
        // 初始化后立即更新状态
        updateTimeAndStatus();
    }
    
    // 解析时间格式（将 HH:MM 格式转换为分钟数）
    function parseTime(timeStr) {
        const parts = timeStr.split(':');
        if (parts.length !== 2) return 0;
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    
    // 将分钟数转换为 HH:MM 格式
    function formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    
    // 判断当前是否在某个时间范围内
    function isInTimeRange(currentMinutes, timeRange) {
        if (!timeRange.includes('-')) {
            // 对于单个时间点（如起床、睡觉），单独处理
            const exactMinutes = parseTime(timeRange);
            return Math.abs(currentMinutes - exactMinutes) <= 1; // 允许1分钟误差
        }
        
        const [start, end] = timeRange.split('-');
        const startMinutes = parseTime(start);
        const endMinutes = parseTime(end);
        
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
    
    // 检查是否到了状态转换的边界（准备打铃）
    function isAtTimeBoundary(currentMinutes) {
        for (const item of scheduleData) {
            if (item.time.includes('-')) {
                const [start, end] = item.time.split('-');
                const startMinutes = parseTime(start);
                const endMinutes = parseTime(end);
                
                // 在开始或结束时刻（允许1分钟误差）
                if (Math.abs(currentMinutes - startMinutes) <= 1 || 
                    Math.abs(currentMinutes - endMinutes) <= 1) {
                    return true;
                }
            } else {
                // 对于单个时间点（如起床、睡觉）
                const exactMinutes = parseTime(item.time);
                if (Math.abs(currentMinutes - exactMinutes) <= 1) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // 计算下一个事件的时间
    function calculateNextEvent(currentMinutes) {
        let nextEvent = null;
        let minDiff = Infinity;
        
        // 查找今天剩余的事件
        for (const item of scheduleData) {
            let targetMinutes;
            
            if (item.time.includes('-')) {
                const [start, end] = item.time.split('-');
                const startMinutes = parseTime(start);
                const endMinutes = parseTime(end);
                
                // 如果在上课，则下一个事件是下课
                if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
                    if (item.name.includes('课')) {
                        targetMinutes = endMinutes;
                        const diff = targetMinutes - currentMinutes;
                        if (diff < minDiff && diff > 0) {
                            minDiff = diff;
                            nextEvent = {
                                time: formatTime(targetMinutes),
                                minutes: targetMinutes,
                                name: '下课',
                                diff: diff
                            };
                        }
                    }
                    continue;
                }
                
                // 否则下一个事件是上课开始
                targetMinutes = startMinutes;
            } else {
                targetMinutes = parseTime(item.time);
            }
            
            const diff = targetMinutes - currentMinutes;
            
            // 只考虑未来的事件（差值为正）
            if (diff > 0 && diff < minDiff) {
                minDiff = diff;
                nextEvent = {
                    time: item.time.includes('-') ? item.time.split('-')[0] : item.time,
                    minutes: targetMinutes,
                    name: item.name,
                    diff: diff
                };
            }
        }
        
        // 如果没有找到今天的下一个事件，设置为第一个事件（第二天）
        if (!nextEvent && scheduleData.length > 0) {
            const firstItem = scheduleData[0];
            let targetMinutes;
            
            if (firstItem.time.includes('-')) {
                targetMinutes = parseTime(firstItem.time.split('-')[0]);
            } else {
                targetMinutes = parseTime(firstItem.time);
            }
            
            // 加上24小时
            const nextDayMinutes = targetMinutes + 24 * 60;
            const diff = nextDayMinutes - currentMinutes;
            
            nextEvent = {
                time: firstItem.time.includes('-') ? firstItem.time.split('-')[0] : firstItem.time,
                minutes: targetMinutes,
                name: firstItem.name,
                diff: diff
            };
        }
        
        return nextEvent;
    }
    
    // 更新倒计时显示
    function updateCountdown(diffInMinutes) {
        if (diffInMinutes === null) {
            return;
        }
        
        const hours = Math.floor(diffInMinutes / 60);
        const minutes = Math.floor(diffInMinutes % 60);
        const seconds = Math.floor((diffInMinutes - Math.floor(diffInMinutes)) * 60);
        
        countdownHours.textContent = hours.toString().padStart(2, '0');
        countdownMinutes.textContent = minutes.toString().padStart(2, '0');
        countdownSeconds.textContent = seconds.toString().padStart(2, '0');
        
        // 如果倒计时小于5分钟，添加即将结束动画
        if (diffInMinutes < 5) {
            countdownTimer.classList.add('countdown-ending');
        } else {
            countdownTimer.classList.remove('countdown-ending');
        }
    }
    
    // 播放铃声的函数
    function playBell() {
        const now = Date.now();
        // 防止频繁播放（限制至少间隔30秒）
        if (now - lastPlayedTime > 30000) {
            lastPlayedTime = now;
            bell.play().catch(e => console.error('铃声播放失败:', e));
        }
    }
    
    // 更新当前时间和状态
    function updateTimeAndStatus() {
        // 获取当前时间
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds();
        const currentMinutes = now.getHours() * 60 + now.getMinutes() + seconds / 60;
        
        // 更新时间显示
        currentTimeElement.textContent = `${hours}:${minutes}`;
        
        // 检查是否在上课时间
        let isClassTime = false;
        let activeIndex = -1;
        
        for (let i = 0; i < scheduleData.length; i++) {
            const item = scheduleData[i];
            if (isInTimeRange(currentMinutes, item.time)) {
                // 如果包含"课"字，则表示上课时间
                if (item.name.includes('课')) {
                    isClassTime = true;
                    activeIndex = i;
                    break;
                }
            }
        }
        
        // 更新状态和UI
        const newStatus = isClassTime ? 'class' : 'free';
        
        // 如果状态发生变化，则播放铃声
        if (currentStatus !== newStatus) {
            playBell();
            currentStatus = newStatus;
        } else if (isAtTimeBoundary(currentMinutes)) {
            // 即使状态没变，如果正好在时间点上也播放铃声
            playBell();
        }
        
        // 更新UI状态
        if (isClassTime) {
            document.body.classList.add('class-time');
            document.body.classList.remove('break-time');
            statusIndicator.className = 'status-class';
            statusIndicator.textContent = '上课中';
        } else {
            document.body.classList.add('break-time');
            document.body.classList.remove('class-time');
            statusIndicator.className = 'status-free';
            statusIndicator.textContent = '休息时间';
        }
        
        // 更新活动时间表项
        const scheduleItems = document.querySelectorAll('.schedule-item');
        scheduleItems.forEach((item, index) => {
            if (index === activeIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // 模拟直播连接状态
        updateConnectionStatus();
        
        // 更新倒计时
        const nextEvent = calculateNextEvent(currentMinutes);
        if (nextEvent) {
            if (nextEvent.name !== nextEventName || nextEvent.minutes !== nextEventTime) {
                nextEventName = nextEvent.name;
                nextEventTime = nextEvent.minutes;
                
                // 更新显示的目标事件名称
                countdownTarget.textContent = nextEvent.name;
            }
            
            // 更新倒计时
            updateCountdown(nextEvent.diff);
        }
    }
    
    // 模拟更新连接状态
    function updateConnectionStatus() {
        if (Math.random() > 0.95) { // 偶尔显示连接状态变化
            connectionStatus.textContent = '重连中...';
            connectionStatus.className = 'status-badge reconnecting';
            
            setTimeout(() => {
                connectionStatus.textContent = '在线';
                connectionStatus.className = 'status-badge online';
            }, 2000);
        }
    }
    
    // 初始化连接状态样式
    if (connectionStatus) {
        connectionStatus.className = 'status-badge online';
    }
    
    // 初始化
    loadScheduleData();
    
    // 设置定时更新
    setInterval(updateTimeAndStatus, 1000); // 每秒更新一次
}); 