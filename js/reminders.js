// 提醒功能模块

const ReminderManager = {
    checkInterval: null,
    notificationPermission: null,
    
    /**
     * 初始化提醒管理器
     */
    async init() {
        // 请求通知权限
        await this.requestNotificationPermission();
        
        // 立即检查一次
        await this.checkExpiringFoods();
        
        // 每5分钟检查一次
        this.checkInterval = setInterval(() => {
            this.checkExpiringFoods();
        }, 5 * 60 * 1000); // 5分钟
    },
    
    /**
     * 请求浏览器通知权限
     */
    async requestNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                this.notificationPermission = await Notification.requestPermission();
            } else {
                this.notificationPermission = Notification.permission;
            }
        }
    },
    
    /**
     * 检查即将过期的食物
     */
    async checkExpiringFoods() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const threeDaysLater = new Date();
            threeDaysLater.setDate(threeDaysLater.getDate() + 3);
            const threeDaysLaterStr = threeDaysLater.toISOString().split('T')[0];
            
            let expiringFoods = [];

            // 1. 尝试从 Supabase 获取数据
            let fetchedFromSupabase = false;
            if (window.supabaseClient) {
                try {
                    const { data: { user } } = await window.supabaseClient.auth.getUser();
                    if (user) {
                        const { data, error } = await window.supabaseClient
                            .from('food_items')
                            .select('*')
                            .eq('user_id', user.id)
                            .eq('is_consumed', false)
                            .not('expiration_date', 'is', null)
                            .lte('expiration_date', threeDaysLaterStr)
                            .order('expiration_date', { ascending: true });
                        
                        if (!error && data) {
                            expiringFoods = data;
                            fetchedFromSupabase = true;
                        }
                    }
                } catch (error) {
                    console.warn('Supabase检查失败，尝试本地存储');
                }
            }

            // 2. 如果没从 Supabase 获取到（未登录或未配置），则使用 LocalStorage
            if (!fetchedFromSupabase) {
                const localData = localStorage.getItem('food_items');
                if (localData) {
                    const allFoods = JSON.parse(localData);
                    expiringFoods = allFoods.filter(f => 
                        !f.is_consumed && 
                        f.expiration_date && 
                        f.expiration_date <= threeDaysLaterStr
                    ).sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date));
                }
            }
            
            // 3. 处理结果
            if (!expiringFoods || expiringFoods.length === 0) {
                this.hideReminderBanner();
                return;
            }
            
            // 分组处理：已过期、今天过期、即将过期
            const expired = expiringFoods.filter(f => {
                const days = daysBetween(f.expiration_date, today);
                return days < 0;
            });
            
            const expiringToday = expiringFoods.filter(f => {
                const days = daysBetween(f.expiration_date, today);
                return days === 0;
            });
            
            const expiringSoon = expiringFoods.filter(f => {
                const days = daysBetween(f.expiration_date, today);
                return days > 0 && days <= 3;
            });
            
            // 显示提醒横幅
            this.showReminderBanner(expired, expiringToday, expiringSoon);
            
            // 发送浏览器通知
            this.sendNotifications(expired, expiringToday, expiringSoon);
            
            // 记录提醒 (仅当连接了 Supabase 时记录到数据库，避免本地重复逻辑过于复杂)
            if (fetchedFromSupabase) {
                await this.recordReminders(expiringFoods);
            }
            
        } catch (error) {
            console.error('检查过期食物失败:', error);
        }
    },
    
    /**
     * 显示提醒横幅
     */
    showReminderBanner(expired, expiringToday, expiringSoon) {
        const banner = document.getElementById('reminderBanner');
        const messageEl = document.getElementById('reminderMessage');
        
        if (!banner || !messageEl) return;
        
        let message = '';
        let count = 0;
        
        if (expired.length > 0) {
            count += expired.length;
            message += `⚠️ ${expired.length} 个食物已过期`;
            if (expiringToday.length > 0 || expiringSoon.length > 0) {
                message += '；';
            }
        }
        
        if (expiringToday.length > 0) {
            count += expiringToday.length;
            message += `⏰ ${expiringToday.length} 个食物今天过期`;
            if (expiringSoon.length > 0) {
                message += '；';
            }
        }
        
        if (expiringSoon.length > 0) {
            count += expiringSoon.length;
            message += `🔔 ${expiringSoon.length} 个食物即将过期（3天内）`;
        }
        
        if (count > 0) {
            messageEl.textContent = message;
            banner.style.display = 'flex';
        } else {
            this.hideReminderBanner();
        }
    },
    
    /**
     * 隐藏提醒横幅
     */
    hideReminderBanner() {
        const banner = document.getElementById('reminderBanner');
        if (banner) {
            banner.style.display = 'none';
        }
    },
    
    /**
     * 发送浏览器通知
     */
    sendNotifications(expired, expiringToday, expiringSoon) {
        if (!('Notification' in window) || this.notificationPermission !== 'granted') {
            return;
        }
        
        const total = expired.length + expiringToday.length + expiringSoon.length;
        if (total === 0) return;
        
        let notificationBody = '';
        if (expired.length > 0) {
            notificationBody += `${expired.length} 个已过期`;
        }
        if (expiringToday.length > 0) {
            if (notificationBody) notificationBody += '，';
            notificationBody += `${expiringToday.length} 个今天过期`;
        }
        if (expiringSoon.length > 0) {
            if (notificationBody) notificationBody += '，';
            notificationBody += `${expiringSoon.length} 个即将过期`;
        }
        
        // 检查是否已经发送过通知（避免重复通知）
        const lastNotification = localStorage.getItem('lastReminderNotification');
        const now = Date.now();
        if (lastNotification && (now - parseInt(lastNotification)) < 5 * 60 * 1000) {
            // 5分钟内已发送过，不再发送
            return;
        }
        
        new Notification('🧊 冰箱食物提醒', {
            body: notificationBody,
            icon: '🧊',
            tag: 'food-reminder',
            requireInteraction: false
        });
        
        localStorage.setItem('lastReminderNotification', now.toString());
    },
    
    /**
     * 记录提醒到数据库
     */
    async recordReminders(foods) {
        try {
            if (!window.supabaseClient) return;
            
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) return;
            
            const today = new Date().toISOString().split('T')[0];
            const reminders = [];
            
            for (const food of foods) {
                const days = daysBetween(food.expiration_date, today);
                let reminderType;
                
                if (days < 0) {
                    reminderType = 'expired';
                } else if (days === 0) {
                    reminderType = 'expiring_today';
                } else {
                    reminderType = 'expiring_soon';
                }
                
                // 检查今天是否已经记录过这个提醒
                const { data: existing } = await window.supabaseClient
                    .from('expiration_reminders')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('food_item_id', food.id)
                    .eq('reminder_date', today)
                    .eq('reminder_type', reminderType)
                    .single();
                
                if (!existing) {
                    reminders.push({
                        user_id: user.id,
                        food_item_id: food.id,
                        reminder_type: reminderType,
                        reminder_date: today,
                        is_sent: true,
                        sent_at: new Date().toISOString()
                    });
                }
            }
            
            if (reminders.length > 0) {
                await window.supabaseClient
                    .from('expiration_reminders')
                    .insert(reminders);
            }
        } catch (error) {
            console.error('记录提醒失败:', error);
        }
    },
    
    /**
     * 清理资源
     */
    cleanup() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.ReminderManager = ReminderManager;
}