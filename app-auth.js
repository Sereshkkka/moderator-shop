function normalizeDiscordId(value) {
    return (value || '').replace(/[<@!>\s]/g, '').trim();
}

function buildDiscordAvatarUrl(discordId, avatarHash) {
    const normalizedId = normalizeDiscordId(discordId);
    if (!normalizedId || !avatarHash) return '';
    return 'https://cdn.discordapp.com/avatars/' + normalizedId + '/' + avatarHash + '.png?size=80';
}

function findUserByDiscordId(discordId, excludeUserId) {
    const normalizedId = normalizeDiscordId(discordId);
    if (!normalizedId) return null;
    return db.data.users.find(u => u.id !== excludeUserId && normalizeDiscordId(u.discordId) === normalizedId) || null;
}

function getDiscordRedirectUri() {
    return (APP_CONFIG.publicAppUrl || window.location.origin).replace(/\/+$/, '') + '/';
}

function isDiscordOAuthConfigured() {
    return !!DISCORD_OAUTH_CLIENT_ID;
}

function buildDiscordOAuthUrl(mode) {
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
        sessionStorage.setItem(DISCORD_OAUTH_STATE_KEY, state);
        sessionStorage.setItem(DISCORD_OAUTH_MODE_KEY, mode);
        if (mode === 'link' && currentUser) {
            sessionStorage.setItem(DISCORD_OAUTH_LINK_USER_KEY, currentUser.id);
        } else {
            sessionStorage.removeItem(DISCORD_OAUTH_LINK_USER_KEY);
        }
    } catch (e) {}

    const params = new URLSearchParams({
        client_id: DISCORD_OAUTH_CLIENT_ID,
        redirect_uri: getDiscordRedirectUri(),
        response_type: 'token',
        scope: 'identify',
        prompt: 'consent',
        state
    });
    return 'https://discord.com/oauth2/authorize?' + params.toString();
}

function captureDiscordOAuthCallback() {
    const rawHash = window.location.hash || '';
    if (!rawHash.includes('access_token=') && !rawHash.includes('error=')) return false;

    try {
        sessionStorage.setItem(DISCORD_OAUTH_CALLBACK_HASH_KEY, rawHash);
    } catch (e) {}
    history.replaceState(null, '', window.location.pathname + window.location.search);

    const root = document.getElementById('appRoot');
    if (root) {
        root.innerHTML = [
            '<div class="oauth-callback-loading" role="status" aria-live="polite">',
                '<div class="oauth-callback-spinner" aria-hidden="true"></div>',
                '<strong>Завершаем привязку Discord</strong>',
                '<span>Получаем профиль и возвращаем вас в ModShop.</span>',
            '</div>'
        ].join('');
    }
    return true;
}

async function fetchDiscordProfile(accessToken) {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
            Authorization: 'Bearer ' + accessToken
        }
    });
    if (!response.ok) {
        throw new Error('Не удалось получить профиль Discord.');
    }
    return response.json();
}

async function handleDiscordOAuthCallback() {
    let storedHash = '';
    try { storedHash = sessionStorage.getItem(DISCORD_OAUTH_CALLBACK_HASH_KEY) || ''; } catch (e) {}
    const rawHash = storedHash || window.location.hash || '';
    if (!rawHash.includes('access_token=') && !rawHash.includes('error=')) {
        return false;
    }

    const hashParams = new URLSearchParams(rawHash.replace(/^#/, ''));
    const returnedState = hashParams.get('state') || '';
    const savedState = sessionStorage.getItem(DISCORD_OAUTH_STATE_KEY) || '';
    const mode = sessionStorage.getItem(DISCORD_OAUTH_MODE_KEY) || 'login';
    const linkUserId = sessionStorage.getItem(DISCORD_OAUTH_LINK_USER_KEY) || '';

    history.replaceState(null, '', window.location.pathname + window.location.search);

    try {
        sessionStorage.removeItem(DISCORD_OAUTH_CALLBACK_HASH_KEY);
        sessionStorage.removeItem(DISCORD_OAUTH_STATE_KEY);
        sessionStorage.removeItem(DISCORD_OAUTH_MODE_KEY);
        sessionStorage.removeItem(DISCORD_OAUTH_LINK_USER_KEY);
    } catch (e) {}

    if (savedState && returnedState && savedState !== returnedState) {
        showToast('Не удалось подтвердить вход через Discord.', 'error');
        return true;
    }

    if (hashParams.get('error')) {
        showToast('Discord авторизация была отменена или завершилась ошибкой.', 'error');
        return true;
    }

    const accessToken = hashParams.get('access_token');
    if (!accessToken) {
        showToast('Discord не вернул access token.', 'error');
        return true;
    }

    try {
        const discordProfile = await fetchDiscordProfile(accessToken);
        const discordId = normalizeDiscordId(discordProfile.id || '');
        const discordName = discordProfile.global_name || discordProfile.username || 'Discord';
        const discordAvatarUrl = buildDiscordAvatarUrl(discordId, discordProfile.avatar);

        if (mode === 'link' && currentUser && currentUser.id === linkUserId) {
            const conflictUser = findUserByDiscordId(discordId, currentUser.id);
            if (conflictUser) {
                showToast('Discord используется другим пользователем.', 'error');
                return true;
            }
            currentUser.discordId = discordId;
            currentUser.discordUsername = discordName;
            currentUser.discordAvatarUrl = discordAvatarUrl;
            const localUser = db.data.users.find(u => u.id === currentUser.id);
            if (localUser) {
                localUser.discordId = discordId;
                localUser.discordUsername = discordName;
                localUser.discordAvatarUrl = discordAvatarUrl;
                db.saveLocal();
            }
            profileDiscordEditMode = false;
            showToast('Discord ' + discordName + ' успешно привязан.');
            return true;
        }

        const linkedUser = db.data.users.find(u => normalizeDiscordId(u.discordId) === discordId);
        if (!linkedUser) {
            showToast('Этот Discord не привязан ни к одному аккаунту сайта.', 'error');
            return true;
        }
        if (linkedUser.isPendingActivation) {
            showToast('Аккаунт еще не активирован.', 'error');
            return true;
        }
        const preferredCompanyId = getPreferredActiveCompanyId(linkedUser);
        if (!preferredCompanyId) {
            showToast('Аккаунт деактивирован.', 'error');
            return true;
        }

        currentUser = linkedUser;
        if (!currentUser.cart) currentUser.cart = [];
        try { sessionStorage.setItem('session_user_id', currentUser.id); } catch (e) {}
        currentCompanyId = preferredCompanyId;
        await recordUserLogin(currentUser, { discordId });
        showToast('Вход через Discord выполнен: ' + currentUser.username);
        return true;
    } catch (error) {
        showToast(error.message || 'Не удалось завершить вход через Discord.', 'error');
        return true;
    }
}

window.enableDiscordEdit = () => {
    profileDiscordEditMode = true;
    renderProfile(getDashboardContent());
};

window.cancelDiscordEdit = () => {
    profileDiscordEditMode = false;
    renderProfile(getDashboardContent());
};

window.startDiscordProfileLink = () => {
    window.location.href = buildDiscordOAuthUrl('link');
};

window.openPasswordChangeModal = () => {
    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="pm_overlay">',
            '<div class="modal-content" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1.5rem">Смена пароля</h3>',
                '<div class="form-group">',
                    '<label>Новый пароль</label>',
                    '<input type="password" id="new_pwd" class="form-control" autocomplete="new-password">',
                '</div>',
                '<div class="form-group">',
                    '<label>Подтвердите пароль</label>',
                    '<input type="password" id="confirm_pwd" class="form-control" autocomplete="new-password">',
                '</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" onclick="executePasswordChange()">Обновить пароль</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');

    bindModalOverlayClose('pm_overlay');
};

window.executePasswordChange = async (forcedMode) => {
    const isForced = !!forcedMode || !!(currentUser && currentUser.mustChangePassword);
    const p1Input = document.getElementById(isForced ? 'forced_new_pwd' : 'new_pwd');
    const p2Input = document.getElementById(isForced ? 'forced_confirm_pwd' : 'confirm_pwd');
    const p1 = p1Input ? p1Input.value : '';
    const p2 = p2Input ? p2Input.value : '';

    if (!p1 || p1.length < 4) {
        showToast('Пароль должен быть не менее 4 символов', 'error');
        return;
    }
    if (p1 !== p2) {
        showToast('Пароли не совпадают!', 'error');
        return;
    }

    const u = db.data.users.find(x => x.id === currentUser.id);
    if (u) {
        const authSession = authGateway.getStoredSession();
        if (authSession && authSession.access_token) {
            try {
                await authGateway.updatePassword(authSession.access_token, p1);
            } catch (error) {
                showToast(error.message || 'Не удалось обновить пароль в Supabase Auth.', 'error');
                return;
            }
        }
        u.password = await hashPassword(p1);
        u.mustChangePassword = false;
        if (currentUser) currentUser.mustChangePassword = false;
        db.save();
        if (!isForced) {
            closeBalanceModal();
        }
        showToast('Пароль успешно изменен');
        renderRoute();
    }
};

window.saveDiscordLink = async () => {
    const rawValue = document.getElementById('profile_discord_id').value;
    const normalized = normalizeDiscordId(rawValue);
    if (normalized && !/^\d{5,25}$/.test(normalized)) {
        showToast('Discord ID должен содержать только цифры.', 'error');
        return;
    }
    const conflictUser = findUserByDiscordId(normalized, currentUser.id);
    if (conflictUser) {
        showToast('Discord используется другим пользователем.', 'error');
        return;
    }

    const authSession = authGateway.getStoredSession();
    if (authSession && authSession.access_token) {
        try {
            const remoteUser = await authGateway.updateOwnDiscord(
                authSession.access_token,
                normalized,
                currentUser && currentUser.authUserId ? currentUser.authUserId : null
            );
            if (remoteUser) {
                currentUser = upsertLocalUser(remoteUser);
            }
        } catch (error) {
            showToast(error.message || 'Не удалось обновить Discord ID в Supabase.', 'error');
            return;
        }
    }

    currentUser.discordId = normalized;
    const u = db.data.users.find(x => x.id === currentUser.id);
    if (u) {
        u.discordId = normalized;
        if (!normalized) {
            currentUser.discordUsername = '';
            currentUser.discordAvatarUrl = '';
            u.discordUsername = '';
            u.discordAvatarUrl = '';
        }
        profileDiscordEditMode = false;
        db.saveLocal();
        showToast(normalized ? 'Discord успешно привязан.' : 'Discord привязка очищена.');
        renderProfile(getDashboardContent());
    }
};

window.clearDiscordLink = () => {
    profileDiscordEditMode = false;
    const input = document.getElementById('profile_discord_id');
    if (input) {
        input.value = '';
        saveDiscordLink();
        return;
    }

    const authSession = authGateway.getStoredSession();
    const finishClear = () => {
        currentUser.discordId = '';
        currentUser.discordUsername = '';
        currentUser.discordAvatarUrl = '';
        const u = db.data.users.find(x => x.id === currentUser.id);
        if (u) {
            u.discordId = '';
            u.discordUsername = '';
            u.discordAvatarUrl = '';
            db.saveLocal();
            showToast('Discord привязка очищена.');
            renderProfile(getDashboardContent());
        }
    };

    if (authSession && authSession.access_token) {
        authGateway.updateOwnDiscord(
            authSession.access_token,
            '',
            currentUser && currentUser.authUserId ? currentUser.authUserId : null
        ).then(remoteUser => {
            if (remoteUser) {
                currentUser = upsertLocalUser(remoteUser);
            }
            finishClear();
        }).catch(error => {
            showToast(error.message || 'Не удалось очистить Discord ID в Supabase.', 'error');
        });
        return;
    }

    finishClear();
};
