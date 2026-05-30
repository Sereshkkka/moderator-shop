window.openUserManagementModal = (targetUserId, section = 'overview') => {
    closeBalanceModal();
    openStaffProfileTab(targetUserId);
};

window.openBalanceModal = (targetUserId) => {
    openStaffProfileTab(targetUserId);
};

window.toggleUserVacation = (targetUserId) => {
    const targetUser = db.data.users.find(u => u.id === targetUserId);
    if (!targetUser) return;
    if (!canManageVacation(targetUser)) {
        showToast('У вас нет прав на управление отпуском этого пользователя.', 'error');
        return;
    }

    ensureUserCompanyRoles(targetUser);
    const vacationRoles = ensureUserVacationRoles(targetUser);
    const currentRoleId = getUserRoleForCompany(targetUser, currentCompanyId);

    if (currentRoleId === VACATION_ROLE_ID) {
        const restoreRoleId = vacationRoles[currentCompanyId] || 'helper';
        targetUser.companyRoles[currentCompanyId] = restoreRoleId;
        delete vacationRoles[currentCompanyId];
        if (targetUser.companyId === currentCompanyId) {
            targetUser.role = restoreRoleId;
        }
        db.save();
        showToast('Отпуск завершен. Пользователь вернулся к своей роли.');
    } else {
        vacationRoles[currentCompanyId] = currentRoleId || 'helper';
        targetUser.companyRoles[currentCompanyId] = VACATION_ROLE_ID;
        if (targetUser.companyId === currentCompanyId) {
            targetUser.role = VACATION_ROLE_ID;
        }
        db.save();
        showToast('Пользователь переведен в режим отпуска.');
    }

    const content = getDashboardContent();
    if (content) renderStaffProfile(content, targetUser);
};

window.closeBalanceModal = () => {
    const w = document.getElementById('balanceModalWrapper');
    if (!w) return;
    w.innerHTML = '';
    w.replaceChildren();
};

window.closeBalanceModalAndReturnToStaffProfile = (targetUserId) => {
    closeBalanceModal();
    if (targetUserId) {
        setTimeout(() => openStaffProfileTab(targetUserId), 0);
    }
};

window.executeBalanceEdit = async (targetUserId) => {
    const targetUser = db.data.users.find(u => u.id === targetUserId);
    if (!targetUser) return;

    const op = document.getElementById('bm_op')?.value || 'add';
    const amount = parseInt(document.getElementById('bm_amount').value) || 0;
    const rawReasonText = document.getElementById('bm_reason').value;
    if (rawReasonText.length > 20) {
        showToast('Причина не может быть длиннее 20 символов.', 'error');
        return;
    }
    const reasonText = rawReasonText.trim() || 'Без причины';

    const oldBal = targetUser.coins;
    let newBal = oldBal;

    if (op === 'add') newBal += amount;
    if (op === 'sub') newBal -= amount;
    if (op === 'set') newBal = amount;
    if (newBal < 0) newBal = 0;

    if (isSupabaseSessionActive()) {
        const authSession = authGateway.getStoredSession();
        if (!authSession || !authSession.access_token) {
            showToast('Нет активной Supabase-сессии для изменения баланса.', 'error');
            return;
        }
        try {
            const remoteUser = await authGateway.rpcAdjustBalance(authSession.access_token, {
                target_user_id: targetUserId,
                operation: op,
                amount: amount,
                reason_text: reasonText
            });
            if (remoteUser) {
                upsertLocalUser(remoteUser);
                if (currentUser.id === remoteUser.id) {
                    currentUser = db.data.users.find(u => u.id === remoteUser.id) || currentUser;
                }
            }
            await syncStaffReadSnapshot();
            showToast('Баланс обновлен через безопасный server-side RPC.');
            const content = getDashboardContent();
            if (content) renderStaffProfile(content, db.data.users.find(u => u.id === targetUserId) || targetUser);
            return;
        } catch (error) {
            showToast(error.message || 'Не удалось изменить баланс через RPC.', 'error');
            return;
        }
    }

    targetUser.coins = newBal;

    if (targetUser.id === currentUser.id) {
        currentUser.coins = newBal;
    }

    db.data.logs.push({
        id: db.generateId(),
        userId: targetUser.id,
        modifierId: currentUser.id,
        companyId: currentCompanyId,
        oldBalance: oldBal,
        newBalance: newBal,
        type: 'Manual Adjustment',
        reason: reasonText,
        date: new Date().toISOString()
    });

    db.save();
    showToast('Баланс обновлен для ' + targetUser.username);
    const activeTab = getActiveDashboardTab();
    const content = getDashboardContent();
    if (activeTab === 'users') renderUsers(content);
    if (activeTab === 'admin') renderUsers(content);
    if (activeTab === 'profile') renderProfile(content);
    if (activeTab === 'staffprofile') renderStaffProfile(content, targetUser);
    closeBalanceModal();
};

window.adjustUserReprimands = (targetUserId, delta) => {
    const targetUser = db.data.users.find(u => u.id === targetUserId);
    if (!targetUser) return;
    if (!canManageUserReprimands(targetUser)) {
        showToast('У вас нет прав на изменение выговоров этого сотрудника.', 'error');
        return;
    }

    const reprimands = ensureUserReprimands(targetUser);
    const currentCount = getUserReprimandCount(targetUser, currentCompanyId);
    const nextCount = Math.max(0, currentCount + delta);
    reprimands[currentCompanyId] = nextCount;
    if (nextCount === 0) {
        delete reprimands[currentCompanyId];
    }

    db.save();
    showToast(delta > 0 ? 'Выговор добавлен.' : 'Выговор снят.');
    const content = getDashboardContent();
    if (content) {
        const activeTab = getActiveDashboardTab();
        if (activeTab === 'store') renderStore(content);
        if (activeTab === 'cart') renderCart(content);
        const selectedStaffUser = getSelectedStaffProfileUser();
        if ((activeTab === 'staffprofile' || selectedStaffUser?.id === targetUser.id) && hasUserCompanyAccess(targetUser, currentCompanyId)) {
            sessionStorage.setItem('active_tab', 'staffprofile');
            renderStaffProfile(content, targetUser);
            return;
        }
        if (activeTab === 'users' || activeTab === 'admin') renderUsers(content);
    }
};

window.updateRole = async (uid) => {
    const newRole = document.getElementById('role_' + uid).value;
    const u = db.data.users.find(x => x.id === uid);
    if (u) {
        if (!canAssignRoleToUser(u, newRole)) {
            showToast('Только sereshkkka может выдавать или забирать роль главного администратора.', 'error');
            return;
        }

        if (newRole === PENDING_ROLE_ID) {
            showToast('Роль "Ожидание" нельзя менять вручную.', 'error');
            return;
        }

        if (isSupabaseSessionActive()) {
            const authSession = authGateway.getStoredSession();
            if (!authSession || !authSession.access_token) {
                showToast('Нет активной Supabase-сессии для смены роли.', 'error');
                return;
            }
            try {
                const remoteUser = await authGateway.rpcUpdateRole(authSession.access_token, {
                    target_user_id: uid,
                    new_role_id: newRole
                });
                if (remoteUser) {
                    upsertLocalUser(remoteUser);
                }
                await syncStaffReadSnapshot();
                showToast('Роль обновлена через безопасный server-side RPC.');
                closeBalanceModalAndReturnToStaffProfile(uid);
                return;
            } catch (error) {
                showToast(error.message || 'Не удалось изменить роль через RPC.', 'error');
                return;
            }
        }

        ensureUserCompanyRoles(u);
        u.companyRoles[currentCompanyId] = newRole;
        if (u.companyId === currentCompanyId) {
            u.role = newRole;
        }
        if (u.id === currentUser.id) {
            ensureUserCompanyRoles(currentUser);
            currentUser.companyRoles[currentCompanyId] = newRole;
            if (currentUser.companyId === currentCompanyId) {
                currentUser.role = newRole;
            }
        }
        if (newRole !== 'admin' && sessionStorage.getItem('active_tab') === 'globalctrl') {
            sessionStorage.setItem('active_tab', 'profile');
        }
        db.save();
        showToast('Роль на сервере обновлена.');
        closeBalanceModalAndReturnToStaffProfile(uid);
    }
};

window.archiveUser = (uid) => {
    const u = db.data.users.find(x => x.id === uid);
    if (!u) return;
    const isPendingUser = !!u.isPendingActivation;

    if (u.id === currentUser.id) {
        showToast('Вы не можете архивировать самого себя!', 'error');
        return;
    }

    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="bm_overlay">',
            '<div class="modal-content" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1.5rem">' + (isPendingUser ? 'Деактивация приглашения' : 'Снятие с должности') + '</h3>',
                '<p style="margin-bottom:1.5rem; line-height:1.5;">' + (isPendingUser ? 'Неактивированный аккаунт и его код приглашения будут деактивированы без отправки webhook. Продолжить?' : 'Пользователь будет деактивирован и помещен в архив. Продолжить?') + '</p>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-danger" onclick="executeArchiveUser(\'' + u.id + '\')">Подтвердить</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');

    document.getElementById('bm_overlay').onclick = closeBalanceModal;
};

window.executeArchiveUser = async (uid) => {
    const u = db.data.users.find(x => x.id === uid);
    if (u) {
        const isPendingUser = !!u.isPendingActivation;
        const archivedUserSnapshot = {
            ...u,
            companyRoles: u.companyRoles ? { ...u.companyRoles } : {},
            authorizedCompanies: Array.isArray(u.authorizedCompanies) ? [...u.authorizedCompanies] : [],
            archivedCompanies: u.archivedCompanies ? { ...u.archivedCompanies } : {}
        };
        if (isSupabaseSessionActive()) {
            const authSession = authGateway.getStoredSession();
            if (!authSession || !authSession.access_token) {
                showToast('Нет активной Supabase-сессии для архивации.', 'error');
                return;
            }
            try {
                if (isPendingUser && u.inviteCodeId) {
                    await authGateway.rpcDeleteCode(authSession.access_token, {
                        target_code_id: u.inviteCodeId
                    });
                } else {
                    await authGateway.rpcArchiveUser(authSession.access_token, {
                        target_user_id: uid
                    });
                }
                await syncStaffReadSnapshot();
                closeBalanceModal();
                showToast(isPendingUser ? 'Приглашение деактивировано.' : 'Пользователь отправлен в архив через безопасный server-side RPC.');
                const content = getDashboardContent();
                if (content) renderUsers(content);
                if (!isPendingUser) {
                    sendArchiveWebhook(archivedUserSnapshot, currentCompanyId, currentUser).catch((error) => {
                        console.error('Archive webhook failed', error);
                        showToast('Пользователь снят, но webhook не отправился.', 'error');
                    });
                }
                return;
            } catch (error) {
                showToast(error.message || (isPendingUser ? 'Не удалось деактивировать приглашение через RPC.' : 'Не удалось архивировать пользователя через RPC.'), 'error');
                return;
            }
        }
        if (isPendingUser && u.inviteCodeId) {
            db.data.users = db.data.users.filter(user => user.id !== uid);
            db.data.codes = db.data.codes.filter(code => code.id !== u.inviteCodeId);
            db.save();
            closeBalanceModal();
            showToast('Приглашение деактивировано.');
            const content = getDashboardContent();
            if (content) renderUsers(content);
            return;
        }
        const archivedCompanies = ensureUserArchivedCompanies(u);
        archivedCompanies[currentCompanyId] = true;
        db.data.logs.push({
            id: db.generateId(),
            userId: u.id,
            modifierId: currentUser.id,
            companyId: currentCompanyId,
            oldBalance: u.coins,
            newBalance: u.coins,
            type: 'Manual Adjustment',
            reason: 'Пользователь архивирован на сервере',
            date: new Date().toISOString()
        });
        db.save();
        closeBalanceModal();
        showToast('Пользователь ' + u.username + ' отправлен в архив на текущем сервере');
        const content = getDashboardContent();
        if (content) renderUsers(content);
        if (!isPendingUser) {
            sendArchiveWebhook(archivedUserSnapshot, currentCompanyId, currentUser).catch((error) => {
                console.error('Archive webhook failed', error);
                showToast('Пользователь снят, но webhook не отправился.', 'error');
            });
        }
    }
};

window.restoreUser = async (uid) => {
    const u = db.data.users.find(x => x.id === uid);
    if (u) {
        if (isSupabaseSessionActive()) {
            const authSession = authGateway.getStoredSession();
            if (!authSession || !authSession.access_token) {
                showToast('Нет активной Supabase-сессии для восстановления.', 'error');
                return;
            }
            try {
                await authGateway.rpcRestoreUser(authSession.access_token, {
                    target_user_id: uid
                });
                await syncStaffReadSnapshot();
                closeBalanceModal();
                showToast('Пользователь восстановлен через безопасный server-side RPC.');
                const content = getDashboardContent();
                if (content) renderArchive(content);
                return;
            } catch (error) {
                showToast(error.message || 'Не удалось восстановить пользователя через RPC.', 'error');
                return;
            }
        }
        const archivedCompanies = ensureUserArchivedCompanies(u);
        delete archivedCompanies[currentCompanyId];
        db.data.logs.push({
            id: db.generateId(),
            userId: u.id,
            modifierId: currentUser.id,
            companyId: currentCompanyId,
            oldBalance: u.coins,
            newBalance: u.coins,
            type: 'Manual Adjustment',
            reason: 'Пользователь восстановлен из архива на сервере',
            date: new Date().toISOString()
        });
        db.save();
        closeBalanceModal();
        showToast('Пользователь ' + u.username + ' восстановлен');
        const content = getDashboardContent();
        if (content) renderArchive(content);
    }
};

window.deleteArchivedUser = (uid) => {
    const u = db.data.users.find(x => x.id === uid);
    if (!u) return;
    const currentAccess = Array.isArray(u.authorizedCompanies) && u.authorizedCompanies.length
        ? [...new Set(u.authorizedCompanies)]
        : [u.companyId].filter(Boolean);
    const remainingCompanyIds = currentAccess.filter(companyId => companyId !== currentCompanyId);
    const isLastServer = remainingCompanyIds.length === 0;

    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="bm_overlay">',
            '<div class="modal-content" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1.5rem">' + (isLastServer ? 'Полное удаление пользователя' : 'Удаление с текущего сервера') + '</h3>',
                '<p style="margin-bottom:1rem; line-height:1.5;">' +
                    (isLastServer
                        ? 'Вы собираетесь навсегда удалить аккаунт <strong>' + escapeHTML(u.username) + '</strong> из системы.'
                        : 'Вы собираетесь убрать пользователя <strong>' + escapeHTML(u.username) + '</strong> с текущего сервера. На остальных серверах он останется.') +
                '</p>',
                '<p style="margin-bottom:1.5rem; color:var(--danger); line-height:1.5;">' +
                    (isLastServer
                        ? 'Это действие необратимо. Будут удалены сам пользователь, его логи, корзина и связанные коды ожидания.'
                        : 'Доступ к текущему серверу будет удален. Если это был его основной сервер, система выберет другой доступный сервер автоматически.') +
                '</p>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-danger" onclick="executeDeleteArchivedUser(\'' + u.id + '\')">' + (isLastServer ? 'Удалить навсегда' : 'Удалить с сервера') + '</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');

    document.getElementById('bm_overlay').onclick = closeBalanceModal;
};

window.openBalanceEditModal = (targetUserId) => {
    const targetUser = db.data.users.find(u => u.id === targetUserId);
    if (!targetUser) return;
    if (!canManageUserBalance(targetUser)) {
        showToast('У вас нет прав для изменения баланса этого сотрудника.', 'error');
        return;
    }

    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="bm_overlay">',
            '<div class="modal-content" style="max-width:520px" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1rem;">Изменение баланса</h3>',
                '<div class="form-group">',
                    '<label>Модификатор</label>',
                    '<input type="hidden" id="bm_op" value="add">',
                    '<div class="modifier-toggle-row" id="bm_op_toggle">',
                        '<button class="modifier-toggle-btn active" type="button" data-op="add">+</button>',
                        '<button class="modifier-toggle-btn" type="button" data-op="set">=</button>',
                        '<button class="modifier-toggle-btn" type="button" data-op="sub">-</button>',
                    '</div>',
                '</div>',
                '<div class="form-group">',
                    '<label>Количество</label>',
                    '<input type="number" id="bm_amount" class="form-control" value="0" min="0" style="background-color:rgba(0,0,0,0.6)">',
                '</div>',
                '<div class="form-group">',
                    '<label>Причина</label>',
                    '<input type="text" id="bm_reason" class="form-control" maxlength="20" placeholder="Например: премия" style="background-color:rgba(0,0,0,0.6)">',
                '</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" onclick="executeBalanceEdit(\'' + targetUserId + '\')">Сохранить</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModalAndReturnToStaffProfile(\'' + targetUserId + '\')">Назад</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
    document.getElementById('bm_overlay').onclick = () => closeBalanceModalAndReturnToStaffProfile(targetUserId);
    const toggleRoot = document.getElementById('bm_op_toggle');
    const hiddenInput = document.getElementById('bm_op');
    if (toggleRoot && hiddenInput) {
        toggleRoot.querySelectorAll('.modifier-toggle-btn').forEach((btn) => {
            btn.onclick = () => {
                hiddenInput.value = btn.dataset.op || 'add';
                toggleRoot.querySelectorAll('.modifier-toggle-btn').forEach(node => node.classList.remove('active'));
                btn.classList.add('active');
            };
        });
    }
};

window.openRoleEditModal = (uid) => {
    const u = db.data.users.find(x => x.id === uid);
    if (!u) return;
    if (!canManageUserRole(u)) {
        showToast('Роль этого сотрудника нельзя менять из вашей текущей должности.', 'error');
        return;
    }
    const roleOptions = getAssignableRoles(u);
    if (isPrimaryOwner() && db.data.roles.some(role => role.id === 'admin') && !roleOptions.includes('admin')) {
        roleOptions.push('admin');
    }
    let optionsHtml = roleOptions.map(rid => {
        const rObj = db.data.roles.find(x => x.id === rid);
        const selected = getUserRoleForCompany(u, currentCompanyId) === rid ? ' selected' : '';
        const roleText = rObj ? escapeHTML(rObj.label) : escapeHTML(rid);
        return '<option value="' + rid + '"' + selected + '>' + roleText + '</option>';
    }).join('');
    if (!roleOptions.includes(getUserRoleForCompany(u, currentCompanyId))) {
        const currentRoleObj = db.data.roles.find(x => x.id === getUserRoleForCompany(u, currentCompanyId));
        const currentRoleText = currentRoleObj ? escapeHTML(currentRoleObj.label) : escapeHTML(getUserRoleForCompany(u, currentCompanyId));
        optionsHtml = '<option value="' + getUserRoleForCompany(u, currentCompanyId) + '" selected>' + currentRoleText + '</option>' + optionsHtml;
    }

    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="bm_overlay">',
            '<div class="modal-content" style="max-width:520px" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1rem;">Изменение должности</h3>',
                '<div class="form-group">',
                    '<label>Новая роль</label>',
                    '<select class="form-control" id="role_' + uid + '" style="background-color:rgba(0,0,0,0.6)">',
                        optionsHtml,
                    '</select>',
                '</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" onclick="updateRole(\'' + uid + '\')">Сохранить</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModalAndReturnToStaffProfile(\'' + uid + '\')">Назад</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
    document.getElementById('bm_overlay').onclick = () => closeBalanceModalAndReturnToStaffProfile(uid);
};

window.executeDeleteArchivedUser = async (uid) => {
    const u = db.data.users.find(x => x.id === uid);
    if (!u) return;
    const deletedUserSnapshot = {
        ...u,
        companyRoles: u.companyRoles ? { ...u.companyRoles } : {},
        authorizedCompanies: Array.isArray(u.authorizedCompanies) ? [...u.authorizedCompanies] : [],
        archivedCompanies: u.archivedCompanies ? { ...u.archivedCompanies } : {}
    };
    const currentAccess = Array.isArray(u.authorizedCompanies) && u.authorizedCompanies.length
        ? [...new Set(u.authorizedCompanies)]
        : [u.companyId].filter(Boolean);
    const remainingCompanyIds = currentAccess.filter(companyId => companyId !== currentCompanyId);
    const isLastServer = remainingCompanyIds.length === 0;

    if (isSupabaseSessionActive()) {
        const authSession = authGateway.getStoredSession();
        if (!authSession || !authSession.access_token) {
            showToast('Нет активной Supabase-сессии для удаления пользователя.', 'error');
            return;
        }
        try {
            await authGateway.rpcDeleteArchivedUser(authSession.access_token, {
                target_user_id: uid
            });
            await syncStaffReadSnapshot();
            closeBalanceModal();
            showToast('Архивированный пользователь удален через безопасный server-side RPC.');
            const content = getDashboardContent();
            if (content) renderArchive(content);
            return;
        } catch (error) {
            showToast(error.message || 'Не удалось удалить архивированного пользователя через RPC.', 'error');
            return;
        }
    }

    if (!isLastServer) {
        u.authorizedCompanies = remainingCompanyIds;
        if (u.companyRoles && typeof u.companyRoles === 'object') {
            delete u.companyRoles[currentCompanyId];
        }
        if (u.vacationRoles && typeof u.vacationRoles === 'object') {
            delete u.vacationRoles[currentCompanyId];
        }
        if (u.archivedCompanies && typeof u.archivedCompanies === 'object') {
            delete u.archivedCompanies[currentCompanyId];
        }
        if (u.companyId === currentCompanyId) {
            u.companyId = remainingCompanyIds[0] || u.companyId;
            if (u.companyId) {
                u.role = getUserRoleForCompany(u, u.companyId);
            }
        }
        db.data.codes = db.data.codes.filter(c => !(c.companyId === currentCompanyId && (c.username === u.username || c.generatedFor === u.username)));
        db.save();
        closeBalanceModal();
        showToast('Пользователь ' + u.username + ' удален с текущего сервера.');
        const content = getDashboardContent();
        if (content) renderArchive(content);
        return;
    }

    db.data.logs = db.data.logs.filter(l => l.userId !== uid && l.modifierId !== uid);
    db.data.codes = db.data.codes.filter(c => c.userId !== uid && c.username !== u.username && c.generatedFor !== u.username);
    db.data.users = db.data.users.filter(x => x.id !== uid);

    if (currentUser && currentUser.id === uid) {
        currentUser = null;
        try { sessionStorage.removeItem('session_user_id'); } catch (err) {}
    }

    db.save();
    closeBalanceModal();
    showToast('Пользователь ' + u.username + ' удален навсегда.');
    const content = getDashboardContent();
    if (content) renderArchive(content);
};

window.openArchivedUserModal = (uid) => {
    const u = db.data.users.find(x => x.id === uid);
    if (!u || !isUserArchivedOnCompany(u, currentCompanyId)) return;

    const modalWrapper = ensureBalanceModalWrapper();

    const eUsername = escapeHTML(u.username);
    const roleLabel = escapeHTML((db.data.roles.find(r => r.id === getUserRoleForCompany(u, currentCompanyId)) || { label: getUserRoleForCompany(u, currentCompanyId) }).label);
    const discordDisplay = u.discordId
        ? '<strong>' + escapeHTML(u.discordId) + '</strong>'
        : '<strong style="color:var(--text-muted)">Не привязан</strong>';

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="bm_overlay">',
            '<div class="modal-content" style="max-width:860px" onclick="event.stopPropagation()">',
                '<div class="staff-user-header" style="margin-bottom:1.5rem;">',
            '<img src="' + getUserAvatarUrl(u.username, 96) + '" class="staff-user-avatar" style="object-fit:cover; image-rendering:pixelated;">',
                    '<div class="staff-user-meta">',
                        '<h3>' + eUsername + '</h3>',
                        '<div class="staff-user-badges">' + getBadge(getUserRoleForCompany(u, currentCompanyId)) + '</div>',
                        '<div class="staff-user-summary">',
                            '<span><strong>Монеты:</strong> ' + u.coins + '</span>',
                            '<span><strong>Discord:</strong> ' + discordDisplay + '</span>',
                            '<span><strong>Дата входа:</strong> ' + new Date(u.date).toLocaleDateString() + '</span>',
                        '</div>',
                    '</div>',
                '</div>',
                '<div class="archive-modal-grid">',
                    '<div class="staff-modal-panel">',
                        '<h4>Информация</h4>',
                        '<div class="staff-user-facts">',
                            '<div><span>Логин</span><strong>' + eUsername + '</strong></div>',
                            '<div><span>Роль на этом сервере</span><strong>' + roleLabel + '</strong></div>',
                            '<div><span>Состояние</span><strong>В архиве</strong></div>',
                        '</div>',
                    '</div>',
                    '<div class="staff-modal-panel">',
                        '<h4>Действия</h4>',
                        '<p class="text-muted" style="margin-bottom:1rem;">Вы можете восстановить пользователя на текущем сервере или полностью удалить его из системы.</p>',
                        '<button class="btn btn-primary" onclick="restoreUser(\'' + u.id + '\')">Восстановить</button>',
                        '<button class="btn btn-danger staff-archive-btn" onclick="deleteArchivedUser(\'' + u.id + '\')">Удалить</button>',
                    '</div>',
                '</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Закрыть</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');

    document.getElementById('bm_overlay').onclick = closeBalanceModal;
};
