// 食物管理模块

const FoodManager = {
    foods: [],
    
    /**
     * 初始化食物管理器
     */
    async init() {
        await this.loadFoods();
        this.setupRealtimeSubscription();
    },
    
    /**
     * 加载食物列表
     * @param {string} locationFilter - 位置过滤
     * @param {string} searchQuery - 搜索关键词
     */
    async loadFoods(locationFilter = '', searchQuery = '') {
        try {
            // 尝试从Supabase加载
            if (window.supabaseClient) {
                try {
                    const { data: { user } } = await window.supabaseClient.auth.getUser();
                    if (user) {
                        let query = window.supabaseClient
                            .from('food_items')
                            .select('*')
                            .eq('user_id', user.id)
                            .eq('is_consumed', false)
                            .order('storage_date', { ascending: false });
                        
                        if (locationFilter) {
                            query = query.eq('location', locationFilter);
                        }
                        
                        if (searchQuery) {
                            query = query.ilike('food_name', `%${searchQuery}%`);
                        }
                        
                        const { data, error } = await query;
                        
                        if (!error && data) {
                            this.foods = data;
                            this.renderFoodList();
                            // 同步到localStorage作为备份
                            localStorage.setItem('food_items', JSON.stringify(data));
                            return;
                        }
                    }
                } catch (error) {
                    console.warn('从Supabase加载失败，使用本地存储:', error);
                }
            }
            
            // 使用localStorage作为后备
            const localData = localStorage.getItem('food_items');
            if (localData) {
                let foods = JSON.parse(localData);
                
                // 应用过滤
                if (locationFilter) {
                    foods = foods.filter(f => f.location === locationFilter);
                }
                if (searchQuery) {
                    foods = foods.filter(f => 
                        f.food_name.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                }
                
                this.foods = foods.filter(f => !f.is_consumed);
                this.renderFoodList();
            } else {
                this.foods = [];
                this.renderFoodList();
            }
        } catch (error) {
            console.error('加载食物列表失败:', error);
            showMessage('加载食物列表失败', 'error');
        }
    },
    
    /**
     * 添加食物
     * @param {Object} foodData - 食物数据
     */
    async addFood(foodData) {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase客户端未初始化');
            }
            
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) {
                throw new Error('用户未登录');
            }
            
            const { data, error } = await window.supabaseClient
                .from('food_items')
                .insert({
                    user_id: user.id,
                    food_name: foodData.foodName,
                    location: foodData.location,
                    storage_date: foodData.storageDate,
                    expiration_date: foodData.expirationDate || null,
                    quantity: foodData.quantity || 1,
                    notes: foodData.notes || null
                })
                .select()
                .single();
            
            if (error) throw error;
            
            await this.loadFoods();
            showMessage('食物添加成功', 'success');
            return data;
        } catch (error) {
            console.error('添加食物失败:', error);
            showMessage('添加食物失败: ' + error.message, 'error');
            throw error;
        }
    },
    
    /**
     * 更新食物
     * @param {string} foodId - 食物ID
     * @param {Object} foodData - 更新的食物数据
     */
    async updateFood(foodId, foodData) {
        try {
            // 尝试更新Supabase
            if (window.supabaseClient) {
                try {
                    const { data: { user } } = await window.supabaseClient.auth.getUser();
                    if (user) {
                        const { data, error } = await window.supabaseClient
                            .from('food_items')
                            .update({
                                food_name: foodData.foodName,
                                location: foodData.location,
                                storage_date: foodData.storageDate,
                                expiration_date: foodData.expirationDate || null,
                                quantity: foodData.quantity || 1,
                                notes: foodData.notes || null,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', foodId)
                            .select()
                            .single();
                        
                        if (!error && data) {
                            await this.loadFoods();
                            showMessage('食物更新成功', 'success');
                            return data;
                        }
                    }
                } catch (error) {
                    console.warn('更新Supabase失败，使用本地存储:', error);
                }
            }
            
            // 使用localStorage作为后备
            const localData = localStorage.getItem('food_items');
            if (localData) {
                const foods = JSON.parse(localData);
                const index = foods.findIndex(f => f.id === foodId);
                if (index !== -1) {
                    foods[index] = {
                        ...foods[index],
                        food_name: foodData.foodName,
                        location: foodData.location,
                        storage_date: foodData.storageDate,
                        expiration_date: foodData.expirationDate || null,
                        quantity: foodData.quantity || 1,
                        notes: foodData.notes || null,
                        updated_at: new Date().toISOString()
                    };
                    localStorage.setItem('food_items', JSON.stringify(foods));
                    await this.loadFoods();
                    showMessage('食物更新成功', 'success');
                    return foods[index];
                }
            }
            
            throw new Error('找不到要更新的食物');
        } catch (error) {
            console.error('更新食物失败:', error);
            showMessage('更新食物失败: ' + error.message, 'error');
            throw error;
        }
    },
    
    /**
     * 标记食物为已消耗
     * @param {string} foodId - 食物ID
     */
    async consumeFood(foodId) {
        try {
            // 尝试更新Supabase
            if (window.supabaseClient) {
                try {
                    const { data: { user } } = await window.supabaseClient.auth.getUser();
                    if (user) {
                        const { data, error } = await window.supabaseClient
                            .from('food_items')
                            .update({
                                is_consumed: true,
                                consumed_date: new Date().toISOString().split('T')[0],
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', foodId)
                            .select()
                            .single();
                        
                        if (!error && data) {
                            await this.loadFoods();
                            showMessage('已标记为已消耗', 'success');
                            return data;
                        }
                    }
                } catch (error) {
                    console.warn('更新Supabase失败，使用本地存储:', error);
                }
            }
            
            // 使用localStorage作为后备
            const localData = localStorage.getItem('food_items');
            if (localData) {
                const foods = JSON.parse(localData);
                const index = foods.findIndex(f => f.id === foodId);
                if (index !== -1) {
                    foods[index].is_consumed = true;
                    foods[index].consumed_date = new Date().toISOString().split('T')[0];
                    foods[index].updated_at = new Date().toISOString();
                    localStorage.setItem('food_items', JSON.stringify(foods));
                    await this.loadFoods();
                    showMessage('已标记为已消耗', 'success');
                    return foods[index];
                }
            }
            
            throw new Error('找不到要更新的食物');
        } catch (error) {
            console.error('标记食物失败:', error);
            showMessage('操作失败: ' + error.message, 'error');
            throw error;
        }
    },
    
    /**
     * 删除食物
     * @param {string} foodId - 食物ID
     */
    async deleteFood(foodId) {
        if (!confirm('确定要删除这个食物吗？')) {
            return;
        }
        
        try {
            // 尝试从Supabase删除
            if (window.supabaseClient) {
                try {
                    const { data: { user } } = await window.supabaseClient.auth.getUser();
                    if (user) {
                        const { error } = await window.supabaseClient
                            .from('food_items')
                            .delete()
                            .eq('id', foodId);
                        
                        if (!error) {
                            await this.loadFoods();
                            showMessage('食物已删除', 'success');
                            return;
                        }
                    }
                } catch (error) {
                    console.warn('从Supabase删除失败，使用本地存储:', error);
                }
            }
            
            // 使用localStorage作为后备
            const localData = localStorage.getItem('food_items');
            if (localData) {
                const foods = JSON.parse(localData);
                const filtered = foods.filter(f => f.id !== foodId);
                localStorage.setItem('food_items', JSON.stringify(filtered));
                await this.loadFoods();
                showMessage('食物已删除', 'success');
            }
        } catch (error) {
            console.error('删除食物失败:', error);
            showMessage('删除失败: ' + error.message, 'error');
        }
    },
    
    /**
     * 渲染食物列表
     */
    renderFoodList() {
        const foodListEl = document.getElementById('foodList');
        if (!foodListEl) return;
        
        if (this.foods.length === 0) {
            foodListEl.innerHTML = `
                <div class="empty-state">
                    <p>📭 冰箱是空的</p>
                    <p>通过AI助手或手动添加来记录食物吧！</p>
                </div>
            `;
            return;
        }
        
        foodListEl.innerHTML = this.foods.map(food => {
            const expirationStatus = getExpirationStatus(food.expiration_date);
            const statusClass = expirationStatus.status === 'expired' ? 'expired' : 
                               expirationStatus.status === 'expiring-soon' || expirationStatus.status === 'expiring-today' ? 'expiring-soon' : '';
            
            return `
                <div class="food-item ${statusClass}" data-id="${food.id}">
                    <div class="food-item-header">
                        <div class="food-item-name">${escapeHtml(food.food_name)}</div>
                        <div class="food-item-actions">
                            <button class="btn btn-small btn-secondary" onclick="FoodManager.editFood('${food.id}')">✏️ 编辑</button>
                            <button class="btn btn-small btn-danger" onclick="FoodManager.consumeFood('${food.id}')">✓ 已消耗</button>
                        </div>
                    </div>
                    <div class="food-item-info">
                        <div class="food-item-info-item">
                            <span>📍</span>
                            <span>${escapeHtml(food.location)}</span>
                        </div>
                        <div class="food-item-info-item">
                            <span>📅</span>
                            <span>储存: ${formatDate(food.storage_date)}</span>
                        </div>
                        <div class="food-item-info-item">
                            <span>🔢</span>
                            <span>数量: ${food.quantity || 1}</span>
                        </div>
                        ${food.expiration_date ? `
                        <div class="food-item-info-item">
                            <span>⏰</span>
                            <span>过期: ${formatDate(food.expiration_date)}</span>
                        </div>
                        ` : ''}
                    </div>
                    ${expirationStatus.label ? `
                    <div class="expiration-badge ${expirationStatus.status}">
                        ${escapeHtml(expirationStatus.label)}
                    </div>
                    ` : ''}
                    ${food.notes ? `
                    <div style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);">
                        ${escapeHtml(food.notes)}
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },
    
    /**
     * 编辑食物
     * @param {string} foodId - 食物ID
     */
    async editFood(foodId) {
        const food = this.foods.find(f => f.id === foodId);
        if (!food) return;
        
        // 存储编辑的foodId到数据属性
        const modal = document.getElementById('manualAddModal');
        if (modal) {
            modal.dataset.editingFoodId = foodId;
        }
        
        // 填充表单
        document.getElementById('foodName').value = food.food_name;
        document.getElementById('foodLocation').value = food.location;
        document.getElementById('storageDate').value = getDateInputValue(food.storage_date);
        document.getElementById('expirationDate').value = getDateInputValue(food.expiration_date);
        document.getElementById('quantity').value = food.quantity || 1;
        document.getElementById('notes').value = food.notes || '';
        
        // 显示模态框
        if (modal) {
            modal.style.display = 'flex';
        }
        
        // 修改表单标题
        const formTitle = modal?.querySelector('.modal-header h2');
        if (formTitle) {
            formTitle.textContent = '✏️ 编辑食物';
        }
    },
    
    /**
     * 设置实时订阅
     */
    setupRealtimeSubscription() {
        // 如果配置了Supabase且有用户，启用实时订阅
        if (!window.supabaseClient) return;
        
        try {
            window.supabaseClient.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                    window.supabaseClient
                        .channel('food_items_changes')
                        .on('postgres_changes', 
                            { event: '*', schema: 'public', table: 'food_items' },
                            () => {
                                // 重新加载食物列表
                                this.loadFoods();
                            }
                        )
                        .subscribe();
                }
            });
        } catch (error) {
            console.warn('实时订阅设置失败:', error);
        }
    }
};

/**
 * HTML转义函数
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.FoodManager = FoodManager;
}

