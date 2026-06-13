function renderHighMod(container) {
    const canManageCodes = hasPermission('generate_codes');
    const canManageStore = hasPermission('manage_store');

    container.innerHTML = [
        '<h3 class="mb-3">Панель Управления Модератора</h3>',
        '<div class="tab-headers">',
            canManageCodes ? '<div class="tab-header active" data-tab="add-user">Генерация Кодов</div>' : '',
            canManageStore ? '<div class="tab-header" data-tab="edit-store">Редактор Магазина</div>' : '',
        '</div>',

        '<div id="hm-pane-add-user" class="tab-pane active">',
            '<div class="glass-panel" style="max-width: 600px; padding: 1.5rem;">',
                '<h4>Создание Инвайт-кода</h4>',
                '<p class="mb-3 mt-4 text-muted">Сгенерируйте код для регистрации нового игрока (будет привязан к текущему серверу).</p>',
                '<div class="form-group">',
                    '<label>Никнейм</label>',
                    '<input type="text" id="hc_username" class="form-control" autocomplete="off" placeholder="Введите ник...">',
                '</div>',
                '<button class="btn btn-primary" id="btnGenCode">Создать Код</button>',

                '<h4 class="mt-4 mb-2">Активные коды сервера</h4>',
                '<div class="table-container" id="codesTableContainer" style="display:none;">',
                    '<table>',
                        '<thead>',
                            '<tr>',
                                '<th>Код</th>',
                                '<th>Никнейм</th>',
                                '<th>Статус</th>',
                                '<th>Удалить</th>',
                            '</tr>',
                        '</thead>',
                        '<tbody id="codesTableBody"></tbody>',
                    '</table>',
                '</div>',
            '</div>',
        '</div>',

        '<div id="hm-pane-edit-store" class="tab-pane">',
            '<div class="flex-between mb-3">',
                '<h4>Инвентарь магазина сервера</h4>',
                '<button class="btn btn-primary" id="btnAddItem" style="width:auto">+ Добавить Товар</button>',
            '</div>',

            '<div id="addItemForm" class="glass-panel mb-4" style="display:none; max-width:100%; padding: 1.5rem;">',
                '<h5 id="storeItemFormTitle">Новая Позиция В Магазине</h5>',
                '<input type="hidden" id="i_edit_id" value="">',
                '<div class="form-group mt-4">',
                    '<label>Название Предмета</label>',
                    '<input type="text" id="i_name" class="form-control">',
                '</div>',
                '<div class="form-group">',
                    '<label>Описания</label>',
                    '<input type="text" id="i_desc" class="form-control">',
                '</div>',
                '<div class="form-group">',
                    '<label>Цена (Сумма Монет)</label>',
                    '<input type="text" id="i_price" class="form-control" value="0" inputmode="numeric" autocomplete="off">',
                '</div>',
                '<div class="form-group">',
                    '<label>Тип Позиции</label>',
                    '<select id="i_type" class="form-control">',
                        '<option value="item">Предмет</option>',
                        '<option value="donate">Донат</option>',
                    '</select>',
                '</div>',
                '<div class="form-group">',
                    '<label>Изображение товара</label>',
                    '<input type="hidden" id="i_img" value="">',
                    '<div class="store-image-upload-row">',
                        '<label class="btn btn-outline store-image-upload-button" for="i_img_file">Загрузить файл</label>',
                        '<input type="file" id="i_img_file" accept="image/jpeg,image/png,image/webp" hidden>',
                        '<span id="i_img_status" class="text-muted"></span>',
                    '</div>',
                    '<div class="text-muted store-image-upload-hint">JPG, PNG или WebP, не больше 5 МБ.</div>',
                '</div>',
                '<div class="action-row">',
                    '<button class="btn btn-primary" id="btnSaveItem">Опубликовать</button>',
                    '<button class="btn btn-outline" id="btnCancelItem">Отмена</button>',
                '</div>',
            '</div>',
            '<div class="table-container">',
                '<table>',
                    '<thead>',
                        '<tr>',
                            '<th>Название Предмета</th>',
                            '<th>Тип</th>',
                            '<th>Стоимость</th>',
                            '<th>Действие</th>',
                        '</tr>',
                    '</thead>',
                    '<tbody id="storeTableBody"></tbody>',
                '</table>',
            '</div>',
        '</div>'
    ].join('');

    const tabs = container.querySelectorAll('.tab-header');
    tabs.forEach(t => {
        t.onclick = () => {
            tabs.forEach(x => x.classList.remove('active'));
            container.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            t.classList.add('active');
            container.querySelector('#hm-pane-' + t.getAttribute('data-tab')).classList.add('active');
        };
    });

    const renderCodes = () => {
        const tb = document.getElementById('codesTableBody');
        const tableContainer = document.getElementById('codesTableContainer');
        const scopedCodes = db.data.codes.filter(c => c.companyId === currentCompanyId && !c.isUsed);
        if (tableContainer) {
            tableContainer.style.display = scopedCodes.length ? '' : 'none';
        }

        tb.innerHTML = scopedCodes.map(c => {
            const statusBadge = c.isUsed ? '<span class="badge badge-error">Использован</span>' : '<span class="badge badge-success" style="background:var(--success);color:white">Активен</span>';
            const actionBtn = !c.isUsed ? '<button class="btn btn-danger" style="padding:0.25rem 0.5rem" onclick="deleteCode(\'' + c.id + '\')">X</button>' : '-';
            const targetU = escapeHTML(c.targetUsername || 'Неизвестно');
            return [
                '<tr>',
                    '<td style="font-family:monospace;font-weight:bold;color:var(--warning)">' + escapeHTML(c.code) + '</td>',
                    '<td><strong>' + targetU + '</strong></td>',
                    '<td>' + statusBadge + '</td>',
                    '<td>' + actionBtn + '</td>',
                '</tr>'
            ].join('');
        }).join('');
    };

    document.getElementById('btnGenCode').onclick = async () => {
        const targetUsername = document.getElementById('hc_username').value.trim();
        if (!targetUsername) {
            showToast('Поле имени пользователя пустое', 'error');
            return;
        }
        if (!isValidEnglishUsername(targetUsername)) {
            showToast('Ник может содержать только английские буквы, цифры и _.', 'error');
            return;
        }

        const existingUser = findUserByUsernameGlobally(targetUsername);
        if (existingUser) {
            if (hasUserCompanyAccess(existingUser, currentCompanyId)) {
                showToast('Пользователь ' + targetUsername + ' уже существует на текущем сервере.', 'error');
            } else {
                openExistingUserAccessPrompt(existingUser);
            }
            return;
        }

        const code = Math.random().toString(36).substr(2, 8).toUpperCase();
        const codeId = db.generateId();
        const placeholderPassword = await hashPassword('pending:' + code + ':' + Date.now());
        db.data.users.push({
            id: db.generateId(),
            username: targetUsername,
            password: placeholderPassword,
            coins: 0,
            role: 'helper',
            companyId: currentCompanyId,
            companyRoles: { [currentCompanyId]: 'helper' },
            date: new Date().toISOString(),
            cart: [],
            discordId: '',
            isPendingActivation: true,
            accountStatus: 'ожидание',
            inviteCodeId: codeId
        });
        db.data.codes.push({
            id: codeId,
            code: code,
            companyId: currentCompanyId,
            targetUsername: targetUsername,
            isUsed: false,
            createdBy: currentUser.id,
            date: new Date().toISOString()
        });
        db.save();
        document.getElementById('hc_username').value = '';
        showToast('код приглашения создан');
        renderCodes();
    };

    window.deleteCode = (id) => {
        db.data.users = db.data.users.filter(u => u.inviteCodeId !== id);
        db.data.codes = db.data.codes.filter(c => c.id !== id);
        db.save();
        showToast('Код удален');
        renderCodes();
    };
    renderCodes();

    const aForm = document.getElementById('addItemForm');
    const imageFileInput = document.getElementById('i_img_file');
    if (imageFileInput) {
        imageFileInput.onchange = () => uploadStoreImageFile(
            imageFileInput.files && imageFileInput.files[0],
            'i_img',
            null,
            'i_img_status'
        );
    }
    const resetStoreItemForm = () => {
        document.getElementById('i_edit_id').value = '';
        document.getElementById('i_name').value = '';
        document.getElementById('i_desc').value = '';
        document.getElementById('i_price').value = '0';
        document.getElementById('i_type').value = 'item';
        document.getElementById('i_img').value = '';
        const imageFileInput = document.getElementById('i_img_file');
        const imageStatus = document.getElementById('i_img_status');
        if (imageFileInput) imageFileInput.value = '';
        if (imageStatus) imageStatus.textContent = '';
        document.getElementById('storeItemFormTitle').textContent = 'Новая позиция в магазине';
        document.getElementById('btnSaveItem').textContent = 'Опубликовать';
    };
    document.getElementById('btnAddItem').onclick = () => {
        resetStoreItemForm();
        aForm.style.display = 'block';
    };
    document.getElementById('btnCancelItem').onclick = () => {
        const imageUrl = document.getElementById('i_img').value;
        releasePendingStoreImage(imageUrl);
        resetStoreItemForm();
        aForm.style.display = 'none';
    };

    document.getElementById('btnSaveItem').onclick = () => {
        const validatedPrice = getValidatedNonNegativePrice('i_price');
        if (validatedPrice === null) return;
        const editId = document.getElementById('i_edit_id').value;
        const itemPayload = {
            name: document.getElementById('i_name').value.trim() || 'Безымянный',
            description: document.getElementById('i_desc').value.trim() || 'Без описания',
            price: validatedPrice,
            itemType: document.getElementById('i_type').value || 'item',
            image: document.getElementById('i_img').value.trim()
        };
        let previousImage = '';
        if (editId) {
            const item = db.data.items.find(i => i.id === editId && i.companyId === currentCompanyId);
            if (!item) {
                showToast('Товар не найден в магазине текущего сервера.', 'error');
                return;
            }
            previousImage = item.image || '';
            Object.assign(item, itemPayload);
        } else {
            db.data.items.push({
                id: db.generateId(),
                companyId: currentCompanyId,
                ...itemPayload
            });
        }
        db.save();
        commitPendingStoreImage(itemPayload.image);
        if (previousImage && previousImage !== itemPayload.image) releaseStoreImageAfterSave(previousImage);
        const successMessage = editId ? 'Товар обновлён.' : 'Предмет загружен на витрину этого сервера';
        resetStoreItemForm();
        aForm.style.display = 'none';
        showToast(successMessage);
        renderStoreTable();
    };

    const renderStoreTable = () => {
        const scopedItems = db.data.items.filter(i => i.companyId === currentCompanyId);
        document.getElementById('storeTableBody').innerHTML = scopedItems.map(i => [
            '<tr>',
                '<td>' + escapeHTML(i.name) + '</td>',
                '<td>' + getItemTypeBadge(i.itemType || 'item') + '</td>',
                '<td>' + i.price + '</td>',
                '<td>',
                    '<button class="btn btn-primary" style="padding:0.25rem 0.5rem; width:auto; margin-right:0.5rem" onclick="editStoreItem(\'' + i.id + '\')">Редактировать</button>',
                    '<button class="btn btn-danger" style="padding:0.25rem 0.5rem" onclick="deleteItem(\'' + i.id + '\')">Удалить</button>',
                '</td>',
            '</tr>'
        ].join('')).join('');
    };
    window.editStoreItem = (id) => {
        const item = db.data.items.find(i => i.id === id && i.companyId === currentCompanyId);
        if (!item) {
            showToast('Товар не найден в магазине текущего сервера.', 'error');
            return;
        }
        document.getElementById('i_edit_id').value = item.id;
        document.getElementById('i_name').value = item.name || '';
        document.getElementById('i_desc').value = item.description || '';
        document.getElementById('i_price').value = Number(item.price || 0);
        document.getElementById('i_type').value = item.itemType || 'item';
        document.getElementById('i_img').value = item.image || '';
        document.getElementById('storeItemFormTitle').textContent = 'Редактирование товара';
        document.getElementById('btnSaveItem').textContent = 'Сохранить изменения';
        aForm.style.display = 'block';
        aForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.deleteItem = (id) => {
        const item = db.data.items.find(i => i.id === id && i.companyId === currentCompanyId);
        const removedImage = item ? item.image || '' : '';
        db.data.items = db.data.items.filter(i => i.id !== id);
        db.save();
        releaseStoreImageAfterSave(removedImage);
        showToast('Предмет убран');
        renderStoreTable();
    };
    renderStoreTable();
}

function renderLogs(container) {
    const scopedLogs = db.data.logs.filter(l => l.companyId === currentCompanyId);
    const sortedLogs = [...scopedLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const isBalanceLog = (log) => log.type === 'Store Purchase' || Number(log.newBalance || 0) !== Number(log.oldBalance || 0);
    const activeLogCategory = sessionStorage.getItem('logs_category') || 'balance';
    const categoryLogs = sortedLogs.filter(log => activeLogCategory === 'admin' ? !isBalanceLog(log) : isBalanceLog(log));

    const canDeleteLog = hasPermission('all');
    const canClearLogs = canClearCurrentCompanyLogs();
    const showImpact = activeLogCategory !== 'admin';
    const actionHeader = canDeleteLog ? '<th>Управление</th>' : '';
    const currentCompany = db.data.companies.find(c => c.id === currentCompanyId);
    const companyName = currentCompany ? currentCompany.name : 'текущего сервера';
    const clearButtonHtml = canClearLogs
        ? '<button class="btn btn-danger" style="width:auto;" onclick="clearCurrentCompanyLogs()">Очистить историю сервера</button>'
        : '';

    let htmlStr = [
        '<div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; margin-bottom:1rem;">',
            '<div>',
                '<h3 class="mb-3" style="margin-bottom:0.35rem;">Глобальные Транзакции (Изолировано)</h3>',
                '<div class="text-muted" style="font-size:0.9rem;">Сейчас отображается история сервера: ' + escapeHTML(companyName) + '</div>',
            '</div>',
            clearButtonHtml,
        '</div>',
        '<div class="tab-bar mb-3">',
            '<div class="tab-header ' + (activeLogCategory === 'balance' ? 'active' : '') + '" data-log-category="balance">Баланс</div>',
            '<div class="tab-header ' + (activeLogCategory === 'admin' ? 'active' : '') + '" data-log-category="admin">Администрирование</div>',
        '</div>',
        '<div class="table-container">',
            '<table>',
                '<thead>',
                    '<tr>',
                        '<th>Дата/Время</th>',
                        '<th>Категория</th>',
                        '<th>Применено к</th>',
                        '<th>Исполнитель</th>',
                        showImpact ? '<th>Действие</th>' : '',
                        '<th>Лог / Детали</th>',
                        actionHeader,
                    '</tr>',
                '</thead>',
                '<tbody>'
    ].join('');

    let rowsHtml = categoryLogs.map(l => {
        const targetObj = db.data.users.find(u => u.id === l.userId);
        let target = targetObj ? targetObj.username : 'Неизвестно';

        const modObj = db.data.users.find(u => u.id === l.modifierId);
        let mod = modObj ? modObj.username : 'Неизвестно';

        if (!canViewInvisibleUsers()) {
            if (targetObj && isInvisibleUser(targetObj, currentCompanyId)) target = 'System';
            if (modObj && isInvisibleUser(modObj, currentCompanyId)) mod = 'System';
        }

        const eTarget = escapeHTML(target);
        const eMod = escapeHTML(mod);

        const diff = l.newBalance - l.oldBalance;
        const diffStr = diff > 0 ? '+' + diff : diff;
        const color = diff > 0 ? 'var(--success)' : (diff < 0 ? 'var(--danger)' : 'var(--text-muted)');

        const typeLabel = l.type || 'Неизвестно';
        let typeBadge = '';
        if (typeLabel === 'Store Purchase') {
            typeBadge = '<span class="badge" style="background:var(--secondary);color:white">Покупка</span>';
        } else if (typeLabel === 'Manual Adjustment') {
            typeBadge = '<span class="badge" style="background:var(--primary);color:white">Управление</span>';
        } else {
            typeBadge = '<span class="badge" style="background:var(--border)">Спец-ОП</span>';
        }

        let actionCell = '';
        if (canDeleteLog) {
            actionCell = '<td><button class="btn btn-danger" style="padding:0.25rem 0.5rem;" onclick="deleteLog(\'' + l.id + '\')">Удалить</button></td>';
        }

        const purchaseDetails = getVisiblePurchaseLogDetails(l);
        const isExpanded = expandedPurchaseLogIds.has(l.id);
        const detailsControl = purchaseDetails
            ? '<button class="btn btn-outline" style="padding:0.15rem 0.45rem; width:auto; font-size:0.8rem; margin-right:0.5rem;" onclick="togglePurchaseLogDetails(\'' + l.id + '\')">' + (isExpanded ? '▾' : '▸') + '</button>'
            : '';
        const detailRowHtml = purchaseDetails && isExpanded
            ? [
                '<tr class="log-details-row">',
                    '<td colspan="' + ((showImpact ? 6 : 5) + (canDeleteLog ? 1 : 0)) + '">',
                        '<div class="log-details-panel">',
                            '<div class="log-details-title">Состав покупки</div>',
                            '<div class="log-details-list">',
                                purchaseDetails.items.map(item => [
                                    '<div class="log-details-item">',
                                        '<span><strong>' + escapeHTML(item.name) + '</strong> × ' + Number(item.quantity || 0) + '</span>',
                                        '<span>' + Number(item.subtotal || 0) + ' монет</span>',
                                    '</div>'
                                ].join('')).join(''),
                            '</div>',
                        '</div>',
                    '</td>',
                '</tr>'
            ].join('')
            : '';

        return [
            '<tr>',
                '<td>' + formatAppDate(l.date) + '</td>',
                '<td>' + typeBadge + '</td>',
                '<td>' + eTarget + '</td>',
                '<td>' + eMod + '</td>',
                showImpact ? '<td style="color:' + color + '; font-weight:bold">' + diffStr + '</td>' : '',
                '<td>' + detailsControl + escapeHTML(l.reason) + '</td>',
                actionCell,
            '</tr>',
            detailRowHtml
        ].join('');
    }).join('');

    if (categoryLogs.length === 0) {
        rowsHtml = '<tr><td colspan="' + ((showImpact ? 6 : 5) + (canDeleteLog ? 1 : 0)) + '">В этой категории пока нет записей.</td></tr>';
    }

    htmlStr += rowsHtml + '</tbody></table></div>';
    container.innerHTML = htmlStr;

    container.querySelectorAll('[data-log-category]').forEach(tab => {
        tab.onclick = () => {
            sessionStorage.setItem('logs_category', tab.dataset.logCategory);
            renderLogs(container);
        };
    });

    window.deleteLog = (logId) => {
        expandedPurchaseLogIds.delete(logId);
        removeLogById(logId, false);
        renderLogs(document.getElementById('dashboardContent'));
    };

    window.togglePurchaseLogDetails = (logId) => {
        if (expandedPurchaseLogIds.has(logId)) expandedPurchaseLogIds.delete(logId);
        else expandedPurchaseLogIds.add(logId);
        renderLogs(document.getElementById('dashboardContent'));
    };

    window.clearCurrentCompanyLogs = () => {
        if (!canClearCurrentCompanyLogs()) {
            showToast('У вас нет прав на очистку истории этого сервера.', 'error');
            return;
        }
        const logIdsToRemove = db.data.logs.filter(l => l.companyId === currentCompanyId).map(l => l.id);
        const removedCount = logIdsToRemove.length;
        logIdsToRemove.forEach(logId => removeLogById(logId, true));
        showToast(removedCount > 0 ? 'История текущего сервера очищена.' : 'На этом сервере уже нет транзакций.');
        renderLogs(document.getElementById('dashboardContent'));
    };
}
