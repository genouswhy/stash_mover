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
    let selectedItems = []; // 存储多选的物品
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
            selectedItems = [];
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
            return "新版物品" + itemId;
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

            // 添加复选框
            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'item-checkbox';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    div.classList.add('selected');
                } else {
                    div.classList.remove('selected');
                }
                // 触发物品选择逻辑
                selectItem(div, listType);
            });
            checkboxContainer.appendChild(checkbox);
            div.appendChild(checkboxContainer);
            
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
        // 当点击的是复选框时，不需要处理
        if (event.target.type === 'checkbox') {
            const checkbox = event.target;
            const itemId = element.getAttribute('data-item-id');
            const id = element.getAttribute('data-id');
            const details = itemDetails[itemId] || {};
            const amount = parseInt(element.getAttribute('data-amount'), 10);
            
            if (checkbox.checked) {
                // 添加到选中列表
                const existingIndex = selectedItems.findIndex(item => item.id === id);
                if (existingIndex === -1) {
                    selectedItems.push({
                        id: id,
                        itemId: itemId,
                        name: getItemDisplayName(itemId, details),
                        amount: amount
                    });
                }
                element.classList.add('selected');
            } else {
                // 从选中列表中删除
                selectedItems = selectedItems.filter(item => item.id !== id);
                element.classList.remove('selected');
            }
            
            // 所有选中的物品必须来自同一个列表
            if (selectedItems.length > 0) {
                // 如果有选中的项目并且不是当前列表，取消选择
                if (selectedItemList && selectedItemList !== listType) {
                    // 清空之前列表的选择
                    document.querySelectorAll(`.item[data-list="${selectedItemList}"] input[type="checkbox"]`).forEach(cb => {
                        cb.checked = false;
                    });
                    document.querySelectorAll(`.item[data-list="${selectedItemList}"]`).forEach(el => {
                        el.classList.remove('selected');
                    });
                    selectedItems = selectedItems.filter(item => {
                        // 只保留当前列表的物品
                        const itemElement = document.querySelector(`.item[data-id="${item.id}"]`);
                        return itemElement && itemElement.getAttribute('data-list') === listType;
                    });
                }
                selectedItemList = listType;
            } else {
                selectedItemList = null;
            }
            
            updateSelectedItemsInfo();
            return;
        }
        
        // 如果点击的是物品行（不是复选框），切换复选框状态
        const checkbox = element.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            // 触发一个 change 事件
            const changeEvent = new Event('change');
            checkbox.dispatchEvent(changeEvent);
        }
    }
    
    // 更新选中物品信息显示
    function updateSelectedItemsInfo() {
        if (selectedItems.length === 0) {
            selectedItemInfo.textContent = '';
            transferBtn.disabled = true;
            return;
        }
        
        if (selectedItems.length === 1) {
            const item = selectedItems[0];
            selectedItemInfo.textContent = `已选择: ${item.name} (x${item.amount})`;
        } else {
            selectedItemInfo.textContent = `已选择: ${selectedItems.length} 个物品`;
        }
        
        transferBtn.disabled = false;
    }

    // 转移按钮点击事件
    transferBtn.addEventListener('click', () => {
        if (selectedItems.length === 0) return;

        if (selectedItems.length === 1) {
            // 单个物品转移
            const item = selectedItems[0];
            
            // 显示单个物品转移界面
            document.getElementById('single-item-transfer').style.display = 'block';
            document.getElementById('batch-items-transfer').style.display = 'none';
            
            modalItemName.textContent = item.name;
            modalItemAmount.textContent = item.amount;
            transferAmount.max = item.amount;
            transferAmount.value = 1; // 默认值改为1
        } else {
            // 多个物品转移
            // 隐藏单个物品界面，显示批量转移界面
            document.getElementById('single-item-transfer').style.display = 'none';
            document.getElementById('batch-items-transfer').style.display = 'block';
            
            const batchItemsList = document.getElementById('batch-items-list');
            batchItemsList.innerHTML = '';
            
            // 为每个选中的物品创建一个带数量输入框的行
            selectedItems.forEach(item => {
                const itemRow = document.createElement('div');
                itemRow.className = 'batch-item';
                itemRow.setAttribute('data-id', item.id);
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'batch-item-name';
                nameSpan.textContent = item.name;
                
                const amountContainer = document.createElement('div');
                amountContainer.className = 'batch-item-amount';
                
                const amountLabel = document.createElement('span');
                amountLabel.textContent = `数量(最大${item.amount}):`;
                
                const amountInput = document.createElement('input');
                amountInput.type = 'number';
                amountInput.min = '1';
                amountInput.max = item.amount;
                amountInput.value = 1; // 默认值改为1
                
                amountContainer.appendChild(amountLabel);
                amountContainer.appendChild(amountInput);
                
                itemRow.appendChild(nameSpan);
                itemRow.appendChild(amountContainer);
                
                batchItemsList.appendChild(itemRow);
            });
        }

        // 显示模态框
        transferModal.style.display = 'block';
    });
    
    // 确认转移
    confirmTransferBtn.addEventListener('click', async () => {
        if (selectedItems.length === 0) return;
        
        const transferBatch = async () => {
            let successCount = 0;
            let totalCount = selectedItems.length;
            
            // 创建加载指示器
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.textContent = `批量转移中... (0/${totalCount})`;
            document.body.appendChild(loadingIndicator);
            
            // 手动跟踪已经分配的槽位
            const assignedSlots = new Set();
            
            // 获取批量转移中每个物品的数量
            const batchItemsList = document.getElementById('batch-items-list');
            const batchItems = batchItemsList.querySelectorAll('.batch-item');
            
            for (let i = 0; i < batchItems.length; i++) {
                const batchItem = batchItems[i];
                const itemId = batchItem.getAttribute('data-id');
                const item = selectedItems.find(item => item.id === itemId);
                
                if (!item) continue;
                
                const amountInput = batchItem.querySelector('input[type="number"]');
                const amount = parseInt(amountInput.value, 10);
                
                if (isNaN(amount) || amount <= 0 || amount > item.amount) {
                    continue; // 跳过无效数量
                }
                
                // 循环调用接口，每次转移1个
                let itemSuccessCount = 0;
                for (let j = 0; j < amount; j++) {
                    // 获取下一个可用槽位，避开已分配的槽位
                    let nextSlot = null;
                    if (selectedItemList === 'stash') {
                        nextSlot = getNextAvailableSlot(assignedSlots);
                        if (nextSlot) {
                            assignedSlots.add(nextSlot);
                        }
                    }
                    
                    // 准备转移请求数据
                    const transferData = {
                        token,
                        id: item.id,
                        amount: 1, // 每次只转移1个
                        slot: nextSlot
                    };
                    
                    try {
                        const response = await fetch('/api/move_item', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(transferData)
                        });
                        
                        if (response.ok) {
                            itemSuccessCount++;
                        }
                        
                        // 更新进度
                        loadingIndicator.textContent = `批量转移中... 物品 ${i+1}/${totalCount}, 当前物品进度: ${j+1}/${amount}`;
                    } catch (error) {
                        console.error('Error transferring item:', error);
                    }
                }
                
                if (itemSuccessCount > 0) {
                    successCount++;
                }
            }
            
            // 完成后移除加载指示器
            loadingIndicator.remove();
            return successCount;
        };
        
        if (selectedItems.length === 1) {
            // 单个物品转移逻辑
            const item = selectedItems[0];
            const amount = parseInt(transferAmount.value, 10);
            if (isNaN(amount) || amount <= 0 || amount > item.amount) {
                alert('请输入有效的转移数量');
                return;
            }
            
            // 显示加载指示器
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.textContent = `物品转移中... (0/${amount})`;
            document.body.appendChild(loadingIndicator);
            
            let successCount = 0;
            // 手动跟踪已经分配的槽位
            const assignedSlots = new Set();
            
            // 循环调用接口，每次转移1个
            for (let i = 0; i < amount; i++) {
                // 获取下一个可用槽位，避开已分配的槽位
                let nextSlot = null;
                if (selectedItemList === 'stash') {
                    nextSlot = getNextAvailableSlot(assignedSlots);
                    if (nextSlot) {
                        assignedSlots.add(nextSlot);
                    }
                }
                
                // 准备转移请求数据
                const transferData = {
                    token,
                    id: item.id,
                    amount: 1, // 每次只转移1个
                    slot: nextSlot
                };
                
                try {
                    const response = await fetch('/api/move_item', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(transferData)
                    });
                    
                    if (response.ok) {
                        successCount++;
                        // 更新进度
                        loadingIndicator.textContent = `物品转移中... (${successCount}/${amount})`;
                    } else {
                        console.error('API返回错误:', response.status);
                        // 不中断循环，继续尝试下一个
                    }
                } catch (error) {
                    console.error('Error transferring item:', error);
                    // 不中断循环，继续尝试下一个
                }
            }
            
            // 移除加载指示器
            loadingIndicator.remove();
            
            // 关闭模态框
            transferModal.style.display = 'none';
            
            // 重新加载物品列表
            await reloadItems();
            
            // 清空选择
            clearSelections();
            
            if (successCount === 0) {
                alert('物品转移失败，请重试');
            } else if (successCount < amount) {
                alert(`部分转移成功：${successCount}/${amount}，请重试剩余数量`);
            } else {
                alert('物品转移成功');
            }
        } else {
            // 批量转移逻辑
            transferModal.style.display = 'none';
            
            const successCount = await transferBatch();
            
            if (successCount > 0) {
                // 重新加载物品列表
                await reloadItems();
                alert(`成功转移 ${successCount}/${selectedItems.length} 个物品`);
            } else {
                alert('批量转移失败，请重试');
            }
            
            // 清空选择
            clearSelections();
        }
    });
    
    // 清空所有选择
    function clearSelections() {
        // 取消所有复选框的选中状态
        document.querySelectorAll('.item input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        
        // 移除所有选中样式
        document.querySelectorAll('.item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        selectedItems = [];
        selectedItemList = null;
        selectedItemInfo.textContent = '';
        transferBtn.disabled = true;
    }

    // 获取下一个可用的背包槽位
    function getNextAvailableSlot(additionalUsedSlots = new Set()) {
        const usedSlots = new Set();
        allItems.inventory.forEach(item => {
            if (item.slot) {
                usedSlots.add(item.slot);
            }
        });
        
        // 添加已手动分配的槽位
        additionalUsedSlots.forEach(slot => {
            usedSlots.add(slot);
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