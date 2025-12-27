// API配置管理模块

const ApiConfig = {
    config: null,
    
    /**
     * 检查用户是否已配置API
     * @returns {Promise<boolean>}
     */
    async hasConfig() {
        try {
            if (!window.supabaseClient) {
                console.error('Supabase客户端未初始化');
                return false;
            }
            
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) {
                return false;
            }
            
            const { data, error } = await window.supabaseClient
                .from('user_api_config')
                .select('*')
                .eq('user_id', user.id)
                .single();
            
            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                console.error('查询API配置失败:', error);
                return false;
            }
            
            if (data) {
                this.config = data;
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('检查API配置时出错:', error);
            return false;
        }
    },
    
    /**
     * 获取API配置
     * @returns {Promise<Object|null>}
     */
    async getConfig() {
        if (this.config) {
            return this.config;
        }
        
        // 先尝试从Supabase获取
        const hasConfig = await this.hasConfig();
        if (hasConfig) {
            return this.config;
        }
        
        // 尝试从localStorage获取（后备方案）
        const localConfig = localStorage.getItem('api_config');
        if (localConfig) {
            try {
                this.config = JSON.parse(localConfig);
                return this.config;
            } catch (error) {
                console.warn('解析本地API配置失败:', error);
            }
        }
        
        return null;
    },
    
    /**
     * 保存API配置
     * @param {string} apiUrl - API地址
     * @param {string} apiKey - API密钥
     * @param {string} modelName - 模型名称
     * @returns {Promise<boolean>}
     */
    async saveConfig(apiUrl, apiKey, modelName) {
        const configData = {
            api_url: apiUrl,
            api_key: apiKey,
            model_name: modelName,
            updated_at: new Date().toISOString()
        };
        
        try {
            // 尝试保存到Supabase
            if (window.supabaseClient) {
                try {
                    const { data: { user } } = await window.supabaseClient.auth.getUser();
                    if (user) {
                        // 检查是否已存在配置
                        const { data: existing } = await window.supabaseClient
                            .from('user_api_config')
                            .select('id')
                            .eq('user_id', user.id)
                            .single();
                        
                        let result;
                        if (existing) {
                            // 更新现有配置
                            const { data, error } = await window.supabaseClient
                                .from('user_api_config')
                                .update({
                                    api_url: apiUrl,
                                    api_key: apiKey,
                                    model_name: modelName,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('user_id', user.id)
                                .select()
                                .single();
                            
                            if (!error && data) {
                                this.config = data;
                                // 同时保存到localStorage作为备份
                                localStorage.setItem('api_config', JSON.stringify(configData));
                                return true;
                            }
                        } else {
                            // 插入新配置
                            const { data, error } = await window.supabaseClient
                                .from('user_api_config')
                                .insert({
                                    user_id: user.id,
                                    api_url: apiUrl,
                                    api_key: apiKey,
                                    model_name: modelName
                                })
                                .select()
                                .single();
                            
                            if (!error && data) {
                                this.config = data;
                                // 同时保存到localStorage作为备份
                                localStorage.setItem('api_config', JSON.stringify(configData));
                                return true;
                            }
                        }
                    }
                } catch (error) {
                    console.warn('保存到Supabase失败，使用本地存储:', error);
                }
            }
            
            // 使用localStorage作为后备
            this.config = configData;
            localStorage.setItem('api_config', JSON.stringify(configData));
            return true;
        } catch (error) {
            console.error('保存API配置失败:', error);
            throw error;
        }
    },
    
    /**
     * 验证API配置是否有效
     * @returns {boolean}
     */
    isValid() {
        return this.config && 
               this.config.api_url && 
               this.config.api_key && 
               this.config.model_name;
    },
    
    /**
     * 清除配置缓存
     */
    clearCache() {
        this.config = null;
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.ApiConfig = ApiConfig;
}

