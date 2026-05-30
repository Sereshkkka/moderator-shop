function renderUsers(container) {
    const remoteReadMode = isSupabaseSessionActive();
    const canEditBalance = hasPermission('edit_balance');
    const canEditRoles = hasPermission('edit_roles');
    const canGenerateCodes = hasPermission('generate_codes');
    let scopedUsers = db.data.users.filter(u => hasUserCompanyAccess(u, currentCompanyId) && !isUserArchivedOnCompany(u, currentCompanyId));

    if (currentUser.username !== 'sereshkkka') {
        scopedUsers = scopedUsers.filter(u => u.username !== 'sereshkkka');
    }

    scopedUsers = scopedUsers.sort((a, b) => {
        const tierDiff = getRoleTier(getUserRoleForCompany(b, currentCompanyId)) - getRoleTier(getUserRoleForCompany(a, currentCompanyId));
        if (tierDiff !== 0) return tierDiff;
        return a.username.localeCompare(b.username);
    });

    const summaryHtml = [
        '<div class="staff-summary-row">',
            '<div class="staff-summary-card">',
                '<span class="staff-summary-label">Всего сотрудников</span>',
                '<strong>' + scopedUsers.length + '</strong>',
            '</div>',
            '<div class="staff-summary-card">',
                '<span class="staff-summary-label">Можно менять баланс</span>',
                '<strong>' + (canEditBalance ? 'Да' : 'Нет') + '</strong>',
            '</div>',
            '<div class="staff-summary-card">',
                '<span class="staff-summary-label">Можно менять роли</span>',
                '<strong>' + (canEditRoles ? 'Да' : 'Нет') + '</strong>',
            '</div>',
        '</div>'
    ].join('');

    const staffModeNotice = remoteReadMode
        ? '<div class="glass-panel mb-4" style="max-width:100%; padding:1rem 1.25rem; border:1px solid rgba(59,130,246,0.28); background:rgba(59,130,246,0.10); color:#bfdbfe;"><strong>Supabase staff-режим активен.</strong> Список сотрудников и коды читаются из реальной базы. Баланс, роли, генерация кодов и архивные действия уже идут через безопасные server-side RPC.</div>'
        : '';

    const tiles = scopedUsers.map(u => {
        const eUsername = escapeHTML(u.username);
        const canOpenManagement = canManageUserBalance(u) || canManageUserRole(u) || canArchiveManagedUser(u) || u.id === currentUser.id;
        const pendingStatusBadge = u.isPendingActivation ? getAccountStatusBadge(u) : '';
        return [
            '<button class="staff-tile' + (canOpenManagement ? '' : ' is-readonly') + '" onclick="openStaffProfileTab(\'' + u.id + '\')">',
            '<img src="' + getUserAvatarUrl(u.username, 32) + '" class="staff-tile-avatar" style="object-fit:cover; image-rendering:pixelated; background:transparent;">',
                '<div class="staff-tile-name">' + eUsername + '</div>',
                '<div class="staff-tile-badges">',
                    getBadge(getUserRoleForCompany(u, currentCompanyId)),
                    pendingStatusBadge,
                '</div>',
                '<div class="staff-tile-meta">',
                    '<span>' + u.coins + ' монет</span>',
                    '<span>' + new Date(u.date).toLocaleDateString() + '</span>',
                '</div>',
            '</button>'
        ].join('');
    }).join('');

    let codesHtml = '';
    if (canGenerateCodes) {
        codesHtml = [
            '<div class="glass-panel mb-4" style="max-width:100%; padding:1.5rem;">',
                '<h4>Генерация кодов</h4>',
                '<p class="mb-3 mt-2 text-muted">Создайте код для нового сотрудника. Аккаунт ожидания будет создан сразу.</p>',
                '<div class="staff-summary-row" style="margin-bottom:1rem;">',
                    '<div class="form-group" style="margin-bottom:0;">',
                        '<label>Никнейм</label>',
                        '<input type="text" id="hc_username" class="form-control" autocomplete="off" placeholder="Введите ник...">',
                    '</div>',
                    '<div style="display:flex; align-items:flex-end;">',
                        '<button class="btn btn-primary" id="btnGenCode" style="width:auto;">Создать код</button>',
                    '</div>',
                '</div>',
                '<div class="table-container">',
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
            '</div>'
        ].join('');
    }

    container.innerHTML = [
        '<div class="staff-header-row">',
            '<div>',
                '<h3 class="mb-2">Сотрудники сервера</h3>',
                '<p class="text-muted">Нажмите на плитку сотрудника, чтобы открыть его профиль или редактирование.</p>',
            '</div>',
        '</div>',
        staffModeNotice,
        codesHtml,
        summaryHtml,
        '<div class="staff-grid">' + tiles + '</div>'
    ].join('');

    if (canGenerateCodes) {
        const renderCodes = () => {
            const tb = document.getElementById('codesTableBody');
            const scopedCodes = db.data.codes.filter(c => c.companyId === currentCompanyId && !c.isUsed);
            tb.innerHTML = scopedCodes.map(c => {
                const statusBadge = c.isUsed ? '<span class="badge badge-error">Использован</span>' : '<span class="badge badge-success" style="background:var(--success);color:white">Активен</span>';
                const actionBtn = !c.isUsed
                    ? (remoteReadMode
                        ? '<span style="color:var(--text-muted); font-size:0.85rem;">Server-side only</span>'
                        : '<button class="btn btn-danger" style="padding:0.25rem 0.5rem" onclick="deleteCode(\'' + c.id + '\')">X</button>')
                    : '-';
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

            if (remoteReadMode) {
                const authSession = authGateway.getStoredSession();
                if (!authSession || !authSession.access_token) {
                    showToast('Нет активной Supabase-сессии для генерации кода.', 'error');
                    return;
                }
                try {
                    await authGateway.rpcGenerateCode(authSession.access_token, {
                        target_username: targetUsername,
                        target_company_id: currentCompanyId
                    });
                    document.getElementById('hc_username').value = '';
                    await syncStaffReadSnapshot();
                    showToast('код сгенерирован.Аккаунт создан');
                    renderUsers(document.getElementById('dashboardContent'));
                    return;
                } catch (error) {
                    showToast(error.message || 'Не удалось сгенерировать код через server-side RPC.', 'error');
                    return;
                }
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
        showToast('код сгенерирован.Аккаунт создан');
            renderUsers(document.getElementById('dashboardContent'));
        };

        window.deleteCode = async (id) => {
            if (remoteReadMode) {
                const authSession = authGateway.getStoredSession();
                if (!authSession || !authSession.access_token) {
                    showToast('Нет активной Supabase-сессии для удаления кода.', 'error');
                    return;
                }
                try {
                    await authGateway.rpcDeleteCode(authSession.access_token, {
                        target_code_id: id
                    });
                    await syncStaffReadSnapshot();
                    showToast('Код удален через безопасный server-side RPC.');
                    renderUsers(document.getElementById('dashboardContent'));
                    return;
                } catch (error) {
                    showToast(error.message || 'Не удалось удалить код через RPC.', 'error');
                    return;
                }
            }
            db.data.users = db.data.users.filter(u => u.inviteCodeId !== id);
            db.data.codes = db.data.codes.filter(c => c.id !== id);
            db.save();
            showToast('Код удален');
            renderUsers(document.getElementById('dashboardContent'));
        };

        renderCodes();
    }
}

window.openStaffProfileTab = (targetUserId) => {
    const targetUser = db.data.users.find(u => u.id === targetUserId);
    if (!targetUser) return;
    setSelectedStaffProfileUser(targetUserId);
    sessionStorage.setItem('active_tab', 'staffprofile');
    renderRoute();
};

function renderStaffProfile(container, targetUser) {
    const canEditBalance = canManageUserBalance(targetUser);
    const canEditRole = canManageUserRole(targetUser);
    const canArchive = canArchiveManagedUser(targetUser);
    const canResetPassword = canResetManagedUserPassword(targetUser);
    const canToggleVacation = canManageVacation(targetUser);
    const canManageReprimands = canManageUserReprimands(targetUser);
    const canManageAnything = canEditBalance || canEditRole || canArchive || canResetPassword || canToggleVacation || canManageReprimands;
    const targetRoleId = getUserRoleForCompany(targetUser, currentCompanyId);
    const effectiveRoleId = getEffectiveUserRoleForCompany(targetUser, currentCompanyId);
    const reprimandCount = getUserReprimandCount(targetUser, currentCompanyId);
    const eUsername = escapeHTML(targetUser.username);
    const currentRoleLabel = escapeHTML(getRoleLabel(targetRoleId));
    const pendingInviteCode = targetUser.isPendingActivation
        ? db.data.codes.find(c => c.id === targetUser.inviteCodeId)
            || db.data.codes.find(c => c.companyId === currentCompanyId && c.targetUsername === targetUser.username && !c.isUsed)
        : null;
    const pendingInviteCodeRow = targetUser.isPendingActivation
        ? '<div class="profile-stat-row"><span>Код приглашения</span><div class="profile-stat-value-wrap"><strong style="font-family:monospace; letter-spacing:0.04em;">' + escapeHTML(pendingInviteCode ? pendingInviteCode.code : 'Н/Д') + '</strong></div></div>'
        : '';

    const userLogs = [...db.data.logs]
        .filter(l => l.companyId === currentCompanyId)
        .filter(l => l.userId === targetUser.id)
        .filter(l => Number(l.newBalance) !== Number(l.oldBalance))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 20);

    const userRowsHtml = userLogs.length
        ? userLogs.map(l => {
            const diff = Number(l.newBalance) - Number(l.oldBalance);
            const diffStr = diff > 0 ? '+' + diff : diff;
            const color = diff > 0 ? 'var(--success)' : (diff < 0 ? 'var(--danger)' : 'var(--text-muted)');
            const modifier = db.data.users.find(u => u.id === l.modifierId);
            let executor = 'Система';
            if (l.type === 'Store Purchase') executor = 'Покупка';
            else if (modifier) executor = modifier.username;
            return [
                '<tr>',
                    '<td>' + new Date(l.date).toLocaleDateString() + '</td>',
                    '<td>' + escapeHTML(executor) + '</td>',
                    '<td style="color:' + color + '; font-weight:bold">' + diffStr + '</td>',
                    '<td>' + escapeHTML(l.reason || '') + '</td>',
                '</tr>'
            ].join('');
        }).join('')
        : '<tr><td colspan="4">У пользователя пока нет изменений баланса на этом сервере.</td></tr>';

    const editIconSvg = [
        '<svg class="icon-edit-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
            '<path d="M15.2 5.2a2.6 2.6 0 0 1 3.6 0l.9.9a2.6 2.6 0 0 1 0 3.6l-8.8 8.8a3 3 0 0 1-1.3.8l-3.3.8a.8.8 0 0 1-1-.9l.8-3.3a3 3 0 0 1 .8-1.3z"></path>',
            '<path d="M14 6.4 18.6 11"></path>',
        '</svg>'
    ].join('');
    const roleEditButton = canEditRole
        ? '<button type="button" class="icon-edit-trigger" onclick="openRoleEditModal(\'' + targetUser.id + '\')" title="Изменить должность" aria-label="Изменить должность">' + editIconSvg + '</button>'
        : '';
    const balanceEditButton = canEditBalance
        ? '<button type="button" class="icon-edit-trigger" onclick="openBalanceEditModal(\'' + targetUser.id + '\')" title="Изменить баланс" aria-label="Изменить баланс">' + editIconSvg + '</button>'
        : '';
    const reprimandControls = canManageReprimands
        ? '<div class="profile-stat-actions"><button class="icon-edit-btn" onclick="adjustUserReprimands(\'' + targetUser.id + '\', -1)" title="Снять выговор" aria-label="Снять выговор">−</button><button class="icon-edit-btn" onclick="adjustUserReprimands(\'' + targetUser.id + '\', 1)" title="Добавить выговор" aria-label="Добавить выговор">+</button></div>'
        : '';

    const discordBlock = targetUser.discordId
        ? [
            '<div style="display:flex; align-items:center; gap:0.85rem;">',
                (targetUser.discordAvatarUrl
                    ? '<img src="' + escapeHTML(targetUser.discordAvatarUrl) + '" alt="Аватар Discord" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid rgba(255,255,255,0.12);">'
                    : '<div style="width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(88,101,242,0.15); color:#c7d2fe; font-weight:700;">D</div>'),
                '<div style="min-width:0;">',
                    '<div style="font-weight:700; line-height:1.2;">' + escapeHTML(targetUser.discordUsername || 'Discord привязан') + '</div>',
                    '<div class="text-muted" style="font-size:0.85rem; margin-top:0.2rem;">ID: ' + escapeHTML(targetUser.discordId) + '</div>',
                '</div>',
            '</div>'
        ].join('')
        : '<div class="text-muted">Discord не привязан</div>';

    const actionButtons = [
        canArchive ? '<button class="btn btn-danger" onclick="archiveUser(\'' + targetUser.id + '\')">' + (targetUser.isPendingActivation ? 'Деактивировать' : 'Снять') + '</button>' : '',
        canResetPassword ? '<button class="btn btn-outline" onclick="openResetPasswordModal(\'' + targetUser.id + '\')">Сбросить пароль</button>' : ''
    ].filter(Boolean).join('');

    const extraButtons = [
        canToggleVacation ? '<button class="btn btn-outline" onclick="toggleUserVacation(\'' + targetUser.id + '\')">' + (isUserOnVacation(targetUser, currentCompanyId) ? 'Закончить отпуск' : 'Выдать отпуск') + '</button>' : ''
    ].filter(Boolean).join('');

    container.innerHTML = [
        '<div class="staff-profile-shell">',
            '<button type="button" class="staff-inline-back" onclick="setSelectedStaffProfileUser(null); sessionStorage.setItem(\'active_tab\', \'users\'); renderRoute();" aria-label="Вернуться к сотрудникам">',
                '<span class="staff-inline-back-icon" aria-hidden="true">←</span>',
                '<span class="staff-inline-back-text">Сотрудники сервера</span>',
            '</button>',
        '</div>',
        '<div class="profile-layout">',
            '<div class="profile-left-column">',
                '<div class="profile-card profile-card-vertical">',
            '<img src="' + getUserAvatarUrl(targetUser.username, 96) + '" class="avatar-large" style="object-fit:cover; image-rendering:pixelated; background:transparent;">',
                    '<div class="profile-identity">',
                        '<h3 class="profile-username">' + eUsername + '</h3>',
                        '<div class="profile-role-badge">' + getBadge(targetRoleId) + (targetUser.isPendingActivation ? getAccountStatusBadge(targetUser) : '') + '</div>',
                    '</div>',
                    '<div class="profile-stat-stack">',
                        pendingInviteCodeRow,
                        '<div class="profile-stat-row"><span>Должность</span><div class="profile-stat-value-wrap"><strong>' + currentRoleLabel + '</strong>' + roleEditButton + '</div></div>',
                        '<div class="profile-stat-row"><span>Выговоры</span><div class="profile-stat-value-wrap"><strong>' + reprimandCount + '</strong>' + reprimandControls + '</div></div>',
                        '<div class="profile-stat-row profile-stat-balance"><span>Баланс</span><div class="profile-stat-value-wrap"><strong>' + targetUser.coins + ' монет</strong>' + balanceEditButton + '</div></div>',
                    '</div>',
                    (actionButtons ? '<div class="staff-profile-actions">' + actionButtons + '</div>' : ''),
                '</div>',
                '<div class="glass-panel profile-side-panel">',
                    '<h4 style="margin-bottom:1rem;">Discord</h4>',
                    discordBlock,
                '</div>',
                (extraButtons ? '<div class="glass-panel profile-side-panel"><h4 style="margin-bottom:1rem;">Управление</h4>' + extraButtons + '</div>' : ''),
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
                            userRowsHtml,
                        '</tbody>',
                    '</table>',
                '</div>',
                '<div class="staff-profile-meta">',
                    '<span><strong>Дата входа:</strong> ' + new Date(targetUser.date).toLocaleDateString() + '</span>',
                    (isUserOnVacation(targetUser, currentCompanyId) ? '<span><strong>Отпуск:</strong> В отпуске</span>' : ''),
                    (isUserOnVacation(targetUser, currentCompanyId) ? '<span><strong>Вернется в роль:</strong> ' + escapeHTML(getRoleLabel(effectiveRoleId)) + '</span>' : ''),
                '</div>',
            '</div>',
        '</div>'
    ].join('');
}
