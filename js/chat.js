// 聊天功能模块

const ChatManager = {
    messages: [],
    
    /**
     * 初始化聊天管理器
     */
    async init() {
        await this.loadChatHistory();
        this.setupEventListeners();
    },
    
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        const sendBtn = document.getElementById('sendBtn');
        const messageInput = document.getElementById('messageInput');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    },
    
    /**
     * 发送消息
     */
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (!messageInput || !sendBtn) return;
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        // 检查API配置
        const config = await ApiConfig.getConfig();
        if (!config) {
            showMessage('请先配置API设置', 'warning');
            document.getElementById('settingsBtn').click();
            return;
        }
        
        // 禁用输入和按钮
        messageInput.disabled = true;
        sendBtn.disabled = true;
        
        // 添加用户消息到界面
        this.addMessage('user', message);
        messageInput.value = '';
        
        // 保存用户消息到数据库
        await this.saveMessage('user', message);
        
        try {
            // 调用LLM API
            const response = await this.callLLMAPI(message, config);
            
            // 添加AI回复到界面
            this.addMessage('assistant', response);
            
            // 保存AI回复到数据库
            await this.saveMessage('assistant', response);
            
            // 尝试提取食物信息
            await this.extractFoodInfo(response, message);
            
        } catch (error) {
            console.error('发送消息失败:', error);
            this.addMessage('assistant', '抱歉，我遇到了一些问题。请检查API配置是否正确。');
            showMessage('发送消息失败: ' + error.message, 'error');
        } finally {
            // 重新启用输入和按钮
            messageInput.disabled = false;
            sendBtn.disabled = false;
            messageInput.focus();
        }
    },
    
    /**
     * 调用LLM API
     * @param {string} userMessage - 用户消息
     * @param {Object} config - API配置
     * @returns {Promise<string>} AI回复
     */
    async callLLMAPI(userMessage, config) {
        // 构建请求消息历史
        const messages = this.buildMessageHistory(userMessage);
        
        const response = await fetch(config.api_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.api_key}`
            },
            body: JSON.stringify({
                model: config.model_name,
                messages: messages,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 提取回复内容（兼容不同的API响应格式）
        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content;
        } else if (data.content) {
            return data.content;
        } else if (data.response) {
            return data.response;
        } else {
            throw new Error('无法解析API响应');
        }
    },
    
    /**
     * 构建消息历史（用于上下文）
     * @param {string} currentMessage - 当前用户消息
     * @returns {Array} 消息数组
     */
    buildMessageHistory(currentMessage) {
        const systemPrompt = `你是一个帮助用户管理冰箱食物的AI助手。你的任务是：
1. 理解用户关于食物存储的对话
2. 提供友好的建议和回答
3. 当用户提到添加食物时，尝试提取以下信息：
   - 食物名称
   - 储存位置（上层、中层、下层、抽屉、门侧等）
   - 储存日期（如果没有提到，使用今天）
   - 过期日期或保质期（如果有提到）

请用友好、简洁的方式回复用户。`;
        
        const messages = [
            { role: 'system', content: systemPrompt }
        ];
        
        // 添加最近的历史消息（最多保留最近10条）
        const recentMessages = this.messages.slice(-10);
        for (const msg of recentMessages) {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        }
        
        // 添加当前消息
        messages.push({
            role: 'user',
            content: currentMessage
        });
        
        return messages;
    },
    
    /**
     * 从AI回复中提取食物信息
     * @param {string} aiResponse - AI回复
     * @param {string} userMessage - 用户消息
     */
    async extractFoodInfo(aiResponse, userMessage) {
        // 简单的关键词检测，判断是否提到添加食物
        const addKeywords = ['添加', '放入', '买了', '买了', '储存', '放'];
        const hasAddIntent = addKeywords.some(keyword => 
            userMessage.includes(keyword) || aiResponse.includes('已添加') || aiResponse.includes('已记录')
        );
        
        if (!hasAddIntent) {
            return;
        }
        
        // 尝试从消息中提取信息
        // 这里可以使用更复杂的NLP，但为了简单，我们提示用户手动确认
        // 或者可以让AI在回复中包含结构化数据
        
        // 简单示例：检查AI回复是否包含确认信息
        if (aiResponse.includes('已添加') || aiResponse.includes('已记录')) {
            showMessage('检测到添加食物的意图，请手动确认信息是否正确', 'info');
        }
    },
    
    /**
     * 添加消息到界面
     * @param {string} role - 角色：'user' 或 'assistant'
     * @param {string} content - 消息内容
     */
    addMessage(role, content) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // 移除欢迎消息（如果存在）
        const welcomeMsg = chatMessages.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${role}`;
        messageEl.textContent = content;
        
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // 保存到内存
        this.messages.push({ role, content, timestamp: new Date() });
    },
    
    /**
     * 保存消息到数据库
     * @param {string} role - 角色
     * @param {string} content - 内容
     */
    async saveMessage(role, content) {
        try {
            // 尝试保存到Supabase
            if (window.supabaseClient) {
                try {
                    const { data: { user } } = await window.supabaseClient.auth.getUser();
                    if (user) {
                        await window.supabaseClient
                            .from('chat_messages')
                            .insert({
                                user_id: user.id,
                                role: role,
                                content: content
                            });
                        return;
                    }
                } catch (error) {
                    console.warn('保存消息到Supabase失败:', error);
                }
            }
            
            // 使用localStorage作为后备（可选，聊天记录通常不需要持久化）
        } catch (error) {
            console.error('保存消息失败:', error);
        }
    },
    
    /**
     * 加载聊天历史
     */
    async loadChatHistory() {
        try {
            // 尝试从Supabase加载
            if (window.supabaseClient) {
                try {
                    const { data: { user } } = await window.supabaseClient.auth.getUser();
                    if (user) {
                        const { data, error } = await window.supabaseClient
                            .from('chat_messages')
                            .select('*')
                            .eq('user_id', user.id)
                            .order('created_at', { ascending: true })
                            .limit(50); // 最多加载最近50条
                        
                        if (!error && data && data.length > 0) {
                            this.messages = data.map(msg => ({
                                role: msg.role,
                                content: msg.content,
                                timestamp: new Date(msg.created_at)
                            }));
                            
                            // 渲染到界面
                            const chatMessages = document.getElementById('chatMessages');
                            if (chatMessages) {
                                chatMessages.innerHTML = '';
                                this.messages.forEach(msg => {
                                    this.addMessage(msg.role, msg.content);
                                });
                            }
                            return;
                        }
                    }
                } catch (error) {
                    console.warn('从Supabase加载聊天历史失败:', error);
                }
            }
            
            // 聊天历史为空，显示欢迎消息
            // 已经在HTML中有默认的欢迎消息了
        } catch (error) {
            console.error('加载聊天历史失败:', error);
        }
    },
    
    /**
     * 启用/禁用聊天输入
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (messageInput) {
            messageInput.disabled = !enabled;
        }
        if (sendBtn) {
            sendBtn.disabled = !enabled;
        }
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.ChatManager = ChatManager;
}

