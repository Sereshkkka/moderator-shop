window.openDiscordEditModal = (userId) => {
    const targetUser = db.data.users.find(u => u.id === userId);
    if (!targetUser) return;

    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="dm_overlay">',
            '<div class="modal-content" style="max-width:450px" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1.5rem">Discord ID: ' + escapeHTML(targetUser.username) + '</h3>',
                '<div class="form-group">',
                    '<label>Discord User ID</label>',
                    '<input type="text" id="discord_edit_value" class="form-control" value="' + escapeHTML(targetUser.discordId || '') + '" placeholder="Например: 123456789012345678">',
                '</div>',
                '<p class="text-muted mb-4" style="font-size:0.875rem">Ручное изменение Discord ID доступно здесь, в Гл. Управлении.</p>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" id="discord_edit_save_btn" type="button">Сохранить</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
    document.getElementById('dm_overlay').onclick = closeBalanceModal;
    const saveBtn = document.getElementById('discord_edit_save_btn');
    if (saveBtn) {
        saveBtn.onclick = () => window.saveDiscordEdit(userId);
    }
};

window.saveDiscordEdit = async (userId) => {
    const targetUser = db.data.users.find(u => u.id === userId);
    if (!targetUser) return;

    const normalized = normalizeDiscordId(document.getElementById('discord_edit_value').value);
    if (normalized && !/^\d{5,25}$/.test(normalized)) {
        showToast('Discord ID must contain digits only.', 'error');
        return;
    }
    const conflictUser = findUserByDiscordId(normalized, targetUser.id);
    if (conflictUser) {
        showToast('Discord используется другим пользователем.', 'error');
        return;
    }

    if (isSupabaseSessionActive() && authGateway && authSession && authSession.access_token) {
        try {
            const updatedUser = await authGateway.rpcAdminUpdateUserDiscord(authSession.access_token, {
                target_user_id: userId,
                discord_value: normalized
            });
            if (updatedUser) {
                upsertLocalUser(updatedUser);
            } else {
                targetUser.discordId = normalized;
            }
            if (currentUser && currentUser.id === targetUser.id) {
                currentUser.discordId = normalized;
            }
            await syncStaffReadSnapshot();
        } catch (error) {
            showToast(
                (error && error.message ? error.message : '') ||
                (typeof error === 'string' ? error : '') ||
                'Не удалось обновить Discord ID через RPC.',
                'error'
            );
            return;
        }
        db.saveLocal();
    } else {
        targetUser.discordId = normalized;
        if (currentUser && currentUser.id === targetUser.id) {
            currentUser.discordId = normalized;
        }
        db.save();
    }

    closeBalanceModal();
    showToast(normalized ? 'Discord ID сохранен.' : 'Discord ID очищен.');
    const hubContent = document.getElementById('globalHubContent');
    if (hubContent) renderGlobalUsers(hubContent);
};

window.openResetPasswordModal = (userId) => {
    const targetUser = db.data.users.find(u => u.id === userId);
    if (!targetUser) return;
    if (!canResetManagedUserPassword(targetUser)) {
        showToast('У вас нет прав на сброс пароля этого пользователя.', 'error');
        return;
    }

    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="rp_overlay">',
            '<div class="modal-content" style="max-width:520px" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1rem">Сброс пароля: ' + escapeHTML(targetUser.username) + '</h3>',
                '<p class="text-muted" style="margin-bottom:1rem;">Будет сгенерирован новый простой числовой пароль. Отправьте его пользователю вручную в Discord или мессенджере. После входа пользователь сможет поменять пароль в профиле.</p>',
                '<div id="reset_password_result" class="glass-panel" style="max-width:100%; padding:1rem; margin-bottom:1rem; border:1px dashed rgba(148,163,184,0.3); color:var(--text-muted);">Нажмите кнопку ниже, чтобы сгенерировать новый пароль.</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" id="reset_password_execute_btn" type="button">Сгенерировать новый пароль</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Закрыть</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');

    document.getElementById('rp_overlay').onclick = closeBalanceModal;
    const executeBtn = document.getElementById('reset_password_execute_btn');
    if (executeBtn) {
        executeBtn.onclick = () => window.executeUserPasswordReset(userId);
    }
};

window.executeUserPasswordReset = async (userId) => {
    const targetUser = db.data.users.find(u => u.id === userId);
    if (!targetUser) return;
    if (!canResetManagedUserPassword(targetUser)) {
        showToast('У вас нет прав на сброс пароля этого пользователя.', 'error');
        return;
    }

    const resultBox = document.getElementById('reset_password_result');
    if (resultBox) {
        resultBox.innerHTML = 'Генерирую пароль...';
    }

    try {
        const newPassword = String(100000 + Math.floor(Math.random() * 900000));
        targetUser.password = await hashPassword(newPassword);
        targetUser.mustChangePassword = true;
        db.save();
        if (resultBox) {
            resultBox.innerHTML = [
                '<div style="color:#86efac; margin-bottom:0.75rem;"><strong>Новый пароль сгенерирован.</strong></div>',
                '<div style="margin-bottom:0.35rem; color:var(--text-muted);">После входа пользователь будет принудительно отправлен на установку нового пароля.</div>',
                '<div style="margin-bottom:0.35rem; color:var(--text-muted);">Передайте его пользователю вручную:</div>',
                '<div style="font-size:1.4rem; font-weight:800; letter-spacing:0.08em; color:var(--warning);"><code>' + escapeHTML(newPassword) + '</code></div>'
            ].join('');
        }
        showToast('Новый пароль сгенерирован для ' + targetUser.username);
    } catch (error) {
        if (resultBox) {
            resultBox.innerHTML = '<span style="color:#fca5a5;">Не удалось сгенерировать пароль.</span>';
        }
        showToast(error.message || 'Не удалось сбросить пароль пользователя.', 'error');
    }
};

window.openAccessModal = (userId) => {
    const targetUser = db.data.users.find(u => u.id === userId);
    if (!targetUser) return;
    const remoteMode = isSupabaseSessionActive();
    const roleGrantsAllServers = hasAllServersAccess(targetUser);
    const utCompanies = roleGrantsAllServers
        ? db.data.companies.map(company => company.id)
        : (targetUser.authorizedCompanies || [targetUser.companyId]);

    const modalWrapper = ensureBalanceModalWrapper();

    const companyCheckboxes = db.data.companies.map(c => {
        const checked = utCompanies.includes(c.id) ? 'checked' : '';
        const disabled = roleGrantsAllServers ? 'disabled' : '';
        const eCompName = escapeHTML(c.name);
        return [
            '<div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem; padding:0.5rem; background:rgba(255,255,255,0.05); border-radius:6px">',
                '<input type="checkbox" class="access-check" value="' + c.id + '" ' + checked + ' ' + disabled + ' id="access_' + c.id + '" style="width:18px; height:18px; cursor:pointer;"' + (remoteMode ? '' : ' onchange="toggleUserAccess(\'' + userId + '\', \'' + c.id + '\', this.checked)"') + '>',
                '<label for="access_' + c.id + '" style="font-size:1rem; cursor:pointer; flex:1">' + eCompName + '</label>',
            '</div>'
        ].join('');
    }).join('');

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="am_overlay">',
            '<div class="modal-content" style="max-width:450px" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1.5rem">Ключи доступа: ' + escapeHTML(targetUser.username) + '</h3>',
                roleGrantsAllServers
                    ? '<div style="margin-bottom:1rem; padding:0.75rem; border:1px solid rgba(99,102,241,0.35); background:rgba(99,102,241,0.12); border-radius:6px;">Роль пользователя уже даёт доступ ко всем серверам.</div>'
                    : '',
                '<p class="text-muted mb-4" style="font-size:0.875rem">Отметьте серверы, к которым данный сотрудник будет иметь доступ через переключатель в шапке. Роль на каждом сервере можно менять отдельно уже внутри вкладки "Сотрудники сервера" на выбранном сервере.</p>',
                '<div style="max-height:300px; overflow-y:auto; padding-right:0.5rem">',
                    companyCheckboxes,
                '</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" style="width:100%" onclick="' + (remoteMode ? ('saveUserCompanyAccess(\'' + userId + '\')') : 'closeBalanceModal()') + '">' + (remoteMode ? 'Сохранить доступы' : 'Готово') + '</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
    document.getElementById('am_overlay').onclick = closeBalanceModal;
};

window.saveUserCompanyAccess = async (userId) => {
    const targetUser = db.data.users.find(u => u.id === userId);
    if (!targetUser) return;

    const selectedCompanyIds = Array.from(document.querySelectorAll('.access-check:checked'))
        .map(input => input.value)
        .filter(Boolean);

    if (!selectedCompanyIds.length) {
        showToast('У пользователя должен быть доступ хотя бы к одному серверу!', 'error');
        return;
    }

    const authSession = authGateway.getStoredSession();
    if (!authSession || !authSession.access_token) {
        showToast('Нет активной Supabase-сессии для изменения доступов.', 'error');
        return;
    }

    try {
        const updatedUser = await authGateway.rpcAdminSetUserCompanyAccess(authSession.access_token, {
            target_user_id: userId,
            company_ids: selectedCompanyIds
        });
        if (updatedUser) {
            updatedUser.authorizedCompanies = [...selectedCompanyIds];
            upsertLocalUser(updatedUser);
        }
        await syncStaffReadSnapshot();
        closeBalanceModal();
        showToast('Серверные доступы обновлены через безопасный RPC.');
        const hubContent = document.getElementById('globalHubContent');
        if (hubContent) renderGlobalUsers(hubContent);
    } catch (error) {
        showToast(error.message || 'Не удалось обновить доступы через RPC.', 'error');
    }
};

window.toggleUserAccess = (userId, companyId, isChecked) => {
    if (isSupabaseSessionActive()) {
        showToast('В безопасном режиме доступы сохраняются только через кнопку "Сохранить доступы".', 'error');
        const targetUser = db.data.users.find(u => u.id === userId);
        const chk = document.getElementById('access_' + companyId);
        if (chk && targetUser) {
            const currentAccess = targetUser.authorizedCompanies || [targetUser.companyId];
            chk.checked = currentAccess.includes(companyId);
        }
        return;
    }
    const targetUser = db.data.users.find(u => u.id === userId);
    if (!targetUser) return;

    if (!targetUser.authorizedCompanies) targetUser.authorizedCompanies = [targetUser.companyId];
    ensureUserCompanyRoles(targetUser);

    if (isChecked) {
        if (!targetUser.authorizedCompanies.includes(companyId)) {
            targetUser.authorizedCompanies.push(companyId);
        }
        if (!targetUser.companyRoles[companyId]) {
            targetUser.companyRoles[companyId] = 'helper';
        }
    } else {
        if (targetUser.authorizedCompanies.length <= 1) {
            showToast('У пользователя должен быть доступ хотя бы к одному серверу!', 'error');
            const chk = document.getElementById('access_' + companyId);
            if (chk) chk.checked = true;
            return;
        }
        targetUser.authorizedCompanies = targetUser.authorizedCompanies.filter(id => id !== companyId);
        if (targetUser.companyRoles && targetUser.companyRoles[companyId]) {
            delete targetUser.companyRoles[companyId];
        }
        if (targetUser.vacationRoles && targetUser.vacationRoles[companyId]) {
            delete targetUser.vacationRoles[companyId];
        }
        if (targetUser.companyId === companyId) {
            targetUser.companyId = targetUser.authorizedCompanies[0];
        }
    }
    db.save();
    showToast('Права доступа обновлены.');
    const hubContent = document.getElementById('globalHubContent');
    const activeSubTab = sessionStorage.getItem('global_sub_tab');
    if (hubContent && activeSubTab === 'users') renderGlobalUsers(hubContent);
};

const PERMS_LIST = [
    { key: 'access_all_servers', label: 'Доступ ко всем серверам' },
    { key: 'access_mod_panel', label: 'Доступ к Панели Модератора' },
    { key: 'generate_codes', label: 'Генерация Кодов' },
    { key: 'manage_store', label: 'Редактор Магазина' },
    { key: 'view_logs', label: 'Просмотр Транзакций' },
    { key: 'edit_balance', label: 'Управление Балансом' },
    { key: 'edit_roles', label: 'Управление Правами' },
    { key: 'access_bonuses', label: 'Доступ к премиям' },
    { key: 'review_bonuses', label: 'Рассмотрение премий' },
    { key: 'access_archive', label: 'Доступ к Архиву' },
    { key: 'access_global_hub', label: 'Доступ к системному разделу' },
    { key: 'invisible', label: 'Невидимка' }
];

window.openRoleModal = (roleId) => {
    const r = roleId ? db.data.roles.find(x => x.id === roleId) : { id: '', label: '', color: '#6366f1', perms: [], tier: 1 };
    if (!r) return;

    const modalWrapper = ensureBalanceModalWrapper();

    const permsCheckboxes = PERMS_LIST.map(p => {
        const checked = r.perms.includes(p.key) || r.perms.includes('all') ? 'checked' : '';
        const disabled = r.id === 'admin' ? 'disabled' : '';
        return [
            '<div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem">',
                '<input type="checkbox" class="perm-check" value="' + p.key + '" ' + checked + ' ' + disabled + ' id="chk_' + p.key + '">',
                '<label for="chk_' + p.key + '" style="font-size:0.9rem; cursor:pointer">' + p.label + '</label>',
            '</div>'
        ].join('');
    }).join('');

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="rm_overlay">',
            '<div class="modal-content" style="max-width:500px" onclick="event.stopPropagation()">',
                '<h3>' + (roleId ? 'Настройка: ' + escapeHTML(r.label) : 'Новая Группа') + '</h3>',
                '<div class="form-group mt-4">',
                    '<label>Название</label>',
                    '<input type="text" id="rm_label" class="form-control" value="' + escapeHTML(r.label) + '">',
                '</div>',
                '<div style="display:flex; gap:1rem;">',
                    '<div class="form-group" style="flex:1">',
                        '<label>Цвет (Hex)</label>',
                        '<input type="color" id="rm_color" class="form-control" value="' + r.color + '" style="height:45px; padding:0;">',
                    '</div>',
                    '<div class="form-group" style="flex:1">',
                        '<label>Уровень (1-8)</label>',
                        '<input type="number" id="rm_tier" class="form-control" value="' + r.tier + '" min="1" max="8">',
                    '</div>',
                '</div>',
                '<h5>Разрешения:</h5>',
                '<div style="margin-top:1rem; max-height:200px; overflow-y:auto; padding:1rem; background:rgba(0,0,0,0.3); border-radius:8px">',
                    permsCheckboxes,
                '</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" onclick="saveRole(\'' + (roleId || '') + '\')">Сохранить</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
    document.getElementById('rm_overlay').onclick = closeBalanceModal;
};

window.saveRole = (oldId) => {
    if (isSupabaseSessionActive()) {
        showToast('Глобальное управление ролями пока отключено до server-side миграции.', 'error');
        return;
    }
    if (oldId === PENDING_ROLE_ID || oldId === VACATION_ROLE_ID) {
        showToast('Системную роль "Ожидание" нельзя изменять.', 'error');
        return;
    }
    const label = document.getElementById('rm_label').value.trim();
    const color = document.getElementById('rm_color').value;
    const tier = parseInt(document.getElementById('rm_tier').value) || 1;

    if (!label) return showToast('Название группы не может быть пустым', 'error');

    const selectedPerms = [];
    document.querySelectorAll('.perm-check:checked').forEach(c => selectedPerms.push(c.value));

    if (oldId) {
        const r = db.data.roles.find(x => x.id === oldId);
        if (r) {
            r.label = label;
            r.color = color;
            r.tier = tier;
            if (r.id !== 'admin') r.perms = selectedPerms;
        }
    } else {
        const newId = 'role_' + db.generateId();
        db.data.roles.push({
            id: newId,
            label: label,
            color: color,
            tier: tier,
            perms: selectedPerms
        });
    }

    db.save();
    closeBalanceModal();
    showToast('Настройки группы сохранены');
    renderGlobalRoles(document.getElementById('globalHubContent'));
};

window.deleteLocalRole = (rid) => {
    if (isSupabaseSessionActive()) {
        showToast('Глобальное удаление ролей пока отключено до server-side миграции.', 'error');
        return;
    }
    if (rid === PENDING_ROLE_ID || rid === VACATION_ROLE_ID) {
        showToast('Системную роль "Ожидание" нельзя удалить.', 'error');
        return;
    }
    if (confirm('Вы уверены, что хотите удалить эту роль? Все пользователи с этой ролью будут сброшены.')) {
        db.data.roles = db.data.roles.filter(x => x.id !== rid);
        db.data.users.forEach(u => {
            if (u.role === rid) u.role = 'helper';
            if (u.companyRoles && typeof u.companyRoles === 'object') {
                Object.keys(u.companyRoles).forEach(companyId => {
                    if (u.companyRoles[companyId] === rid) {
                        u.companyRoles[companyId] = 'helper';
                    }
                });
            }
        });
        db.save();
        renderGlobalRoles(document.getElementById('globalHubContent'));
    }
};
