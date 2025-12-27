// 主应用逻辑

// 应用初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. 初始化食物管理模块 (必须先于界面渲染)
        if (typeof FoodManager !== 'undefined') {
            await FoodManager.init();
        } else {
            console.error('FoodManager 未加载');
        }

        // 2. 初始化聊天模块
        if (typeof ChatManager !== 'undefined') {
            await ChatManager.init();
        }

        // 3. 初始化提醒模块
        if (typeof ReminderManager !== 'undefined') {
            await ReminderManager.init();
        } else {
            console.error('ReminderManager 未加载');
        }
        
        // 4. 设置事件监听器
        setupEventListeners();
        
        // 5. 设置默认日期为今天
        const storageDateInput = document.getElementById('storageDate');
        if (storageDateInput) {
            storageDateInput.value = getDateInputValue(new Date());
        }
        
        // 6. 检查API配置状态
        // 逻辑：即使没有 Supabase 登录，我们依然允许使用(本地模式)。
        // 只有在配置了 API Key 的情况下才真正启用聊天发送功能。
        if (typeof ApiConfig !== 'undefined') {
            const hasConfig = await ApiConfig.hasConfig();
            if (hasConfig) {
                ChatManager.setEnabled(true);
            } else {
                // 如果没有配置API，可以选择提示用户，或者什么都不做(用户手动去点设置)
                // ChatManager 默认是禁用的，等待配置
            }
        }
        
    } catch (error) {
        console.error('应用初始化失败:', error);
        showMessage('应用初始化失败: ' + error.message, 'error');
    }
});

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            showSettingsPanel();
        });
    }
    
    // 关闭设置面板
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', hideSettingsPanel);
    }
    if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', hideSettingsPanel);
    }
    
    // 设置表单提交
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleSettingsSubmit();
        });
    }
    
    // 手动添加按钮
    const manualAddBtn = document.getElementById('manualAddBtn');
    if (manualAddBtn) {
        manualAddBtn.addEventListener('click', () => {
            showManualAddModal();
        });
    }
    
    // 关闭手动添加模态框
    const closeManualAddBtn = document.getElementById('closeManualAddBtn');
    const cancelManualAddBtn = document.getElementById('cancelManualAddBtn');
    if (closeManualAddBtn) {
        closeManualAddBtn.addEventListener('click', hideManualAddModal);
    }
    if (cancelManualAddBtn) {
        cancelManualAddBtn.addEventListener('click', hideManualAddModal);
    }
    
    // 手动添加表单提交
    const manualAddForm = document.getElementById('manualAddForm');
    if (manualAddForm) {
        manualAddForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleManualAddSubmit();
        });
    }
    
    // 关闭提醒横幅
    const closeReminderBtn = document.getElementById('closeReminderBtn');
    if (closeReminderBtn) {
        closeReminderBtn.addEventListener('click', () => {
            ReminderManager.hideReminderBanner();
        });
    }
    
    // 位置过滤
    const locationFilter = document.getElementById('locationFilter');
    if (locationFilter) {
        locationFilter.addEventListener('change', () => {
            const filter = locationFilter.value;
            const search = document.getElementById('searchInput').value;
            FoodManager.loadFoods(filter, search);
        });
    }
    
    // 搜索输入（防抖）
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // 确保 debounce 函数存在 (在 utils.js 中)
        if (typeof debounce === 'function') {
            const debouncedSearch = debounce(() => {
                const filter = locationFilter.value;
                const search = searchInput.value;
                FoodManager.loadFoods(filter, search);
            }, 300);
            searchInput.addEventListener('input', debouncedSearch);
        } else {
            // 如果 debounce 不可用，直接绑定
             searchInput.addEventListener('input', () => {
                const filter = locationFilter.value;
                const search = searchInput.value;
                FoodManager.loadFoods(filter, search);
             });
        }
    }
    
    // 点击模态框外部关闭
    const settingsPanel = document.getElementById('settingsPanel');
    const manualAddModal = document.getElementById('manualAddModal');
    
    if (settingsPanel) {
        settingsPanel.addEventListener('click', (e) => {
            if (e.target === settingsPanel) {
                hideSettingsPanel();
            }
        });
    }
    
    if (manualAddModal) {
        manualAddModal.addEventListener('click', (e) => {
            if (e.target === manualAddModal) {
                hideManualAddModal();
            }
        });
    }
}

/**
 * 显示设置面板
 */
function showSettingsPanel() {
    const panel = document.getElementById('settingsPanel');
    if (!panel) return;
    
    // 尝试加载现有配置
    if (typeof ApiConfig !== 'undefined') {
        ApiConfig.getConfig().then(config => {
            if (config) {
                document.getElementById('apiUrl').value = config.api_url || '';
                document.getElementById('apiKey').value = config.api_key || '';
                document.getElementById('modelName').value = config.model_name || '';
            }
        });
    }
    
    panel.style.display = 'flex';
}

/**
 * 隐藏设置面板
 */
function hideSettingsPanel() {
    const panel = document.getElementById('settingsPanel');
    if (panel) {
        panel.style.display = 'none';
    }
}

/**
 * 处理设置表单提交
 */
async function handleSettingsSubmit() {
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const modelName = document.getElementById('modelName').value.trim();
    
    if (!apiUrl || !apiKey || !modelName) {
        showMessage('请填写所有必填字段', 'warning');
        return;
    }
    
    showLoading();
    
    try {
        await ApiConfig.saveConfig(apiUrl, apiKey, modelName);
        showMessage('配置保存成功', 'success');
        hideSettingsPanel();
        
        // 启用聊天功能
        if (typeof ChatManager !== 'undefined') {
            ChatManager.setEnabled(true);
        }
    } catch (error) {
        showMessage('保存配置失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * 显示手动添加模态框
 */
function showManualAddModal() {
    const modal = document.getElementById('manualAddModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // 重置表单
        const form = document.getElementById('manualAddForm');
        if (form) {
            form.reset();
            const storageDateInput = document.getElementById('storageDate');
            if (storageDateInput) {
                storageDateInput.value = getDateInputValue(new Date());
            }
        }
        
        // 确保表单标题正确
        const formTitle = modal.querySelector('.modal-header h2');
        if (formTitle) {
            formTitle.textContent = '➕ 手动添加食物';
        }
    }
}

/**
 * 隐藏手动添加模态框
 */
function hideManualAddModal() {
    const modal = document.getElementById('manualAddModal');
    if (modal) {
        modal.style.display = 'none';
        
        // 清除编辑标志
        delete modal.dataset.editingFoodId;
        
        // 重置表单
        const form = document.getElementById('manualAddForm');
        if (form) {
            form.reset();
        }
        
        // 恢复表单标题
        const formTitle = modal.querySelector('.modal-header h2');
        if (formTitle) {
            formTitle.textContent = '➕ 手动添加食物';
        }
        
        // 重置日期为今天
        const storageDateInput = document.getElementById('storageDate');
        if (storageDateInput) {
            storageDateInput.value = getDateInputValue(new Date());
        }
    }
}

/**
 * 处理手动添加表单提交
 */
async function handleManualAddSubmit() {
    const formData = {
        foodName: document.getElementById('foodName').value.trim(),
        location: document.getElementById('foodLocation').value,
        storageDate: document.getElementById('storageDate').value,
        expirationDate: document.getElementById('expirationDate').value || null,
        quantity: parseInt(document.getElementById('quantity').value) || 1,
        notes: document.getElementById('notes').value.trim() || null
    };
    
    if (!formData.foodName || !formData.location || !formData.storageDate) {
        showMessage('请填写必填字段', 'warning');
        return;
    }
    
    showLoading();
    
    try {
        await FoodManager.addFood(formData);
        hideManualAddModal();
    } catch (error) {
        // 错误已在addFood中处理
    } finally {
        hideLoading();
    }
}


