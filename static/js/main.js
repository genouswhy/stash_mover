document.addEventListener('DOMContentLoaded', () => {
    // DOM元素
    const tokenInput = document.getElementById('token-input');
    const loadBtn = document.getElementById('load-btn');
    const transferBtn = document.getElementById('transfer-btn');
    const stashList = document.getElementById('stash-list');
    const inventoryList = document.getElementById('inventory-list');
    const stashSearch = document.getElementById('stash-search');
    const inventorySearch = document.getElementById('inventory-search');
    const selectedItemInfo = document.getElementById('selected-item-info');
    const transferModal = document.getElementById('transfer-modal');
    const modalItemName = document.getElementById('modal-item-name').querySelector('span');
    const modalItemAmount = document.getElementById('modal-item-amount').querySelector('span');
    const transferAmount = document.getElementById('transfer-amount');
    const confirmTransferBtn = document.getElementById('confirm-transfer-btn');
    const cancelTransferBtn = document.getElementById('cancel-transfer-btn');

    // 状态变量
    let allItems = { inventory: [], stash: [] };
    let itemDetails = {}; // 存储物品详细信息
    let selectedItem = null;
    let selectedItemList = null; // 'stash' 或 'inventory'
    let token = localStorage.getItem('auth_token') || '';
    let filterMode = 'all'; // 筛选模式：'all'、'new'
    
    // 初始化本地缓存
    const localCache = JSON.parse(localStorage.getItem('item_details_cache') || '{}');
    itemDetails = localCache;

    // 初始化
    if (token) {
        tokenInput.value = token;
    }
    
    // 添加筛选控件
    const addFilterControls = () => {
        // 检查是否已添加筛选控件
        if (document.getElementById('filter-controls')) return;
        
        const filterControls = document.createElement('div');
        filterControls.id = 'filter-controls';
        filterControls.className = 'filter-controls';
        
        const filterLabel = document.createElement('span');
        filterLabel.textContent = '物品筛选: ';
        filterControls.appendChild(filterLabel);
        
        const allFilter = document.createElement('button');
        allFilter.id = 'filter-all';
        allFilter.className = 'filter-btn active';
        allFilter.textContent = '全部物品';
        allFilter.addEventListener('click', () => {
            filterMode = 'all';
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            allFilter.classList.add('active');
            renderItemLists();
        });
        filterControls.appendChild(allFilter);
        
        const newFilter = document.createElement('button');
        newFilter.id = 'filter-new';
        newFilter.className = 'filter-btn';
        newFilter.textContent = '新版物品';
        newFilter.addEventListener('click', () => {
            filterMode = 'new';
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            newFilter.classList.add('active');
            renderItemLists();
        });
        filterControls.appendChild(newFilter);
        
        // 将筛选控件添加到页面
        const mainElement = document.querySelector('main');
        mainElement.insertBefore(filterControls, mainElement.firstChild);
    };

    // 加载物品列表
    loadBtn.addEventListener('click', async () => {
        token = tokenInput.value.trim();
        if (!token) {
            alert('请输入授权令牌');
            return;
        }

        // 保存令牌到本地存储
        localStorage.setItem('auth_token', token);

        // 显示加载中状态
        stashList.innerHTML = '<div class="loading-message">加载中...</div>';
        inventoryList.innerHTML = '<div class="loading-message">加载中...</div>';

        try {
            const response = await fetch('/api/get_items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                throw new Error('请求失败');
            }

            const data = await response.json();
            allItems = data;

            // 添加筛选控件
            addFilterControls();
            
            // 先用已有缓存数据渲染列表
            renderItemLists();
            
            // 异步获取物品详细信息
            fetchItemDetailsAsync();
            
            transferBtn.disabled = true;
            selectedItem = null;
            selectedItemInfo.textContent = '';
        } catch (error) {
            console.error('Error loading items:', error);
            stashList.innerHTML = '<div class="loading-message">加载失败，请重试</div>';
            inventoryList.innerHTML = '<div class="loading-message">加载失败，请重试</div>';
        }
    });

    // 搜索功能
    stashSearch.addEventListener('input', filterStashItems);
    inventorySearch.addEventListener('input', filterInventoryItems);

    // 异步获取物品详细信息
    function fetchItemDetailsAsync() {
        const allItemIds = new Set();
        
        // 收集所有物品ID
        allItems.inventory.forEach(item => allItemIds.add(item.itemId));
        allItems.stash.forEach(item => allItemIds.add(item.itemId));
        
        // 筛选出未缓存的物品ID
        const uncachedItemIds = [...allItemIds].filter(itemId => !itemDetails[itemId]);
        
        // 如果所有物品都已缓存，无需获取
        if (uncachedItemIds.length === 0) return;
        
        // 显示加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.textContent = `加载物品信息...`;
        document.body.appendChild(loadingIndicator);
        
        let loadedCount = 0;
        const totalCount = uncachedItemIds.length;
        
        // 并发获取物品详情
        uncachedItemIds.forEach(itemId => {
            fetch(`/api/get_item_details/${itemId}`)
                .then(response => {
                    if (response.ok) return response.json();
                    throw new Error(`获取物品 ${itemId} 详情失败`);
                })
                .then(data => {
                    // 更新内存中的详情
                    itemDetails[itemId] = data;
                    
                    // 更新加载计数
                    loadedCount++;
                    loadingIndicator.textContent = `加载物品信息... (${loadedCount}/${totalCount})`;
                    
                    // 更新本地缓存
                    localStorage.setItem('item_details_cache', JSON.stringify(itemDetails));
                    
                    // 更新物品显示
                    updateItemInLists(itemId);
                    
                    // 所有物品都加载完成后，移除加载指示器
                    if (loadedCount === totalCount) {
                        loadingIndicator.remove();
                    }
                })
                .catch(error => {
                    console.error(`Error fetching details for item ${itemId}:`, error);
                    loadedCount++;
                    if (loadedCount === totalCount) {
                        loadingIndicator.remove();
                    }
                });
        });
    }
    
    // 检查是否是新版物品
    function isNewItem(itemId) {
        return String(itemId).startsWith('210302');
    }
    
    // 获取物品显示名称
    function getItemDisplayName(itemId, details) {
        if (isNewItem(itemId) && (!details || !details.name)) {
            return "新版物品";
        }
        return details && details.name ? details.name : itemId;
    }
    
    // 更新单个物品在列表中的显示
    function updateItemInLists(itemId) {
        // 更新仓库列表
        updateItemInList(stashList, itemId);
        // 更新背包列表
        updateItemInList(inventoryList, itemId);
    }
    
    function updateItemInList(container, itemId) {
        const itemElements = container.querySelectorAll(`.item[data-item-id="${itemId}"]`);
        if (!itemElements.length) return;
        
        const details = itemDetails[itemId];
        
        itemElements.forEach(element => {
            // 更新名称
            const nameSpan = element.querySelector('.item-name');
            if (nameSpan) nameSpan.textContent = getItemDisplayName(itemId, details);
            
            // 如果已有图片则不更新图片
            if (element.querySelector('.item-image img')) return;
            
            // 添加图片
            if (details && details.image) {
                const infoContainer = element.querySelector('.item-info');
                
                const imgContainer = document.createElement('div');
                imgContainer.className = 'item-image';
                const img = document.createElement('img');
                img.src = details.image;
                img.alt = getItemDisplayName(itemId, details);
                imgContainer.appendChild(img);
                
                element.insertBefore(imgContainer, infoContainer);
            }
        });
    }

    // 渲染物品列表函数
    function renderItemLists() {
        let stashItems = allItems.stash;
        let inventoryItems = allItems.inventory;
        
        // 如果是新版物品筛选模式，只显示新版物品
        if (filterMode === 'new') {
            stashItems = stashItems.filter(item => isNewItem(item.itemId));
            inventoryItems = inventoryItems.filter(item => isNewItem(item.itemId));
        }
        
        // 应用搜索筛选
        const stashSearchTerm = stashSearch.value.trim();
        const inventorySearchTerm = inventorySearch.value.trim();
        
        if (stashSearchTerm) {
            stashItems = filterItemsByTerm(stashItems, stashSearchTerm);
        }
        
        if (inventorySearchTerm) {
            inventoryItems = filterItemsByTerm(inventoryItems, inventorySearchTerm);
        }
        
        renderList(stashList, stashItems, 'stash');
        renderList(inventoryList, inventoryItems, 'inventory');
    }
    
    function filterItemsByTerm(items, searchTerm) {
        return items.filter(item => {
            const itemId = item.itemId.toString();
            const details = itemDetails[itemId] || {};
            const itemName = getItemDisplayName(itemId, details).toLowerCase();
            
            return itemId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   itemName.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }

    function renderList(container, items, listType) {
        if (!items || items.length === 0) {
            container.innerHTML = `<div class="loading-message">没有物品</div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const itemId = item.itemId;
            const details = itemDetails[itemId] || {};
            
            const div = document.createElement('div');
            div.className = 'item';
            if (isNewItem(itemId)) {
                div.classList.add('new-item');
            }
            div.setAttribute('data-id', item.id);
            div.setAttribute('data-list', listType);
            div.setAttribute('data-item-id', itemId);
            div.setAttribute('data-amount', item.amount);

            // 创建物品信息容器
            const infoContainer = document.createElement('div');
            infoContainer.className = 'item-info';

            // 创建物品名称
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            nameSpan.textContent = getItemDisplayName(itemId, details);
            infoContainer.appendChild(nameSpan);

            // 创建物品数量
            const amountSpan = document.createElement('span');
            amountSpan.className = 'item-amount';
            amountSpan.textContent = `x${item.amount}`;
            infoContainer.appendChild(amountSpan);
            
            // 创建物品图片 (如果有)
            if (details.image) {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'item-image';
                const img = document.createElement('img');
                img.src = details.image;
                img.alt = getItemDisplayName(itemId, details);
                imgContainer.appendChild(img);
                div.appendChild(imgContainer);
            }

            div.appendChild(infoContainer);
            div.addEventListener('click', () => selectItem(div, listType));

            fragment.appendChild(div);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    // 搜索过滤器
    function filterStashItems() {
        renderItemLists();
    }

    function filterInventoryItems() {
        renderItemLists();
    }

    // 选择物品
    function selectItem(element, listType) {
        // 移除之前选中项的高亮
        document.querySelectorAll('.item.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // 高亮当前选中项
        element.classList.add('selected');

        // 保存选中的物品信息
        const itemId = element.getAttribute('data-item-id');
        const details = itemDetails[itemId] || {};
        
        selectedItem = {
            id: element.getAttribute('data-id'),
            itemId: itemId,
            name: getItemDisplayName(itemId, details),
            amount: parseInt(element.getAttribute('data-amount'), 10)
        };
        selectedItemList = listType;

        // 显示选中物品信息
        selectedItemInfo.textContent = `已选择: ${selectedItem.name} (x${selectedItem.amount})`;
        transferBtn.disabled = false;
    }

    // 转移按钮点击事件
    transferBtn.addEventListener('click', () => {
        if (!selectedItem) return;

        // 设置模态框内容
        modalItemName.textContent = selectedItem.name;
        modalItemAmount.textContent = selectedItem.amount;
        transferAmount.max = selectedItem.amount;
        transferAmount.value = 1;

        // 显示模态框
        transferModal.style.display = 'block';
    });

    // 确认转移
    confirmTransferBtn.addEventListener('click', async () => {
        const amount = parseInt(transferAmount.value, 10);
        if (isNaN(amount) || amount <= 0 || amount > selectedItem.amount) {
            alert('请输入有效的转移数量');
            return;
        }

        // 准备转移请求数据
        const transferData = {
            token,
            id: selectedItem.id,
            amount,
            slot: selectedItemList === 'stash' ? getNextAvailableSlot() : null
        };

        try {
            const response = await fetch('/api/move_item', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transferData)
            });

            if (!response.ok) {
                throw new Error('转移失败');
            }

            // 关闭模态框
            transferModal.style.display = 'none';

            // 重新加载物品列表
            await reloadItems();
            
            selectedItem = null;
            selectedItemList = null;
            selectedItemInfo.textContent = '';
            transferBtn.disabled = true;
            
        } catch (error) {
            console.error('Error transferring item:', error);
            alert('转移失败，请重试');
        }
    });

    // 获取下一个可用的背包槽位
    function getNextAvailableSlot() {
        const usedSlots = new Set();
        allItems.inventory.forEach(item => {
            if (item.slot) {
                usedSlots.add(item.slot);
            }
        });

        // 寻找10-20范围内的可用槽位
        for (let i = 10; i <= 20; i++) {
            if (!usedSlots.has(i.toString())) {
                return i.toString();
            }
        }

        // 如果没有可用槽位，返回null
        return null;
    }

    // 取消转移
    cancelTransferBtn.addEventListener('click', () => {
        transferModal.style.display = 'none';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (event) => {
        if (event.target === transferModal) {
            transferModal.style.display = 'none';
        }
    });

    // 重新加载物品列表
    async function reloadItems() {
        try {
            const response = await fetch('/api/get_items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                throw new Error('请求失败');
            }

            const data = await response.json();
            allItems = data;

            // 先用已有缓存数据渲染列表
            renderItemLists();
            
            // 异步获取物品详细信息
            fetchItemDetailsAsync();
        } catch (error) {
            console.error('Error reloading items:', error);
            alert('重新加载失败，请刷新页面重试');
        }
    }
}); 