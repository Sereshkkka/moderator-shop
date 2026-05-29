function renderProfile(container) {
    let personalLogs = db.data.logs.filter(l => l.userId === currentUser.id && l.companyId === currentCompanyId);
    personalLogs = personalLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    let rowsHtml = personalLogs.map(l => {
        const execUser = db.data.users.find(u => u.id === l.modifierId);
        const executor = execUser ? execUser.username : 'Система';
        const diff = (l.newBalance || 0) - (l.oldBalance || 0);
        const diffStr = (diff > 0 ? '+' : '') + diff;
        const color = diff >= 0 ? '#10b981' : '#ef4444';
        const detailText = l.reason || '';

        return [
            '<tr>',
                '<td>' + new Date(l.date).toLocaleDateString() + '</td>',
                '<td>' + escapeHTML(executor) + '</td>',
                '<td style="color:' + color + '; font-weight:bold">' + diffStr + '</td>',
                '<td>' + escapeHTML(detailText) + '</td>',
            '</tr>'
        ].join('');
    }).join('');

    if (personalLogs.length === 0) {
        rowsHtml = '<tr><td colspan="4">У вас пока нет транзакций на этом сервере.</td></tr>';
    }

    const eUsername = escapeHTML(currentUser.username);
    const currentRoleId = getCurrentUserRoleId();
    const currentRoleLabel = escapeHTML(getRoleLabel(currentRoleId));
    const reprimandCount = getUserReprimandCount(currentUser, currentCompanyId);
    const discordValue = escapeHTML(currentUser.discordId || '');
    const discordLinked = !!currentUser.discordId;
    const discordDisplayName = escapeHTML(currentUser.discordUsername || '');
    const discordAvatarUrl = escapeHTML(currentUser.discordAvatarUrl || '');
    const discordControlsHtml = discordLinked
        ? [
            '<div style="display:flex; align-items:center; gap:0.85rem; margin-bottom:1rem;">',
                (discordAvatarUrl
                    ? '<img src="' + discordAvatarUrl + '" alt="Аватар Discord" style="width:42px; height:42px; border-radius:50%; object-fit:cover; border:1px solid rgba(255,255,255,0.12);">'
                    : '<div style="width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(88,101,242,0.15); color:#c7d2fe; font-weight:700;">D</div>'),
                '<div style="min-width:0; flex:1;">',
                    '<div style="font-weight:700; line-height:1.2;">' + (discordDisplayName || 'Discord привязан') + '</div>',
                    '<div class="text-muted" style="font-size:0.85rem; margin-top:0.2rem;">ID: ' + discordValue + '</div>',
                '</div>',
            '</div>',
            '<button class="btn btn-outline" style="width:100%;" onclick="clearDiscordLink()">Отвязать</button>'
        ].join('')
        : [
            '<div class="action-row">',
                (isDiscordOAuthConfigured()
                    ? '<button class="btn btn-primary" style="width:auto;" onclick="startDiscordProfileLink()">Привязать через Discord</button>'
                    : '<span class="text-muted" style="font-size:0.9rem;">Discord OAuth пока не настроен.</span>'),
            '</div>'
        ].join('');
    container.innerHTML = [
        '<div class="profile-layout">',
            '<div class="profile-left-column">',
                '<div class="profile-card profile-card-vertical">',
            '<img src="' + getUserAvatarUrl(currentUser.username, 96) + '" class="avatar-large" style="object-fit:cover; image-rendering:pixelated; background:transparent;">',
                    '<div class="profile-identity">',
                        '<h3 class="profile-username">' + eUsername + '</h3>',
                        '<div class="profile-role-badge">' + getBadge(currentRoleId) + '</div>',
                    '</div>',
                    '<div class="profile-stat-stack">',
                        '<div class="profile-stat-row"><span>Должность</span><strong>' + currentRoleLabel + '</strong></div>',
                        '<div class="profile-stat-row"><span>Выговоры</span><strong>' + reprimandCount + '</strong></div>',
                        '<div class="profile-stat-row profile-stat-balance"><span>Баланс</span><strong>' + currentUser.coins + ' монет</strong></div>',
                    '</div>',
                    '<button class="btn btn-outline profile-password-btn" onclick="openPasswordChangeModal()">Сменить пароль</button>',
                '</div>',
                '<div class="glass-panel profile-side-panel' + (discordLinked ? ' profile-side-panel-linked' : '') + '">',
                    '<h4 style="margin-bottom:1rem;">' + (discordLinked ? 'Привязанный Discord' : 'Привязка Discord') + '</h4>',
                    discordControlsHtml,
                '</div>',
            '</div>',
            '<div class="profile-transactions-panel">',
                '<h4 class="profile-transactions-title">Транзакции пользователя</h4>',
                '<div class="table-container" style="margin-top:0;">',
                    '<table>',
                        '<thead>',
                            '<tr>',
                                '<th>Дата</th>',
                                '<th>Исполнитель</th>',
                                '<th>Изменение</th>',
                                '<th>Детали</th>',
                            '</tr>',
                        '</thead>',
                        '<tbody>',
                            rowsHtml,
                        '</tbody>',
                    '</table>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
}

function getStoreImageFallback() {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent([
        '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">',
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1e293b"/><stop offset="1" stop-color="#111827"/></linearGradient></defs>',
        '<rect width="640" height="360" fill="url(#g)"/>',
        '<circle cx="320" cy="150" r="46" fill="#334155"/>',
        '<path d="M190 274l92-96 54 58 38-42 76 80H190z" fill="#475569"/>',
        '<text x="320" y="322" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#94a3b8">No image</text>',
        '</svg>'
    ].join(''));
}

function getSafeStoreImageUrl(url) {
    return (url || '').trim() || getStoreImageFallback();
}

function buildStoreImageTag(src, alt, extraAttrs) {
    return '<img src="' + escapeHTML(getSafeStoreImageUrl(src)) + '" alt="' + escapeHTML(alt || '') + '" onerror="this.onerror=null;this.src=\'' + getStoreImageFallback() + '\';" ' + (extraAttrs || '') + '>';
}

function renderStore(container) {
    const remoteReadMode = isSupabaseSessionActive();
    const canManageStore = hasPermission('manage_store');
    const storeEditMode = canManageStore && sessionStorage.getItem('store_edit_mode') === '1';
    const scopedItems = db.data.items.filter(i => i.companyId === currentCompanyId);
    const storeNotice = remoteReadMode
        ? '<div class="glass-panel mb-4" style="max-width:100%; padding:1rem 1.25rem; border:1px solid rgba(59,130,246,0.28); background:rgba(59,130,246,0.10); color:#bfdbfe;"><strong>Supabase mixed-режим.</strong> Витрина читается из базы, редактор магазина и checkout уже идут через server-side RPC, а Discord webhook после покупки теперь отправляется через server-side relay.</div>'
        : '';

    let itemsHtml = scopedItems.map(item => [
        '<div class="store-item ' + (storeEditMode ? 'store-item-editing' : '') + '">',
            (storeEditMode
                ? '<button type="button" class="store-card-delete" onclick="event.stopPropagation(); confirmDeleteItem(\'' + item.id + '\')" title="Удалить товар" aria-label="Удалить товар">×</button>'
                : ''),
            '<div class="store-img">',
                buildStoreImageTag(item.image, item.name),
            '</div>',
            '<div class="store-content">',
                '<h4 style="font-size:1.1rem; margin-bottom:0.5rem;">' + escapeHTML(item.name) + '</h4>',
                '<div style="margin-bottom:0.75rem;">' + getItemTypeBadge(item.itemType || 'item') + '</div>',
                '<p style="color:var(--text-muted); font-size:0.875rem; margin-bottom:1rem;">' + escapeHTML(item.description) + '</p>',
                '<div class="store-price">' + getEffectiveItemPriceForUser(item, currentUser, currentCompanyId) + ' Монет</div>',
                (getUserReprimandCount(currentUser, currentCompanyId) > 0
                    ? '<div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:0.75rem;">Базовая цена: ' + item.price + ' + ' + (getUserReprimandCount(currentUser, currentCompanyId) * REPRIMAND_STORE_SURCHARGE) + ' за выговоры</div>'
                    : ''),
                (storeEditMode
                    ? '<button class="btn btn-primary" onclick="openStoreItemModal(\'edit\', \'' + item.id + '\')">Редактировать</button>'
                    : '<button class="btn btn-outline" onclick="addToCart(\'' + item.id + '\')">В Корзину</button>'),
            '</div>',
        '</div>'
    ].join('')).join('');

    if (storeEditMode) {
        itemsHtml += [
            '<button type="button" class="store-item store-add-card" onclick="openStoreItemModal(\'create\')">',
                '<span class="store-add-plus">+</span>',
                '<strong>Добавить товар</strong>',
                '<span>Создать новую позицию магазина</span>',
            '</button>'
        ].join('');
    }

    if (scopedItems.length === 0 && !storeEditMode) {
        itemsHtml = '<p>В магазине этого сервера пока нет товаров.</p>';
    }

    let editorToolbarHtml = '';
    if (canManageStore) {
        editorToolbarHtml = [
            '<div class="store-editor-toolbar mb-4">',
                '<button class="btn ' + (storeEditMode ? 'btn-success' : 'btn-primary') + '" style="width:auto" onclick="toggleStoreEditMode()">',
                    (storeEditMode ? 'Режим редактирования включен' : 'Режим редактирования'),
                '</button>',
            '</div>'
        ].join('');
    }

    container.innerHTML = [
        '<h3 class="mb-3">Магазин</h3>',
        storeNotice,
        editorToolbarHtml,
        '<div class="store-grid">',
            itemsHtml,
        '</div>'
    ].join('');

    window.addToCart = (itemId) => {
        if (getCurrentUserRoleId() === VACATION_ROLE_ID) {
            showToast('Пользователь в отпуске не может совершать покупки в магазине.', 'error');
            return;
        }
        const item = db.data.items.find(i => i.id === itemId && i.companyId === currentCompanyId);
        if (!item) {
            showToast('Предмет недоступен в текущей компании!', 'error');
            return;
        }

        let curUserDb = db.data.users.find(u => u.id === currentUser.id);
        if (!curUserDb.cart) curUserDb.cart = [];

        curUserDb.cart = curUserDb.cart.filter(c => {
            let chk = db.data.items.find(ix => ix.id === c.itemId);
            return chk && chk.companyId === currentCompanyId;
        });

        let existing = curUserDb.cart.find(c => c.itemId === itemId);
        if (existing) {
            existing.quantity++;
        } else {
            curUserDb.cart.push({ itemId: itemId, quantity: 1 });
        }
        db.save();

        currentUser.cart = curUserDb.cart;
        showToast(item.name + ' добавлен в корзину!');
        updateCartBadge();
    };

    if (canManageStore) {
        window.toggleStoreEditMode = () => {
            const nextValue = sessionStorage.getItem('store_edit_mode') === '1' ? '0' : '1';
            sessionStorage.setItem('store_edit_mode', nextValue);
            renderStore(document.getElementById('dashboardContent'));
        };

        window.openStoreItemModal = (mode, id) => {
            const isEdit = mode === 'edit';
            const item = isEdit ? db.data.items.find(i => i.id === id && i.companyId === currentCompanyId) : null;
            if (isEdit && !item) {
                showToast('Товар не найден в текущем сервере.', 'error');
                return;
            }
            const modalWrapper = ensureBalanceModalWrapper();
            modalWrapper.innerHTML = [
                '<div class="modal-overlay" id="store_item_overlay">',
                    '<div class="modal-content store-item-modal" onclick="event.stopPropagation()">',
                        '<h3>' + (isEdit ? 'Редактирование товара' : 'Новый товар') + '</h3>',
                        '<input type="hidden" id="store_item_id" value="' + (item ? item.id : '') + '">',
                        '<div class="form-group mt-4">',
                            '<label>Название</label>',
                            '<input type="text" id="store_item_name" class="form-control" value="' + escapeHTML(item ? item.name : '') + '">',
                        '</div>',
                        '<div class="form-group">',
                            '<label>Описание</label>',
                            '<input type="text" id="store_item_desc" class="form-control" value="' + escapeHTML(item ? item.description : '') + '">',
                        '</div>',
                        '<div class="form-group">',
                            '<label>Цена</label>',
                            '<input type="text" id="store_item_price" class="form-control" value="' + (item ? item.price : 0) + '" inputmode="numeric" autocomplete="off">',
                        '</div>',
                        '<div class="form-group">',
                            '<label>Тип позиции</label>',
                            '<select id="store_item_type" class="form-control">',
                                '<option value="item" ' + (!item || (item.itemType || 'item') === 'item' ? 'selected' : '') + '>Предмет</option>',
                                '<option value="donate" ' + (item && item.itemType === 'donate' ? 'selected' : '') + '>Донат</option>',
                            '</select>',
                        '</div>',
                        '<div class="form-group">',
                            '<label>URL картинки</label>',
                            '<input type="text" id="store_item_img" class="form-control" value="' + escapeHTML(item ? item.image : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80') + '">',
                            '<div class="store-image-preview-wrap">',
                                '<span>Предпросмотр</span>',
                                buildStoreImageTag(item ? item.image : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80', item ? item.name : 'Новый товар', 'id="store_item_img_preview" class="store-image-preview"'),
                            '</div>',
                        '</div>',
                        '<div class="action-row mt-4">',
                            '<button class="btn btn-primary" onclick="saveStoreItemFromModal()">' + (isEdit ? 'Сохранить' : 'Добавить товар') + '</button>',
                            '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                        '</div>',
                    '</div>',
                '</div>'
            ].join('');
            document.getElementById('store_item_overlay').onclick = closeBalanceModal;
            const imageInput = document.getElementById('store_item_img');
            const imagePreview = document.getElementById('store_item_img_preview');
            if (imageInput && imagePreview) {
                imageInput.oninput = () => {
                    imagePreview.onerror = () => {
                        imagePreview.onerror = null;
                        imagePreview.src = getStoreImageFallback();
                    };
                    imagePreview.src = getSafeStoreImageUrl(imageInput.value);
                };
            }
        };

        window.saveStoreItemFromModal = async () => {
            const editId = document.getElementById('store_item_id').value;
            const validatedPrice = getValidatedNonNegativePrice('store_item_price');
            if (validatedPrice === null) return;
            const itemPayload = {
                name: document.getElementById('store_item_name').value || 'Безымянный',
                description: document.getElementById('store_item_desc').value || 'Без описания',
                price: validatedPrice,
                itemType: document.getElementById('store_item_type').value || 'item',
                image: document.getElementById('store_item_img').value || ''
            };

            if (editId) {
                if (remoteReadMode) {
                    showToast('Редактирование товаров в Supabase RPC-режиме пока не подключено.', 'error');
                    return;
                }
                const item = db.data.items.find(i => i.id === editId && i.companyId === currentCompanyId);
                if (!item) {
                    showToast('Товар не найден в текущем сервере.', 'error');
                    return;
                }
                Object.assign(item, itemPayload);
                db.save();
                closeBalanceModal();
                showToast('Товар обновлен.');
                renderStore(document.getElementById('dashboardContent'));
                return;
            }

            if (remoteReadMode) {
                const authSession = authGateway.getStoredSession();
                if (!authSession || !authSession.access_token) {
                    showToast('Нет активной Supabase-сессии для создания товара.', 'error');
                    return;
                }
                try {
                    await authGateway.rpcCreateItem(authSession.access_token, {
                        target_company_id: currentCompanyId,
                        item_name: itemPayload.name,
                        item_description: itemPayload.description,
                        item_price: itemPayload.price,
                        item_type_value: itemPayload.itemType,
                        item_image: itemPayload.image
                    });
                    closeBalanceModal();
                    await syncStoreReadSnapshot();
                    showToast('Товар опубликован через безопасный server-side RPC.');
                    renderStore(document.getElementById('dashboardContent'));
                    return;
                } catch (error) {
                    showToast(error.message || 'Не удалось создать товар через RPC.', 'error');
                    return;
                }
            }

            db.data.items.push({
                id: db.generateId(),
                companyId: currentCompanyId,
                name: itemPayload.name,
                description: itemPayload.description,
                price: itemPayload.price,
                itemType: itemPayload.itemType,
                image: itemPayload.image
            });
            db.save();
            closeBalanceModal();
            showToast('Предмет загружен на витрину этой компании');
            renderStore(document.getElementById('dashboardContent'));
        };

        window.confirmDeleteItem = (id) => {
            const item = db.data.items.find(i => i.id === id && i.companyId === currentCompanyId);
            if (!item) {
                showToast('Товар не найден в текущем сервере.', 'error');
                return;
            }
            const modalWrapper = ensureBalanceModalWrapper();
            modalWrapper.innerHTML = [
                '<div class="modal-overlay" id="store_delete_overlay">',
                    '<div class="modal-content" onclick="event.stopPropagation()">',
                        '<h3 style="color:var(--danger)">Удалить товар?</h3>',
                        '<p class="mt-3">Вы точно хотите удалить <strong>' + escapeHTML(item.name) + '</strong> из магазина?</p>',
                        '<p class="text-muted mt-2" style="font-size:0.9rem;">Действие нельзя отменить.</p>',
                        '<div class="action-row mt-4">',
                            '<button class="btn btn-danger" onclick="deleteItem(\'' + item.id + '\')">Да, удалить</button>',
                            '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                        '</div>',
                    '</div>',
                '</div>'
            ].join('');
            document.getElementById('store_delete_overlay').onclick = closeBalanceModal;
        };

        window.deleteItem = async (id) => {
            if (remoteReadMode) {
                const authSession = authGateway.getStoredSession();
                if (!authSession || !authSession.access_token) {
                    showToast('Нет активной Supabase-сессии для удаления товара.', 'error');
                    return;
                }
                try {
                    await authGateway.rpcDeleteItem(authSession.access_token, {
                        target_item_id: id
                    });
                    closeBalanceModal();
                    await syncStoreReadSnapshot();
                    showToast('Товар удален через безопасный server-side RPC.');
                    renderStore(document.getElementById('dashboardContent'));
                    return;
                } catch (error) {
                    showToast(error.message || 'Не удалось удалить товар через RPC.', 'error');
                    return;
                }
            }
            const item = db.data.items.find(i => i.id === id && i.companyId === currentCompanyId);
            if (!item) {
                showToast('Товар не найден в текущем сервере.', 'error');
                return;
            }
            db.data.items = db.data.items.filter(i => i.id !== id);
            db.save();
            closeBalanceModal();
            showToast('Предмет убран');
            renderStore(document.getElementById('dashboardContent'));
        };
    }
}

function renderCart(container) {
    const remoteMode = isSupabaseSessionActive();

    if (currentUser.cart && currentUser.cart.length > 0) {
        currentUser.cart = currentUser.cart.filter(c => {
            let iRef = db.data.items.find(x => x.id === c.itemId);
            return iRef && iRef.companyId === currentCompanyId;
        });
    }

    let totalCost = 0;

    if (!currentUser.cart || currentUser.cart.length === 0) {
        container.innerHTML = '<h3 class="mb-3">Корзина</h3><p style="color:var(--text-muted);">Ваша корзина пуста или предметы относятся к другому серверу.</p>';
        return;
    }

    let itemsHtml = currentUser.cart.map(c => {
        const item = db.data.items.find(i => i.id === c.itemId);
        if (!item) return '';
        const effectivePrice = getEffectiveItemPriceForUser(item, currentUser, currentCompanyId);
        const subtotal = effectivePrice * c.quantity;
        totalCost += subtotal;

        return [
            '<div class="store-item" style="flex-direction:row; align-items:center; margin-bottom:1rem; padding:1rem; min-height:100px;">',
                buildStoreImageTag(item.image, item.name, 'style="width:80px;height:80px;object-fit:cover;border-radius:8px;margin-right:1rem;"'),
                '<div style="flex:1;">',
                    '<h4 style="margin-bottom:0.25rem;">' + escapeHTML(item.name) + '</h4>',
                    '<div style="color:var(--text-muted); font-size:0.875rem;">' + effectivePrice + ' Монет за шт.</div>',
                '</div>',
                '<div style="display:flex; align-items:center; gap:0.5rem; margin-right:2rem;">',
                    '<button class="btn btn-outline" style="padding:0.25rem 0.6rem; width:auto; border-radius:6px; font-weight:bold;" onclick="updateCartQty(\'' + c.itemId + '\', -1)">-</button>',
                    '<div style="font-weight:bold; font-size:1.1rem; width:30px; text-align:center;">' + c.quantity + '</div>',
                    '<button class="btn btn-outline" style="padding:0.25rem 0.6rem; width:auto; border-radius:6px; font-weight:bold;" onclick="updateCartQty(\'' + c.itemId + '\', 1)">+</button>',
                '</div>',
                '<div class="store-price" style="margin-bottom:0;">' + subtotal + ' Монет</div>',
                '<button class="btn btn-danger" style="margin-left:2rem; width:auto; padding:0.5rem 1rem;" onclick="removeFromCart(\'' + c.itemId + '\')">Удалить</button>',
            '</div>'
        ].join('');
    }).join('');

    container.innerHTML = [
        '<div class="flex-between mb-3">',
            '<h3>Корзина</h3>',
            '<div class="store-price" style="font-size:1.5rem;">Итого: ' + totalCost + ' Монет</div>',
        '</div>',
        (remoteMode
            ? '<div class="glass-panel mb-3" style="max-width:100%; padding:1rem 1.25rem; border:1px solid rgba(59,130,246,0.28); background:rgba(59,130,246,0.10); color:#bfdbfe;"><strong>Supabase checkout активен.</strong> Списание монет и лог покупки уже идут через server-side RPC, а Discord webhook после покупки отправляется через server-side relay.</div>'
            : ''),
        '<div>' + itemsHtml + '</div>',
        '<div style="text-align:right; margin-top:2rem;">',
            '<button class="btn btn-primary" style="font-size:1.1rem; padding:0.75rem 2rem; width:auto;" onclick="checkoutCart()">КУПИТЬ (' + totalCost + ' Монет)</button>',
        '</div>'
    ].join('');

    window.updateCartQty = (itemId, delta) => {
        let curUserDb = db.data.users.find(u => u.id === currentUser.id);
        let cartItem = curUserDb.cart.find(c => c.itemId === itemId);
        if (cartItem) {
            cartItem.quantity += delta;
            if (cartItem.quantity <= 0) {
                curUserDb.cart = curUserDb.cart.filter(c => c.itemId !== itemId);
            }
            currentUser.cart = curUserDb.cart;
            db.save();
            updateCartBadge();
            renderCart(document.getElementById('dashboardContent'));
        }
    };

    window.removeFromCart = (itemId) => {
        let curUserDb = db.data.users.find(u => u.id === currentUser.id);
        curUserDb.cart = curUserDb.cart.filter(c => c.itemId !== itemId);
        currentUser.cart = curUserDb.cart;
        db.save();
        updateCartBadge();
        renderCart(document.getElementById('dashboardContent'));
    };

    window.checkoutCart = async () => {
        if (getCurrentUserRoleId() === VACATION_ROLE_ID) {
            showToast('Пользователь в отпуске не может совершать покупки в магазине.', 'error');
            return;
        }
        let calcTotal = 0;
        let cartItems = [];
        currentUser.cart.forEach(c => {
            const item = db.data.items.find(i => i.id === c.itemId && i.companyId === currentCompanyId);
            if (item) {
                if (!item.itemType) item.itemType = 'item';
                const effectivePrice = getEffectiveItemPriceForUser(item, currentUser, currentCompanyId);
                calcTotal += (effectivePrice * c.quantity);
                cartItems.push({ itemObj: item, quantity: c.quantity, effectivePrice });
            }
        });

        if (remoteMode) {
            const authSession = authGateway.getStoredSession();
            if (!authSession || !authSession.access_token) {
                showToast('Нет активной Supabase-сессии для покупки.', 'error');
                return;
            }
            try {
                const result = await authGateway.rpcCheckout(authSession.access_token, {
                    cart_items: cartItems.map(ci => ({
                        item_id: ci.itemObj.id,
                        quantity: ci.quantity
                    }))
                });
                if (result.user) {
                    currentUser = upsertLocalUser(result.user);
                    currentUser.cart = [];
                    const curUserDb = db.data.users.find(u => u.id === currentUser.id);
                    if (curUserDb) curUserDb.cart = [];
                }
                await syncStoreReadSnapshot();
                await syncStaffReadSnapshot();
                const webhookCompanyId = result.companyId || currentCompanyId;
                const webhookCompany = db.data.companies.find(company => company.id === webhookCompanyId);
                const webhookUrl = (webhookCompany && webhookCompany.webhookUrl)
                    ? webhookCompany.webhookUrl
                    : ((db.data.systemConfig && db.data.systemConfig.webhookUrl) || '');
                if (webhookUrl) {
                    try {
                        await authGateway.invokeDiscordWebhookRelay(authSession.access_token, {
                            companyId: webhookCompanyId,
                            companyName: webhookCompany ? webhookCompany.name : 'Неизвестно',
                            webhookUrl: webhookUrl,
                            buyerUsername: currentUser.username,
                            totalCost: result.totalCost || calcTotal,
                            items: cartItems.map(ci => ({
                                name: ci.itemObj.name,
                                quantity: ci.quantity,
                                price: ci.effectivePrice,
                                item_type: ci.itemObj.itemType || 'item'
                            })),
                            mentionIds: buildPurchaseMentionIds(cartItems)
                        });
                    } catch (webhookError) {
                        console.error('Webhook relay failed', webhookError);
                        const relayMessage = [
                            webhookError && webhookError.message ? webhookError.message : '',
                            webhookError && webhookError.details ? webhookError.details : '',
                            webhookError && webhookError.error ? webhookError.error : '',
                            webhookError ? String(webhookError) : ''
                        ].filter(Boolean).join(' | ') || 'Покупка завершена, но Discord webhook не отправился.';
                        showToast(relayMessage, 'error');
                    }
                } else {
                    showToast('Покупка завершена, но webhook URL не настроен для этого сервера или fallback-конфига.', 'error');
                }
                updateCartBadge();
                showToast('Покупка завершена через безопасный server-side RPC.');
                renderCart(document.getElementById('dashboardContent'));
                return;
            } catch (error) {
                showToast(error.message || 'Не удалось оформить покупку через RPC.', 'error');
                return;
            }
        }

        if (currentUser.coins >= calcTotal) {
            currentUser.coins -= calcTotal;
            let curUserDb = db.data.users.find(u => u.id === currentUser.id);
            const oldBalance = curUserDb.coins;
            curUserDb.coins -= calcTotal;

            curUserDb.cart = [];
            currentUser.cart = [];

            db.data.logs.push({
                id: db.generateId(),
                userId: currentUser.id,
                modifierId: currentUser.id,
                companyId: currentCompanyId,
                oldBalance: oldBalance,
                newBalance: currentUser.coins,
                type: 'Store Purchase',
                reason: 'Покупка в магазине',
                date: new Date().toISOString(),
                purchaseDetails: buildPurchaseLogDetails(cartItems)
            });

            db.save();
            showToast('Покупка успешно завершена!');
            updateCartBadge();
            renderCart(document.getElementById('dashboardContent'));

            const curComp = db.data.companies.find(x => x.id === currentCompanyId);
            const curCompName = curComp?.name || 'Неизвестно';
            const webhookUrl = (curComp && curComp.webhookUrl) ? curComp.webhookUrl : (db.data.systemConfig.webhookUrl || '');
            if (webhookUrl && USE_LOCAL_WEBHOOK_RELAY) {
                const embedFields = [
                    { name: "Покупатель:", value: "`" + currentUser.username + "`", inline: false }
                ];
                cartItems.forEach(ci => {
                    embedFields.push({ name: "Предмет:", value: "`" + ci.itemObj.name + "`", inline: true });
                    embedFields.push({ name: "Количество:", value: "`" + ci.quantity + " шт.`", inline: true });
                    embedFields.push({ name: "Подытог:", value: "`" + (ci.effectivePrice * ci.quantity) + " Монет`", inline: true });
                });
                embedFields.push({ name: "Общая сумма:", value: "`" + calcTotal + " Монет`", inline: false });

                const payloadObj = {
                    embeds: [{
                        title: "Новая транзакция (" + curCompName + ")",
                        color: 45219,
                        fields: embedFields,
                        timestamp: new Date().toISOString()
                    }]
                };

                invokeLocalWebhookRelay(webhookUrl, payloadObj, {
                    companyId: currentCompanyId,
                    itemTypes: cartItems.map(ci => ci.itemObj.itemType || 'item')
                }).catch(error => {
                    console.error('Local webhook relay failed', error);
                    showToast(error.message || 'Покупка завершена, но webhook не отправился.', 'error');
                });
            }
        } else {
            showToast('Недостаточно монет для покупки!', 'error');
        }
    };
}
