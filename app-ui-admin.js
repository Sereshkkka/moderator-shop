function renderArchive(container) {
    let archivedUsers = db.data.users.filter(u => hasUserCompanyAccess(u, currentCompanyId) && isUserArchivedOnCompany(u, currentCompanyId));
    if (!canViewInvisibleUsers()) {
        archivedUsers = archivedUsers.filter(u => !isInvisibleUser(u, currentCompanyId));
    }

    const tiles = archivedUsers.map(u => {
        const eUsername = escapeHTML(u.username);
        return [
            '<button class="staff-tile" onclick="openArchivedUserModal(\'' + u.id + '\')">',
                '<img src="' + getUserAvatarUrl(u.username, 32) + '" class="staff-tile-avatar" style="object-fit:cover; image-rendering:pixelated; background:transparent;">',
                '<div class="staff-tile-name">' + eUsername + '</div>',
                '<div class="staff-tile-badges">',
                    getBadge(getUserRoleForCompany(u, currentCompanyId)),
                '</div>',
                '<div class="staff-tile-meta">',
                    '<span>' + u.coins + ' монет</span>',
                    '<span>' + new Date(u.date).toLocaleDateString() + '</span>',
                '</div>',
            '</button>'
        ].join('');
    }).join('');

    container.innerHTML = [
        '<h3 class="mb-3">Архив Пользователей</h3>',
        '<p class="mb-3 text-muted">Здесь находятся деактивированные аккаунты. Вы можете восстановить их в любой момент.</p>',
        (tiles
            ? '<div class="staff-grid">' + tiles + '</div>'
            : '<div class="glass-panel" style="padding:1.25rem; color:var(--text-muted);">Архив текущего сервера пуст.</div>')
    ].join('');
}

function renderGlobalControl(container) {
    if (isSupabaseSessionActive()) {
        const allowedTabs = ['servers', 'users', 'config'];
        const storedSubTab = sessionStorage.getItem('global_sub_tab') || 'servers';
        const activeSubTab = allowedTabs.includes(storedSubTab) ? storedSubTab : 'servers';

        container.innerHTML = [
            '<h3 class="mb-3">Панель управления</h3>',
            '<div class="glass-panel mb-4" style="max-width:100%; padding:1.25rem; border:1px solid rgba(59,130,246,0.35); background:rgba(59,130,246,0.10); color:#bfdbfe;">',
                '<strong>Supabase Auth safe mode.</strong>',
                '<p style="margin-top:0.75rem; color:#dbeafe;">В этом разделе уже включены безопасные server-side действия для серверов, webhook-настроек и доступа сотрудников. Глобальные роли и destructive user-операции пока по-прежнему скрыты, пока для них не будет такого же безопасного backend-потока.</p>',
            '</div>',
            '<div class="tab-headers mb-4" style="border-bottom:1px solid var(--border)">',
                '<div class="tab-header ' + (activeSubTab === 'servers' ? 'active' : '') + '" data-sub="servers">Серверы</div>',
                '<div class="tab-header ' + (activeSubTab === 'users' ? 'active' : '') + '" data-sub="users">Доступы</div>',
                '<div class="tab-header ' + (activeSubTab === 'config' ? 'active' : '') + '" data-sub="config">Webhook</div>',
            '</div>',
            '<div id="globalHubContent"></div>'
        ].join('');

        const hubContent = document.getElementById('globalHubContent');
        const switchSubTab = (st) => {
            sessionStorage.setItem('global_sub_tab', st);
            document.querySelectorAll('.tab-header[data-sub]').forEach(el => el.classList.remove('active'));
            const activeHeader = document.querySelector('.tab-header[data-sub="' + st + '"]');
            if (activeHeader) activeHeader.classList.add('active');

            if (st === 'servers') renderGlobalServers(hubContent);
            if (st === 'users') renderGlobalUsers(hubContent);
            if (st === 'config') renderGlobalSettings(hubContent);
        };

        document.querySelectorAll('.tab-header[data-sub]').forEach(el => {
            el.onclick = () => switchSubTab(el.getAttribute('data-sub'));
        });

        switchSubTab(activeSubTab);
        return;
    }

    const activeSubTab = sessionStorage.getItem('global_sub_tab') || 'servers';

    container.innerHTML = [
        '<h3 class="mb-3">Панель управления</h3>',
        '<div class="tab-headers mb-4" style="border-bottom:1px solid var(--border)">',
            '<div class="tab-header ' + (activeSubTab === 'servers' ? 'active' : '') + '" data-sub="servers">Серверы</div>',
            '<div class="tab-header ' + (activeSubTab === 'users' ? 'active' : '') + '" data-sub="users">Все Пользователи</div>',
            '<div class="tab-header ' + (activeSubTab === 'groups' ? 'active' : '') + '" data-sub="groups">Группы и Права</div>',
            '<div class="tab-header ' + (activeSubTab === 'config' ? 'active' : '') + '" data-sub="config">Настройки</div>',
            '<div class="tab-header ' + (activeSubTab === 'audit' ? 'active' : '') + '" data-sub="audit">Мастер-Лог</div>',
        '</div>',
        '<div id="globalHubContent"></div>'
    ].join('');

    const hubContent = document.getElementById('globalHubContent');

    const switchSubTab = (st) => {
        sessionStorage.setItem('global_sub_tab', st);
        document.querySelectorAll('.tab-header[data-sub]').forEach(el => el.classList.remove('active'));
        document.querySelector('.tab-header[data-sub="' + st + '"]').classList.add('active');

        if (st === 'servers') renderGlobalServers(hubContent);
        if (st === 'users') renderGlobalUsers(hubContent);
        if (st === 'groups') renderGlobalRoles(hubContent);
        if (st === 'config') renderGlobalSettings(hubContent);
        if (st === 'audit') renderGlobalAudit(hubContent);
    };

    document.querySelectorAll('.tab-header[data-sub]').forEach(el => {
        el.onclick = () => switchSubTab(el.getAttribute('data-sub'));
    });

    switchSubTab(activeSubTab);
}

function renderGlobalServers(container) {
    const rows = [...db.data.companies].map(buildGlobalServerRow).join('');

    container.innerHTML = [
        '<div class="flex-between mb-3">',
            '<h4>Игровые Сервера</h4>',
            '<div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">',
                '<input type="text" id="new_company_name" class="form-control" placeholder="Название нового сервера..." style="width:250px;">',
                '<button class="btn btn-success" onclick="createNewCompany()">Создать</button>',
            '</div>',
        '</div>',
        '<div class="table-container">',
            '<table>',
                '<thead>',
                    '<tr><th>Имя</th><th>Юзеров</th><th>Магазин</th><th>Управление</th></tr>',
                '</thead>',
                '<tbody>' + rows + '</tbody>',
            '</table>',
        '</div>'
    ].join('');
}

function renderGlobalUsers(container) {
    const remoteMode = isSupabaseSessionActive();
    const allUsers = [...db.data.users].sort((a, b) => a.username.localeCompare(b.username));

    const rows = allUsers.map(u => {
        const authCount = u.authorizedCompanies ? u.authorizedCompanies.length : 1;
        const eUsername = escapeHTML(u.username);
        const discordDisplay = u.discordId ? ('<code>' + escapeHTML(u.discordId) + '</code>') : '<span style="color:var(--text-muted)">Не привязан</span>';
        const canResetPassword = canResetManagedUserPassword(u);
        const scopedRoleId = hasUserCompanyAccess(u, currentCompanyId) ? getUserRoleForCompany(u, currentCompanyId) : null;
        const scopedRoleHtml = scopedRoleId
            ? getBadge(scopedRoleId)
            : '<span style="color:var(--text-muted)">Нет доступа</span>';
        const actionHtml = canResetPassword
            ? '<button class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.875rem" onclick="openResetPasswordModal(\'' + u.id + '\')">Сбросить пароль</button>'
            : (remoteMode
                ? '<span style="color:var(--text-muted)">Недоступно</span>'
                : '<button class="btn btn-danger" style="padding:0.25rem 0.5rem" onclick="globalDeleteUser(\'' + u.id + '\')">Удалить</button>');
        return [
            '<tr>',
                '<td>' + eUsername + '</td>',
                '<td>' + scopedRoleHtml + '</td>',
                '<td>' + u.coins + '</td>',
                '<td>' + discordDisplay + '</td>',
                '<td>',
                    '<button class="btn btn-primary" style="padding:0.25rem 0.6rem; font-size:0.875rem" onclick="openAccessModal(\'' + u.id + '\')">Доступ (' + authCount + ')</button>',
                '</td>',
                '<td><button class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.875rem" onclick="openDiscordEditModal(\'' + u.id + '\')">Discord</button></td>',
                '<td>' + actionHtml + '</td>',
            '</tr>'
        ].join('');
    }).join('');

    container.innerHTML = [
        '<h4>Все пользователи ModShop</h4>',
        '<div class="glass-panel mb-3" style="max-width:100%; padding:1rem 1.25rem; border:1px solid rgba(59,130,246,0.28); background:rgba(59,130,246,0.10); color:#bfdbfe;">Сброс пароля доступен только ролям выше GM. Система генерирует новый простой числовой пароль, который вы передаете пользователю вручную.</div>',
        '<div class="table-container">',
            '<table>',
                '<thead>',
                    '<tr><th>Имя</th><th>Роль</th><th>Баланс</th><th>Discord</th><th>Доступ</th><th>Изменить</th><th>Действие</th></tr>',
                '</thead>',
                '<tbody>' + rows + '</tbody>',
            '</table>',
        '</div>'
    ].join('');
}

function renderGlobalAudit(container) {
    const masterLogs = [...db.data.logs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

    const rows = masterLogs.map(l => {
        const comp = db.data.companies.find(c => c.id === l.companyId)?.name || 'Н/Д';
        const target = db.data.users.find(u => u.id === l.userId)?.username || 'Н/Д';
        const modifier = db.data.users.find(u => u.id === l.modifierId)?.username || 'Н/Д';
        return [
            '<tr>',
                '<td>' + new Date(l.date).toLocaleString() + '</td>',
                '<td>' + escapeHTML(comp) + '</td>',
                '<td>' + escapeHTML(target) + '</td>',
                '<td>' + escapeHTML(modifier) + '</td>',
                '<td>' + escapeHTML(l.reason) + '</td>',
                '<td>' + (l.newBalance - l.oldBalance) + '</td>',
            '</tr>'
        ].join('');
    }).join('');

    container.innerHTML = [
        '<h4>Мастер-Лог (Последние 50 операций)</h4>',
        '<div class="table-container">',
            '<table>',
                '<thead>',
                    '<tr><th>Дата</th><th>Сервер</th><th>Цель</th><th>Выполнил</th><th>Детали</th><th>Импакт</th></tr>',
                '</thead>',
                '<tbody>' + rows + '</tbody>',
            '</table>',
        '</div>'
    ].join('');
}

function renderGlobalRoles(container) {
    const rows = db.data.roles.sort((a, b) => b.tier - a.tier).map(r => {
        const isProtected = r.id === 'admin' || r.id === PENDING_ROLE_ID || r.id === VACATION_ROLE_ID;
        return [
            '<tr>',
                '<td>' + getBadge(r.id) + '</td>',
                '<td>Уровень ' + r.tier + '</td>',
                '<td>' + r.perms.length + (r.perms.includes('all') ? ' (Полный доступ)' : ' прав') + '</td>',
                '<td>',
                    '<div style="display:flex; gap:0.5rem;">',
                        '<button class="btn btn-primary" style="padding:0.25rem 0.5rem" onclick="openRoleModal(\'' + r.id + '\')">Права</button>',
                        !isProtected ? '<button class="btn btn-danger" style="padding:0.25rem 0.5rem" onclick="deleteLocalRole(\'' + r.id + '\')">X</button>' : '',
                    '</div>',
                '</td>',
            '</tr>'
        ].join('');
    }).join('');

    container.innerHTML = [
        '<div class="flex-between mb-3">',
            '<h4>Настройка Групп и Прав</h4>',
            '<button class="btn btn-success" onclick="openRoleModal()">+ Новая Группа</button>',
        '</div>',
        '<div class="table-container">',
            '<table>',
                '<thead>',
                    '<tr><th>Группа</th><th>Уровень</th><th>Права</th><th>Управление</th></tr>',
                '</thead>',
                '<tbody>' + rows + '</tbody>',
            '</table>',
        '</div>'
    ].join('');
}

function renderGlobalSettings(container) {
    const usingDatabaseSync = USE_SERVER_DATABASE_SYNC;
    const usingLocalWebhookRelay = USE_LOCAL_WEBHOOK_RELAY;
    const systemConfig = normalizeSystemConfig(db.data.systemConfig);
    const eWebhook = escapeHTML(systemConfig.webhookUrl);
    const eAvatarTemplate = escapeHTML(systemConfig.avatarUrlTemplate);
    const previewUser = currentUser && currentUser.username ? currentUser.username : 'Steve';

    container.innerHTML = [
        '<h4>Глобальные настройки системы</h4>',
        '<div class="glass-panel" style="padding:1.5rem; max-width:760px">',
            '<div style="display:grid; gap:1rem;">',
                '<div style="padding:1rem 1.1rem; border-radius:12px; border:1px solid rgba(96,165,250,0.28); background:rgba(96,165,250,0.10); color:#dbeafe;">',
                    '<strong>Подключение PostgreSQL</strong><br>',
                    '<span style="font-size:0.9rem; color:#bfdbfe;">',
                        (usingDatabaseSync
                            ? 'Подключено. Сайт загружает и сохраняет данные в PostgreSQL на VPS.'
                            : 'Отключена. Сейчас проект не использует серверную базу.'),
                    '</span>',
                '</div>',
                '<div style="padding:1rem 1.1rem; border-radius:12px; border:1px solid rgba(16,185,129,0.28); background:rgba(16,185,129,0.10); color:#bbf7d0;">',
                    '<strong>Webhook relay</strong><br>',
                    '<span style="font-size:0.9rem; color:#d1fae5;">',
                        (usingLocalWebhookRelay
                            ? 'Включен. Покупки отправляют webhook через Node-сервер.'
                            : 'Отключен.'),
                    '</span>',
                '</div>',
                '<label style="display:grid; gap:0.45rem;">',
                    '<span style="font-weight:600;">Глобальный webhook</span>',
                    '<input id="sys_webhook" class="form-control" value="' + eWebhook + '" placeholder="https://discord.com/api/webhooks/...">',
                '</label>',
                '<label style="display:grid; gap:0.45rem;">',
                    '<span style="font-weight:600;">Шаблон ссылки аватарок</span>',
                    '<input id="sys_avatar_template" class="form-control" value="' + eAvatarTemplate + '" placeholder="https://example.com/avatar/{username}">',
                    '<span style="font-size:0.88rem; color:var(--text-muted);">Используйте <code>{username}</code> или <code>insert</code> вместо ника. Размер подставится автоматически.</span>',
                '</label>',
                '<div style="display:flex; align-items:center; gap:0.75rem;">',
                    '<img src="' + getUserAvatarUrl(previewUser, 32) + '" class="user-avatar" style="object-fit:cover; image-rendering:pixelated; background:transparent;">',
                    '<span style="font-size:0.88rem; color:var(--text-muted);">Предпросмотр для ' + escapeHTML(previewUser) + '</span>',
                '</div>',
                '<div style="display:flex; justify-content:flex-end;">',
                    '<button class="btn btn-primary" onclick="saveSystemConfig()">Сохранить настройки</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
}

function renderGlobalSettings(container) {
    const usingPostgres = USE_LOCAL_POSTGRES_SYNC;
    const usingLocalWebhookRelay = USE_LOCAL_WEBHOOK_RELAY;
    container.innerHTML = [
        '<h4>Глобальные Настройки Системы</h4>',
        '<div class="glass-panel" style="padding:1.5rem; max-width:700px">',
            '<div style="display:grid; gap:1rem;">',
                '<div style="padding:1rem 1.1rem; border-radius:12px; border:1px solid rgba(96,165,250,0.28); background:rgba(96,165,250,0.10); color:#dbeafe;">',
                    '<strong>Подключение PostgreSQL</strong><br>',
                    '<span style="font-size:0.9rem; color:#bfdbfe;">',
                        (usingPostgres
                            ? 'Подключена. Сайт автоматически загружает и сохраняет данные в локальный PostgreSQL.'
                            : 'Отключена. Сейчас проект не использует локальный PostgreSQL.'),
                    '</span>',
                '</div>',
                '<div style="padding:1rem 1.1rem; border-radius:12px; border:1px solid rgba(16,185,129,0.28); background:rgba(16,185,129,0.10); color:#bbf7d0;">',
                    '<strong>Webhook relay</strong><br>',
                    '<span style="font-size:0.9rem; color:#d1fae5;">',
                        (usingLocalWebhookRelay
                            ? 'Включен. Покупки отправляют webhook через локальный Node-сервер.'
                            : 'Отключен.'),
                    '</span>',
                '</div>',
                '<div style="padding:1rem 1.1rem; border-radius:12px; border:1px solid rgba(148,163,184,0.22); background:rgba(148,163,184,0.08); color:var(--text-muted);">',
                    '<strong>Локальное хранилище браузера</strong><br>',
                    '<span style="font-size:0.9rem;">Полный snapshot в localStorage отключен. Основные данные берутся из локальной PostgreSQL-базы.</span>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
}

function renderGlobalSettings(container) {
    const usingPostgres = USE_LOCAL_POSTGRES_SYNC;
    const usingLocalWebhookRelay = USE_LOCAL_WEBHOOK_RELAY;
    const systemConfig = normalizeSystemConfig(db.data.systemConfig);
    const eWebhook = escapeHTML(systemConfig.webhookUrl);
    const eAvatarTemplate = escapeHTML(systemConfig.avatarUrlTemplate);
    container.innerHTML = [
        '<h4>Глобальные Настройки Системы</h4>',
        '<div class="glass-panel" style="padding:1.5rem; max-width:700px">',
            '<div style="display:grid; gap:1rem;">',
                '<div style="padding:1rem 1.1rem; border-radius:12px; border:1px solid rgba(96,165,250,0.28); background:rgba(96,165,250,0.10); color:#dbeafe;">',
                    '<strong>Подключение PostgreSQL</strong><br>',
                    '<span style="font-size:0.9rem; color:#bfdbfe;">',
                        (usingPostgres
                            ? 'Подключена. Сайт автоматически загружает и сохраняет данные в локальный PostgreSQL.'
                            : 'Отключена. Сейчас проект не использует локальный PostgreSQL.'),
                    '</span>',
                '</div>',
                '<div style="padding:1rem 1.1rem; border-radius:12px; border:1px solid rgba(16,185,129,0.28); background:rgba(16,185,129,0.10); color:#bbf7d0;">',
                    '<strong>Webhook relay</strong><br>',
                    '<span style="font-size:0.9rem; color:#d1fae5;">',
                        (usingLocalWebhookRelay
                            ? 'Включен. Покупки отправляют webhook через локальный Node-сервер.'
                            : 'Отключен.'),
                    '</span>',
                '</div>',
                '<div style="padding:1rem 1.1rem; border-radius:12px; border:1px solid rgba(148,163,184,0.22); background:rgba(148,163,184,0.08); color:var(--text-muted);">',
                    '<strong>Локальное хранилище браузера</strong><br>',
                    '<span style="font-size:0.9rem;">Полный snapshot в localStorage отключен. Основные данные берутся из локальной PostgreSQL-базы.</span>',
                '</div>',
                '<label style="display:grid; gap:0.45rem;">',
                    '<span style="font-weight:600;">Глобальный webhook</span>',
                    '<input id="sys_webhook" class="form-control" value="' + eWebhook + '" placeholder="https://discord.com/api/webhooks/...">',
                '</label>',
                '<label style="display:grid; gap:0.45rem;">',
                    '<span style="font-weight:600;">Шаблон ссылки аватарок</span>',
                    '<input id="sys_avatar_template" class="form-control" value="' + eAvatarTemplate + '" placeholder="https://example.com/avatar/insert?size=size">',
                    '<span style="font-size:0.88rem; color:var(--text-muted);">Используйте <code>insert</code> вместо ника. Можно также добавить <code>size</code>, чтобы система сама подставляла 32 или 96.</span>',
                '</label>',
                '<div style="display:flex; justify-content:flex-end;">',
                    '<button class="btn btn-primary" onclick="saveSystemConfig()">Сохранить настройки</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
}

function buildGlobalServerRow(c) {
    const cUsers = db.data.users.filter(u => u.companyId === c.id).length;
    const cItems = db.data.items.filter(i => i.companyId === c.id).length;
    const eCompName = escapeHTML(c.name);
    return [
        '<tr data-company-id="' + c.id + '">',
            '<td><strong>' + eCompName + '</strong></td>',
            '<td>' + cUsers + '</td>',
            '<td>' + cItems + '</td>',
            '<td>',
                '<div style="display:flex; gap:0.5rem; flex-wrap:wrap">',
                    '<button class="btn btn-primary" style="padding:0.25rem 0.5rem; font-size:0.75rem" onclick="openCompanyRenameModal(\'' + c.id + '\')">Имя</button>',
                    '<button class="btn btn-outline" style="padding:0.25rem 0.5rem; font-size:0.75rem" onclick="openServerWebhookModal(\'' + c.id + '\')">Webhook</button>',
                    '<button class="btn btn-danger" style="padding:0.25rem 0.5rem; font-size:0.75rem" onclick="openCompanyDeleteModal(\'' + c.id + '\')">Удалить</button>',
                '</div>',
            '</td>',
        '</tr>'
    ].join('');
}

function renderGlobalSettings(container) {
    const usingDatabaseSync = USE_SERVER_DATABASE_SYNC;
    const usingLocalWebhookRelay = USE_LOCAL_WEBHOOK_RELAY;
    const systemConfig = normalizeSystemConfig(db.data.systemConfig);
    const eWebhook = escapeHTML(systemConfig.webhookUrl);
    const eAvatarTemplate = escapeHTML(systemConfig.avatarUrlTemplate);
    const previewUser = currentUser && currentUser.username ? currentUser.username : 'Steve';

    container.innerHTML = [
        '<h4>Глобальные настройки системы</h4>',
        '<div class="glass-panel" style="padding:1.5rem; max-width:760px">',
            '<div style="display:grid; gap:1rem;">',
                '<div style="padding:1rem 1.1rem; border-radius:12px; border:1px solid rgba(96,165,250,0.28); background:rgba(96,165,250,0.10); color:#dbeafe;">',
                    '<strong>Подключение PostgreSQL</strong><br>',
                    '<span style="font-size:0.9rem; color:#bfdbfe;">' + (usingDatabaseSync ? 'Подключено. Данные сохраняются в PostgreSQL на VPS.' : 'Отключено.') + '</span>',
                '</div>',
                '<div style="padding:1rem 1.1rem; border-radius:12px; border:1px solid rgba(16,185,129,0.28); background:rgba(16,185,129,0.10); color:#bbf7d0;">',
                    '<strong>Webhook relay</strong><br>',
                    '<span style="font-size:0.9rem; color:#d1fae5;">' + (usingLocalWebhookRelay ? 'Включен. Webhook отправляется через Node-сервер.' : 'Отключен.') + '</span>',
                '</div>',
                '<label style="display:grid; gap:0.45rem;">',
                    '<span style="font-weight:600;">Глобальный webhook</span>',
                    '<input id="sys_webhook" class="form-control" value="' + eWebhook + '" placeholder="https://discord.com/api/webhooks/...">',
                '</label>',
                '<label style="display:grid; gap:0.45rem;">',
                    '<span style="font-weight:600;">Шаблон ссылки аватарок</span>',
                    '<input id="sys_avatar_template" class="form-control" value="' + eAvatarTemplate + '" placeholder="https://example.com/avatar/{username}">',
                    '<span style="font-size:0.88rem; color:var(--text-muted);">Используйте <code>{username}</code> или <code>insert</code> вместо ника. Размер подставится автоматически.</span>',
                '</label>',
                '<div style="display:flex; align-items:center; gap:0.75rem;">',
                    '<img src="' + getUserAvatarUrl(previewUser, 32) + '" class="user-avatar" style="object-fit:cover; image-rendering:pixelated; background:transparent;">',
                    '<span style="font-size:0.88rem; color:var(--text-muted);">Предпросмотр для ' + escapeHTML(previewUser) + '</span>',
                '</div>',
                '<div style="display:flex; justify-content:flex-end;">',
                    '<button class="btn btn-primary" onclick="saveSystemConfig()">Сохранить настройки</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
}
