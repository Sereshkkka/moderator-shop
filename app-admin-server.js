window.saveSystemConfig = async () => {
    const newWb = document.getElementById('sys_webhook').value.trim();
    if (isSupabaseSessionActive()) {
        const authSession = authGateway.getStoredSession();
        if (!authSession || !authSession.access_token) {
            showToast('Нет активной Supabase-сессии для сохранения webhook.', 'error');
            return;
        }
        try {
            const updatedConfig = await authGateway.rpcAdminUpdateSystemWebhook(authSession.access_token, {
                webhook_value: newWb
            });
            db.data.systemConfig = updatedConfig || { webhookUrl: newWb };
            db.saveLocal();
            showToast('Глобальный webhook обновлен через безопасный RPC.');
        } catch (error) {
            showToast(error.message || 'Не удалось обновить глобальный webhook.', 'error');
        }
        return;
    }
    db.data.systemConfig.webhookUrl = newWb;
    db.save();
    showToast('Настройки системы успешно обновлены.');
};

window.saveSystemConfig = async () => {
    const webhookInput = document.getElementById('sys_webhook');
    const avatarTemplateInput = document.getElementById('sys_avatar_template');
    const newWb = webhookInput ? webhookInput.value.trim() : '';
    const newAvatarTemplate = normalizeAvatarTemplate(avatarTemplateInput ? avatarTemplateInput.value : '');
    if (isSupabaseSessionActive()) {
        const authSession = authGateway.getStoredSession();
        if (!authSession || !authSession.access_token) {
            showToast('Нет активной Supabase-сессии для сохранения webhook.', 'error');
            return;
        }
        try {
            const updatedConfig = await authGateway.rpcAdminUpdateSystemWebhook(authSession.access_token, {
                webhook_value: newWb
            });
            db.data.systemConfig = normalizeSystemConfig({
                ...(updatedConfig || {}),
                webhookUrl: updatedConfig && updatedConfig.webhookUrl !== undefined ? updatedConfig.webhookUrl : newWb,
                avatarUrlTemplate: updatedConfig && updatedConfig.avatarUrlTemplate !== undefined ? updatedConfig.avatarUrlTemplate : newAvatarTemplate,
                bonusReasons: getBonusReasons(),
                bonusRequests: getBonusRequests(),
                bonusPermissionsInitialized: db.data.systemConfig && db.data.systemConfig.bonusPermissionsInitialized
            });
            db.data.systemConfig.avatarUrlTemplate = newAvatarTemplate;
            db.saveLocal();
            showToast('Настройки системы обновлены через безопасный RPC.');
        } catch (error) {
            showToast(error.message || 'Не удалось обновить настройки системы.', 'error');
        }
        return;
    }
    db.data.systemConfig = normalizeSystemConfig({
        webhookUrl: newWb,
        avatarUrlTemplate: newAvatarTemplate,
        bonusReasons: getBonusReasons(),
        bonusRequests: getBonusRequests(),
        bonusPermissionsInitialized: db.data.systemConfig && db.data.systemConfig.bonusPermissionsInitialized
    });
    db.save();
    showToast('Настройки системы успешно обновлены.');
};

window.globalDeleteUser = (uid) => {
    if (isSupabaseSessionActive()) {
        showToast('Глобальное удаление пользователей пока отключено до server-side миграции.', 'error');
        return;
    }
    const u = db.data.users.find(x => x.id === uid);
    if (!u) return;
    if (u.username === 'sereshkkka') {
        showToast('Вы не можете удалить создателя системы!', 'error');
        return;
    }

    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="del_overlay">',
            '<div class="modal-content">',
                '<h3 style="color:var(--danger)">Глобальное Удаление</h3>',
                '<p class="mt-3">Вы уверены, что хотите ПОЛНОСТЬЮ стереть пользователя <strong>' + u.username + '</strong> изо всех баз данных ModShop?</p>',
                '<p style="font-size:0.8rem; color:var(--text-muted)" class="mt-2 text-warning">Это действие необратимо.</p>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-danger" onclick="executeGlobalDelete(\'' + uid + '\')">Да, Стереть</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
    document.getElementById('del_overlay').onclick = closeBalanceModal;
};

window.executeGlobalDelete = (uid) => {
    if (isSupabaseSessionActive()) {
        showToast('Глобальное удаление пользователей пока отключено до server-side миграции.', 'error');
        return;
    }
    db.data.users = db.data.users.filter(u => u.id !== uid);
    db.save();
    closeBalanceModal();
    showToast('Пользователь стерт из глобальной БД.');
    const hubContent = document.getElementById('globalHubContent');
    if (hubContent) renderGlobalUsers(hubContent);
};

window.createNewCompany = async () => {
    const input = document.getElementById('new_company_name');
    const ipt = input.value.trim();
    if (!ipt) return;
    if (isSupabaseSessionActive()) {
        const authSession = authGateway.getStoredSession();
        if (!authSession || !authSession.access_token) {
            showToast('Нет активной Supabase-сессии для создания сервера.', 'error');
            return;
        }
        try {
            const createdCompany = await authGateway.rpcAdminCreateCompany(authSession.access_token, {
                company_name: ipt
            });
            if (createdCompany) {
                upsertLocalCompany(createdCompany);
                currentCompanyId = createdCompany.id;
                sessionStorage.setItem('admin_context_company', currentCompanyId);
            }
            await syncStoreReadSnapshot();
            await syncStaffReadSnapshot();
            showToast('Сервер "' + ipt + '" создан через безопасный RPC.');
            renderRoute();
        } catch (error) {
            showToast(error.message || 'Не удалось создать сервер.', 'error');
        }
        return;
    }
    const newC = { id: 'comp_' + db.generateId(), name: ipt, accentColor: '#8b5cf6' };
    db.data.companies.push(newC);
    currentCompanyId = newC.id;
    if (currentUser && Array.isArray(currentUser.authorizedCompanies) && !currentUser.authorizedCompanies.includes(newC.id)) {
        currentUser.authorizedCompanies.push(newC.id);
        ensureUserCompanyRoles(currentUser);
        currentUser.companyRoles[newC.id] = getCurrentUserRoleId() || currentUser.role || 'helper';
    }
    const persistedCurrentUser = currentUser ? db.data.users.find(u => u.id === currentUser.id) : null;
    if (persistedCurrentUser) {
        if (!Array.isArray(persistedCurrentUser.authorizedCompanies)) {
            persistedCurrentUser.authorizedCompanies = [persistedCurrentUser.companyId];
        }
        if (!persistedCurrentUser.authorizedCompanies.includes(newC.id)) {
            persistedCurrentUser.authorizedCompanies.push(newC.id);
        }
        ensureUserCompanyRoles(persistedCurrentUser);
        persistedCurrentUser.companyRoles[newC.id] = getCurrentUserRoleId() || persistedCurrentUser.role || 'helper';
    }
    try {
        sessionStorage.setItem('admin_context_company', currentCompanyId);
        sessionStorage.setItem('active_tab', 'globalctrl');
        sessionStorage.setItem('global_sub_tab', 'servers');
    } catch (e) {}
    db.save();
    if (input) {
        input.value = '';
        input.focus();
    }
    refreshTopbarServerName();
    const hubContent = document.getElementById('globalHubContent');
    if (hubContent) {
        renderGlobalServers(hubContent);
    } else {
        renderRoute();
    }
    showToast('Сервер "' + ipt + '" создан.');
};

window.openServerWebhookModal = (cId) => {
    const comp = db.data.companies.find(c => c.id === cId);
    if (!comp) return;

    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="swm_overlay">',
            '<div class="modal-content" style="max-width:550px" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1.5rem">Настройка Webhook: ' + escapeHTML(comp.name) + '</h3>',
                '<div class="form-group mb-4">',
                    '<label>Личная ссылка Discord Webhook</label>',
                    '<input type="text" id="swm_url" class="form-control" value="' + escapeHTML(comp.webhookUrl || '') + '" placeholder="Оставьте пустым для Fallback...">',
                    '<p class="text-muted mt-2" style="font-size:0.8rem">Если вы не укажете персональную ссылку, будут использоваться общие настройки Глобального Хаба.</p>',
                '</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" onclick="saveServerWebhook(\'' + cId + '\')">Сохранить</button>',
                    '<button class="btn btn-outline" onclick="testServerWebhook(\'' + cId + '\')">Тест webhook</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
    document.getElementById('swm_overlay').onclick = closeBalanceModal;
};

window.testServerWebhook = async (cId) => {
    const cooldownKey = 'webhook_test_cooldown_' + cId;
    const now = Date.now();
    const lastRun = Number(sessionStorage.getItem(cooldownKey) || 0);
    const remainingMs = 30000 - (now - lastRun);
    if (remainingMs > 0) {
        showToast('Тест webhook можно повторить через ' + Math.ceil(remainingMs / 1000) + ' сек.', 'error');
        return;
    }

    const comp = db.data.companies.find(c => c.id === cId);
    if (!comp) return;

    const input = document.getElementById('swm_url');
    const typedUrl = input ? input.value.trim() : '';
    const fallbackUrl = db.data.systemConfig && db.data.systemConfig.webhookUrl ? db.data.systemConfig.webhookUrl : '';
    const webhookUrl = typedUrl || fallbackUrl;

    if (!webhookUrl) {
        showToast('Сначала укажите webhook сервера или глобальный webhook.', 'error');
        return;
    }

    try {
        sessionStorage.setItem(cooldownKey, String(now));
        await invokeLocalWebhookRelay(webhookUrl, {
            embeds: [{
                title: 'Тест webhook ModShop',
                description: 'Webhook успешно подключен для сервера **' + comp.name + '**.',
                color: 5793266,
                fields: [
                    { name: 'Сервер', value: '`' + comp.name + '`', inline: true },
                    { name: 'Источник', value: typedUrl ? '`Webhook сервера`' : '`Глобальный fallback`', inline: true }
                ],
                timestamp: new Date().toISOString()
            }]
        });
        showToast('Тестовый webhook отправлен.');
    } catch (error) {
        showToast(error.message || 'Не удалось отправить тестовый webhook.', 'error');
    }
};

window.saveServerWebhook = async (cId) => {
    const newUrl = document.getElementById('swm_url').value.trim();
    const comp = db.data.companies.find(c => c.id === cId);
    if (!comp) return;
    if (isSupabaseSessionActive()) {
        const authSession = authGateway.getStoredSession();
        if (!authSession || !authSession.access_token) {
            showToast('Нет активной Supabase-сессии для обновления webhook.', 'error');
            return;
        }
        try {
            const updatedCompany = await authGateway.rpcAdminUpdateCompanyWebhook(authSession.access_token, {
                target_company_id: cId,
                webhook_value: newUrl
            });
            if (updatedCompany) {
                upsertLocalCompany(updatedCompany);
                db.saveLocal();
            }
            closeBalanceModal();
            showToast('Webhook для ' + comp.name + ' сохранен через безопасный RPC.');
            const hubContent = document.getElementById('globalHubContent');
            if (hubContent) renderGlobalServers(hubContent);
        } catch (error) {
            showToast(error.message || 'Не удалось сохранить webhook сервера.', 'error');
        }
        return;
    }
    comp.webhookUrl = newUrl;
    db.save();
    closeBalanceModal();
    showToast('Webhook для ' + comp.name + ' успешно сохранен.');
    const hubContent = document.getElementById('globalHubContent');
    if (hubContent) renderGlobalServers(hubContent);
};

window.saveSystemConfig = async () => {
    const webhookInput = document.getElementById('sys_webhook');
    const avatarTemplateInput = document.getElementById('sys_avatar_template');
    const newWb = webhookInput ? webhookInput.value.trim() : '';
    const newAvatarTemplate = normalizeAvatarTemplate(avatarTemplateInput ? avatarTemplateInput.value : '');

    db.data.systemConfig = normalizeSystemConfig({
        webhookUrl: newWb,
        avatarUrlTemplate: newAvatarTemplate
    });
    await db.save();
    showToast('Настройки системы сохранены.');

    const hubContent = document.getElementById('globalHubContent');
    if (hubContent) renderGlobalSettings(hubContent);
};

window.openCompanyRenameModal = (cId) => {
    const comp = db.data.companies.find(c => c.id === cId);
    if (!comp) return;

    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="bm_overlay">',
            '<div class="modal-content" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1.5rem">Переименовать сервер</h3>',
                '<div class="form-group">',
                    '<label>Название для: ' + escapeHTML(comp.name) + '</label>',
                    '<input type="text" id="ren_comp_name" class="form-control" value="' + escapeHTML(comp.name) + '">',
                '</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" onclick="executeCompanyRename(\'' + comp.id + '\')">Сохранить название</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');

    document.getElementById('bm_overlay').onclick = closeBalanceModal;
};

window.executeCompanyRename = async (cId) => {
    const newName = document.getElementById('ren_comp_name').value.trim();
    if (!newName) {
        showToast('Название не может быть пустым', 'error');
        return;
    }

    const comp = db.data.companies.find(c => c.id === cId);
    if (comp) {
        if (isSupabaseSessionActive()) {
            const authSession = authGateway.getStoredSession();
            if (!authSession || !authSession.access_token) {
                showToast('Нет активной Supabase-сессии для переименования сервера.', 'error');
                return;
            }
            try {
                const updatedCompany = await authGateway.rpcAdminRenameCompany(authSession.access_token, {
                    target_company_id: cId,
                    new_company_name: newName
                });
                if (updatedCompany) {
                    upsertLocalCompany(updatedCompany);
                    db.saveLocal();
                }
                closeBalanceModal();
                showToast('Название сервера обновлено через безопасный RPC.');
                renderRoute();
            } catch (error) {
                showToast(error.message || 'Не удалось переименовать сервер.', 'error');
            }
            return;
        }
        comp.name = newName;
        db.save();
        closeBalanceModal();
        showToast('Название сервера успешно обновлено');
        renderRoute();
    }
};

window.openCompanyDeleteModal = (cId) => {
    const comp = db.data.companies.find(c => c.id === cId);
    if (!comp) return;
    const remoteMode = isSupabaseSessionActive();

    if (db.data.companies.length <= 1) {
        showToast('Нельзя удалить последний сервер в системе!', 'error');
        return;
    }
    if (cId === currentCompanyId && currentUser.username !== 'sereshkkka') {
        showToast('Нельзя удалить сервер, в котором вы сейчас находитесь!', 'error');
        return;
    }

    const cUsers = db.data.users.filter(u => u.companyId === cId).length;
    const cItems = db.data.items.filter(i => i.companyId === cId).length;

    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="bm_overlay">',
            '<div class="modal-content" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1.5rem">Удаление сервера</h3>',
                (remoteMode
                    ? '<p style="margin-bottom:1rem; line-height:1.5;">Сервер <strong>' + escapeHTML(comp.name) + '</strong> можно удалить только если он уже пустой.</p><ul style="margin-bottom:1.5rem; color:var(--danger); font-size:0.9rem; list-style:inside;"><li>Сотрудников сейчас: ' + cUsers + '</li><li>Товаров сейчас: ' + cItems + '</li><li>Неиспользованные коды тоже должны быть удалены заранее</li></ul><p style="font-weight:bold; margin-bottom:1.5rem;">RPC сам заблокирует удаление, если сервер еще не очищен.</p>'
                    : '<p style="margin-bottom:1rem; line-height:1.5;">Вы собираетесь полностью удалить сервер <strong>' + escapeHTML(comp.name) + '</strong>.</p><ul style="margin-bottom:1.5rem; color:var(--danger); font-size:0.9rem; list-style:inside;"><li>Будет удалено сотрудников: ' + cUsers + '</li><li>Будет удалено товаров магазина: ' + cItems + '</li><li>Все логи и инвайт-коды будут очищены</li></ul><p style="font-weight:bold; margin-bottom:1.5rem;">Это действие НЕОБРАТИМО. Вы уверены?</p>'),
                '<div class="action-row mt-4">',
                    '<button class="btn btn-danger" onclick="executeCompanyDelete(\'' + comp.id + '\')">' + (remoteMode ? 'Удалить пустой сервер' : 'Да, удалить всё') + '</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');

    document.getElementById('bm_overlay').onclick = closeBalanceModal;
};

window.executeCompanyDelete = async (cId) => {
    const comp = db.data.companies.find(c => c.id === cId);
    if (!comp) return;

    if (isSupabaseSessionActive()) {
        const authSession = authGateway.getStoredSession();
        if (!authSession || !authSession.access_token) {
            showToast('Нет активной Supabase-сессии для удаления сервера.', 'error');
            return;
        }
        try {
            await authGateway.rpcAdminDeleteCompany(authSession.access_token, {
                target_company_id: cId
            });
            db.data.companies = db.data.companies.filter(company => company.id !== cId);
            ensureValidCurrentCompany();
            db.saveLocal();
            closeBalanceModal();
            showToast('Сервер "' + comp.name + '" удален через безопасный RPC.');
            renderRoute();
        } catch (error) {
            showToast(error.message || 'Не удалось удалить сервер.', 'error');
        }
        return;
    }

    db.data.users = db.data.users.filter(u => u.companyId !== cId);
    db.data.users.forEach(u => {
        if (Array.isArray(u.authorizedCompanies)) {
            u.authorizedCompanies = u.authorizedCompanies.filter(companyId => companyId !== cId);
            if (!u.authorizedCompanies.length && u.companyId && u.companyId !== cId) {
                u.authorizedCompanies = [u.companyId];
            }
        }
        if (u.companyRoles && typeof u.companyRoles === 'object') {
            delete u.companyRoles[cId];
        }
    });
    db.data.items = db.data.items.filter(i => i.companyId !== cId);
    db.data.logs = db.data.logs.filter(l => l.companyId !== cId);
    db.data.codes = db.data.codes.filter(c => c.companyId !== cId);
    db.data.companies = db.data.companies.filter(c => c.id !== cId);

    if (cId === currentCompanyId) {
        currentCompanyId = db.data.companies.length ? db.data.companies[0].id : '';
        if (currentCompanyId) {
            sessionStorage.setItem('admin_context_company', currentCompanyId);
        }
    }

    db.save();
    closeBalanceModal();
    refreshTopbarServerName();
    const hubContent = document.getElementById('globalHubContent');
    if (hubContent) {
        renderGlobalServers(hubContent);
    } else {
        renderRoute();
    }
    showToast('Сервер "' + comp.name + '" и все его данные стёрты.');
};
