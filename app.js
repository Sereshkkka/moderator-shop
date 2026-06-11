const DB_KEY = 'nexus_coin_system_db';

const APP_CONFIG = window.__APP_CONFIG__ || {};
const AUTH_ACCESS_TOKEN_KEY = 'supabase_auth_access_token';
const AUTH_REFRESH_TOKEN_KEY = 'supabase_auth_refresh_token';
const AUTH_MODE_KEY = 'supabase_auth_mode';
const DEFAULT_ADMIN_USERNAME = 'sereshkkka';
const DEFAULT_ADMIN_PASSWORD_HASH = 'b56f34b92977b77bd09c659bc863ba2f997fb1a439627d531a9fd3e3eb3b30bc';
const DISCORD_OAUTH_CLIENT_ID = APP_CONFIG.discordOAuthClientId || '1492710758658871336';
const DISCORD_OAUTH_STATE_KEY = 'discord_oauth_state';
const DISCORD_OAUTH_MODE_KEY = 'discord_oauth_mode';
const DISCORD_OAUTH_LINK_USER_KEY = 'discord_oauth_link_user_id';
const DISCORD_OAUTH_CALLBACK_HASH_KEY = 'discord_oauth_callback_hash';
const POST_RELOAD_TOAST_KEY = 'post_reload_toast';
const DEFAULT_AVATAR_URL_TEMPLATE = 'https://skins.mcskill.net/?name=insert&mode=5&fx=size&fy=size';
const THEME_STORAGE_KEY = 'modshop_theme';
const DEFAULT_BONUS_ROLE_PERMS = {
    helper: ['access_bonuses'],
    moderator: ['access_bonuses'],
    'ST-moderator': ['access_bonuses'],
    gd: ['access_bonuses', 'review_bonuses'],
    GM: ['access_bonuses', 'review_bonuses'],
    kurator: ['access_bonuses', 'review_bonuses'],
    tech_admin: ['access_bonuses', 'review_bonuses'],
    server_admin: ['access_bonuses', 'review_bonuses']
};
const DEFAULT_ROLE_LABELS = {
    waiting: 'Ожидание',
    vacation: 'В отпуске',
    admin: 'Гл. Администратор',
    server_admin: 'Админ Сервера',
    tech_admin: 'Тех-Админ',
    kurator: 'Куратор',
    GM: 'Гл. Модератор',
    gd: 'ГД',
    'ST-moderator': 'Ст-Модератор',
    moderator: 'Модератор',
    helper: 'Хелпер'
};

function isBrokenRoleLabel(label) {
    if (typeof label !== 'string') return true;
    const normalized = label.trim();
    if (!normalized) return true;
    return /^[?\s-]+$/.test(normalized);
}

function repairKnownRoleLabels(data) {
    if (!data || !Array.isArray(data.roles)) return false;
    let changed = false;
    data.roles.forEach(role => {
        if (!role || !DEFAULT_ROLE_LABELS[role.id]) return;
        if (isBrokenRoleLabel(role.label)) {
            role.label = DEFAULT_ROLE_LABELS[role.id];
            changed = true;
        }
    });
    return changed;
}

function getStoredTheme() {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch (e) {
        return 'dark';
    }
}

function applyAppTheme(theme) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.body.classList.toggle('light-theme', nextTheme === 'light');
    document.body.classList.toggle('dark-theme', nextTheme !== 'light');
    try { localStorage.setItem(THEME_STORAGE_KEY, nextTheme); } catch (e) {}
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        toggle.classList.toggle('is-light', nextTheme === 'light');
        toggle.setAttribute('aria-checked', nextTheme === 'light' ? 'true' : 'false');
        toggle.setAttribute('title', nextTheme === 'light' ? 'Включить темную тему' : 'Включить светлую тему');
    }
}

function toggleAppTheme() {
    applyAppTheme(document.body.classList.contains('light-theme') ? 'dark' : 'light');
}

applyAppTheme(getStoredTheme());

// --- Security & Configuration ---
const PENDING_ROLE_ID = 'waiting';
const USE_REMOTE_SYNC = false;
const USE_LOCAL_WEBHOOK_RELAY = true;
const USE_TABLE_MODE = false;
const USE_SUPABASE_AUTH = false;
const USE_SERVER_DATABASE_SYNC = true;
const USE_LOCAL_STORAGE_CACHE = false;
const PURCHASE_LOG_DETAILS_TTL_MS = 24 * 60 * 60 * 1000;
const VACATION_ROLE_ID = 'vacation';
const REPRIMAND_STORE_SURCHARGE = 10;
const MAX_USER_BALANCE = 100000;
const SUPABASE_REQUEST_TIMEOUT_MS = 25000;
const SUPABASE_URL = APP_CONFIG.supabaseUrl || '';
const SUPABASE_ANON_KEY = APP_CONFIG.supabaseAnonKey || '';
const TABLE_CONFIG = {
    companies: 'companies',
    roles: 'roles',
    users: 'users',
    access: 'user_company_access',
    codes: 'codes',
    items: 'items',
    logs: 'logs',
    systemConfig: 'system_config'
};

async function hashPassword(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function ensureDefaultAdminInData(data) {
    if (!data || !Array.isArray(data.users)) {
        return { changed: false, admin: null };
    }

    const primaryCompanyId = (Array.isArray(data.companies) && data.companies[0] && data.companies[0].id) || 'comp_initial';
    let changed = false;
    let admin = data.users.find(u => u.username === DEFAULT_ADMIN_USERNAME) || null;

    if (!admin) {
        admin = {
            id: 'user_default_admin',
            username: DEFAULT_ADMIN_USERNAME,
            password: DEFAULT_ADMIN_PASSWORD_HASH,
            coins: 0,
            role: 'admin',
            companyId: primaryCompanyId,
            date: new Date().toISOString(),
            cart: [],
            discordId: '',
            discordUsername: '',
            discordAvatarUrl: '',
            authorizedCompanies: [primaryCompanyId],
            isArchived: false,
            isPendingActivation: false,
            accountStatus: 'активен',
            mustChangePassword: false,
            authUserId: null,
            email: ''
        };
        data.users.unshift(admin);
        changed = true;
    }

    if (admin.password !== DEFAULT_ADMIN_PASSWORD_HASH) {
        admin.password = DEFAULT_ADMIN_PASSWORD_HASH;
        changed = true;
    }
    if (admin.role !== 'admin') {
        admin.role = 'admin';
        changed = true;
    }
    if (!admin.companyId) {
        admin.companyId = primaryCompanyId;
        changed = true;
    }
    if (!Array.isArray(admin.authorizedCompanies) || !admin.authorizedCompanies.length) {
        admin.authorizedCompanies = [admin.companyId || primaryCompanyId];
        changed = true;
    }
    if (!admin.authorizedCompanies.includes(admin.companyId || primaryCompanyId)) {
        admin.authorizedCompanies.unshift(admin.companyId || primaryCompanyId);
        changed = true;
    }
    if (admin.isArchived) {
        admin.isArchived = false;
        changed = true;
    }
    if (admin.isPendingActivation) {
        admin.isPendingActivation = false;
        changed = true;
    }
    if (admin.accountStatus !== 'активен') {
        admin.accountStatus = 'активен';
        changed = true;
    }
    if (admin.mustChangePassword) {
        admin.mustChangePassword = false;
        changed = true;
    }
    if (!Array.isArray(admin.cart)) {
        admin.cart = [];
        changed = true;
    }

    return { changed, admin };
}

function escapeHTML(str) {
    if (!str) return '';
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

function normalizeAvatarTemplate(template) {
    const normalized = typeof template === 'string' ? template.trim() : '';
    return normalized || DEFAULT_AVATAR_URL_TEMPLATE;
}

function normalizeSystemConfig(config) {
    const source = config && typeof config === 'object' ? config : {};
    const bonusRequests = Array.isArray(source.bonusRequests) ? source.bonusRequests : [];
    return {
        webhookUrl: source.webhookUrl || '',
        avatarUrlTemplate: normalizeAvatarTemplate(source.avatarUrlTemplate),
        bonusRequests: bonusRequests.map(request => ({
            id: request.id || ('bonus_request_' + Math.random().toString(36).slice(2, 9)),
            companyId: request.companyId || 'comp_initial',
            userId: request.userId || '',
            reasonId: request.reasonId || '',
            reasonLabel: request.reasonLabel || '',
            fieldType: request.fieldType || 'none',
            forumUrl: request.forumUrl || '',
            ticketNumber: request.ticketNumber || '',
            comment: request.comment || '',
            amount: Math.max(0, Math.trunc(Number(request.amount) || 0)),
            originalAmount: request.originalAmount === null || request.originalAmount === undefined ? null : Math.max(0, Math.trunc(Number(request.originalAmount) || 0)),
            amountEditedAt: request.amountEditedAt || null,
            amountEditedBy: request.amountEditedBy || null,
            status: ['pending', 'approved', 'paid', 'rejected'].includes(request.status) ? request.status : 'pending',
            createdAt: request.createdAt || new Date().toISOString(),
            reviewedAt: request.reviewedAt || null,
            reviewedBy: request.reviewedBy || null,
            paidAt: request.paidAt || null,
            paidBy: request.paidBy || null,
            reviewComment: request.reviewComment || ''
        })),
        bonusPermissionsInitialized: !!source.bonusPermissionsInitialized
    };
}

function initializeDefaultBonusPermissions(data) {
    if (!data || !Array.isArray(data.roles)) return false;
    data.systemConfig = normalizeSystemConfig(data.systemConfig);
    if (data.systemConfig.bonusPermissionsInitialized) return false;
    let changed = false;
    data.roles.forEach(role => {
        if (!role || role.id === 'admin') return;
        if (!Array.isArray(role.perms)) {
            role.perms = [];
            changed = true;
        }
        (DEFAULT_BONUS_ROLE_PERMS[role.id] || []).forEach(perm => {
            if (!role.perms.includes(perm)) {
                role.perms.push(perm);
                changed = true;
            }
        });
    });
    data.systemConfig.bonusPermissionsInitialized = true;
    return true;
}

function getAvatarUrlTemplate() {
    return normalizeAvatarTemplate(db && db.data && db.data.systemConfig ? db.data.systemConfig.avatarUrlTemplate : '');
}

function getBonusRequests() {
    if (!db || !db.data) return [];
    db.data.systemConfig = normalizeSystemConfig(db.data.systemConfig);
    return db.data.systemConfig.bonusRequests;
}

function formatCoinAmount(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0';
    return Math.trunc(numeric).toLocaleString('ru-RU');
}

function formatAppDate(value, options = {}) {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const pad = valuePart => String(valuePart).padStart(2, '0');
    const datePart = pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear();
    if (options.dateOnly) return datePart;
    return datePart + ', ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

function appendAvatarSize(url, size) {
    try {
        const parsedUrl = new URL(url, window.location.origin);
        const lowerHost = parsedUrl.hostname.toLowerCase();
        const hasSizeToken = ['size', 'fx', 'fy', 'width', 'height']
            .some(paramName => parsedUrl.searchParams.has(paramName));

        if (!hasSizeToken) {
            if (lowerHost.includes('skins.mcskill.net')) {
                parsedUrl.searchParams.set('fx', size);
                parsedUrl.searchParams.set('fy', size);
            } else {
                parsedUrl.searchParams.set('size', size);
            }
        }

        return parsedUrl.toString();
    } catch (error) {
        const separator = url.includes('?') ? '&' : '?';
        return /([?&])(size|fx|fy|width|height)=/i.test(url)
            ? url
            : url + separator + 'size=' + encodeURIComponent(size);
    }
}

function getUserAvatarUrl(username, size) {
    const normalizedUsername = (username || '').trim();
    const targetSize = Number(size) > 0 ? String(size) : '32';
    const template = getAvatarUrlTemplate();
    const resolvedUrl = template
        .replace(/\{username\}/g, encodeURIComponent(normalizedUsername))
        .replace(/\{size\}/g, encodeURIComponent(targetSize))
        .replace(/insert/g, encodeURIComponent(normalizedUsername))
        .replace(/size/g, encodeURIComponent(targetSize));
    return appendAvatarSize(resolvedUrl, targetSize);
}

class SupabaseTableGateway {
    constructor() {
        this.enabled = USE_TABLE_MODE;
        this.url = SUPABASE_URL;
        this.anonKey = SUPABASE_ANON_KEY;
    }

    isConfigured() {
        return this.enabled && !!this.url && !!this.anonKey;
    }

    getHeaders(extra) {
        return Object.assign({
            apikey: this.anonKey,
            Authorization: 'Bearer ' + this.anonKey
        }, extra || {});
    }

    async request(path, options) {
        if (!this.isConfigured()) {
            throw new Error('Table mode is not configured.');
        }
        const response = await fetch(this.url + '/rest/v1/' + path, options || {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            throw new Error('Table request failed with status ' + response.status);
        }
        return response;
    }

    async fetchCompanies() {
        const response = await this.request(TABLE_CONFIG.companies + '?select=*');
        const rows = await response.json();
        return rows.map(this.mapCompanyRow);
    }

    async fetchItems() {
        const response = await this.request(TABLE_CONFIG.items + '?select=*');
        const rows = await response.json();
        return rows.map(this.mapItemRow);
    }

    async fetchCodes() {
        const response = await this.request(TABLE_CONFIG.codes + '?select=*');
        const rows = await response.json();
        return rows.map(this.mapCodeRow);
    }

    async fetchRoles() {
        const response = await this.request(TABLE_CONFIG.roles + '?select=*');
        const rows = await response.json();
        return rows.map(this.mapRoleRow);
    }

    async fetchUsers() {
        const response = await this.request(TABLE_CONFIG.users + '?select=*');
        const rows = await response.json();
        return rows.map(this.mapUserRow);
    }

    async fetchLogs() {
        const response = await this.request(TABLE_CONFIG.logs + '?select=*');
        const rows = await response.json();
        return rows.map(this.mapLogRow);
    }

    async fetchSystemConfig() {
        const response = await this.request(TABLE_CONFIG.systemConfig + '?select=*');
        const rows = await response.json();
        return this.mapSystemConfigRow(rows[0] || null);
    }

    async loadTableSnapshot() {
        const [companies, items, codes, roles, users, logs, systemConfig] = await Promise.all([
            this.fetchCompanies(),
            this.fetchItems(),
            this.fetchCodes(),
            this.fetchRoles(),
            this.fetchUsers(),
            this.fetchLogs(),
            this.fetchSystemConfig()
        ]);

        return {
            companies,
            items,
            codes,
            roles,
            users,
            logs,
            systemConfig
        };
    }

    mapCompanyRow(row) {
        return {
            id: row.id,
            name: row.name,
            accentColor: row.accent_color || '#8b5cf6',
            webhookUrl: row.webhook_url || ''
        };
    }

    mapItemRow(row) {
        return {
            id: row.id,
            companyId: row.company_id,
            name: row.name,
            description: row.description || '',
            price: row.price || 0,
            itemType: row.item_type || 'item',
            image: row.image || ''
        };
    }

    mapCodeRow(row) {
        return {
            id: row.id,
            code: row.code,
            companyId: row.company_id,
            targetUsername: row.target_username,
            isUsed: !!row.is_used,
            createdBy: row.created_by || null,
            date: row.created_at
        };
    }

    mapRoleRow(row) {
        return {
            id: row.id,
            label: row.label,
            tier: row.tier,
            color: row.color,
            perms: Array.isArray(row.perms) ? row.perms : []
        };
    }

    mapUserRow(row) {
        const companyRoles = row.server_roles && typeof row.server_roles === 'object' && !Array.isArray(row.server_roles)
            ? { ...row.server_roles }
            : {};
        const reprimands = row.reprimands && typeof row.reprimands === 'object' && !Array.isArray(row.reprimands)
            ? { ...row.reprimands }
            : {};
        const authorizedCompanies = Array.from(new Set([
            row.company_id,
            ...Object.keys(companyRoles)
        ].filter(Boolean)));
        const roleId = row.role_id === PENDING_ROLE_ID ? 'helper' : row.role_id;
        authorizedCompanies.forEach(companyId => {
            if (!companyRoles[companyId]) {
                companyRoles[companyId] = roleId;
            }
            if (companyRoles[companyId] === PENDING_ROLE_ID) {
                companyRoles[companyId] = 'helper';
            }
        });
        if (row.company_id) {
            companyRoles[row.company_id] = roleId;
        }

        return {
            id: row.id,
            username: row.username,
            password: row.password_hash,
            coins: row.coins || 0,
            role: roleId,
            companyId: row.company_id,
            date: row.created_at,
            cart: Array.isArray(row.cart) ? row.cart : [],
            isArchived: !!row.is_archived,
            isPendingActivation: !!row.is_pending_activation,
            mustChangePassword: !!row.must_change_password,
            accountStatus: row.account_status || 'активен',
            discordId: row.discord_id || '',
            discordUsername: row.discord_username || '',
            discordAvatarUrl: row.discord_avatar_url || '',
            inviteCodeId: row.invite_code_id || null,
            authorizedCompanies,
            companyRoles,
            reprimands,
            authUserId: row.auth_user_id || null,
            email: row.email || ''
        };
    }

    mapLogRow(row) {
        return {
            id: row.id,
            userId: row.user_id,
            modifierId: row.modifier_id,
            companyId: row.company_id,
            oldBalance: row.old_balance || 0,
            newBalance: row.new_balance || 0,
            type: row.type,
            reason: row.reason || '',
            date: row.created_at,
            purchaseDetails: row.purchase_details || null
        };
    }

    mapSystemConfigRow(row) {
        return normalizeSystemConfig({
            webhookUrl: row && row.webhook_url ? row.webhook_url : '',
            avatarUrlTemplate: row && row.avatar_url_template ? row.avatar_url_template : '',
            bonusRequests: row && Array.isArray(row.bonus_requests) ? row.bonus_requests : [],
            bonusPermissionsInitialized: !!(row && row.bonus_permissions_initialized)
        });
    }
}
// --------------------------

class SupabaseAuthGateway {
    constructor() {
        this.enabled = USE_SUPABASE_AUTH;
        this.url = SUPABASE_URL;
        this.anonKey = SUPABASE_ANON_KEY;
    }

    isConfigured() {
        return this.enabled && !!this.url && !!this.anonKey;
    }

    getHeaders(extra) {
        return Object.assign({
            apikey: this.anonKey,
            'Content-Type': 'application/json'
        }, extra || {});
    }

    getStoredSession() {
        if (!this.isConfigured()) return null;
        try {
            const accessToken = sessionStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
            const refreshToken = sessionStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
            if (!accessToken || !refreshToken) return null;
            return { access_token: accessToken, refresh_token: refreshToken };
        } catch (e) {
            return null;
        }
    }

    saveSession(session) {
        if (!session || !session.access_token || !session.refresh_token) return;
        try {
            sessionStorage.setItem(AUTH_ACCESS_TOKEN_KEY, session.access_token);
            sessionStorage.setItem(AUTH_REFRESH_TOKEN_KEY, session.refresh_token);
            sessionStorage.setItem(AUTH_MODE_KEY, 'supabase');
        } catch (e) {}
    }

    clearSession() {
        try {
            sessionStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
            sessionStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
            sessionStorage.removeItem(AUTH_MODE_KEY);
        } catch (e) {}
    }

    async request(path, options) {
        if (!this.isConfigured()) {
            throw new Error('Supabase Auth is not configured.');
        }
        const requestOptions = { ...(options || {}) };
        const timeoutMs = Number(requestOptions.timeoutMs || SUPABASE_REQUEST_TIMEOUT_MS);
        delete requestOptions.timeoutMs;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        requestOptions.signal = controller.signal;
        let response;
        try {
            response = await fetch(this.url + path, requestOptions);
        } catch (error) {
            if (error && error.name === 'AbortError') {
                throw new Error('Supabase слишком долго отвечает. Попробуйте еще раз.');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
        if (!response.ok) {
            let message = 'Supabase request failed with status ' + response.status;
            try {
                const body = await response.json();
                if (body.error_description) message = body.error_description;
                else if (body.error && body.details) message = body.error + ': ' + body.details;
                else if (body.error) message = body.error;
                else if (body.message) message = body.message;
                else if (body.msg) message = body.msg;
            } catch (e) {}
            throw new Error(message);
        }
        return response;
    }

    async signInWithPassword(email, password) {
        const response = await this.request('/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ email, password })
        });
        return response.json();
    }

    async refreshSession(refreshToken) {
        const response = await this.request('/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        return response.json();
    }

    async getAuthUser(accessToken) {
        const response = await this.request('/auth/v1/user', {
            method: 'GET',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        return response.json();
    }

    async fetchLinkedAppUser(accessToken, authUserId) {
        const filter = authUserId ? '&auth_user_id=eq.' + encodeURIComponent(authUserId) : '';
        const response = await this.request('/rest/v1/users?select=*' + filter + '&limit=1', {
            method: 'GET',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        const rows = await response.json();
        return rows && rows[0] ? tableGateway.mapUserRow(rows[0]) : null;
    }

    async fetchAccessibleCompanies(accessToken) {
        const response = await this.request('/rest/v1/companies?select=*', {
            method: 'GET',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        const rows = await response.json();
        return rows.map(tableGateway.mapCompanyRow);
    }

    async fetchAccessibleItems(accessToken) {
        const response = await this.request('/rest/v1/items?select=*', {
            method: 'GET',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        const rows = await response.json();
        return rows.map(tableGateway.mapItemRow);
    }

    async fetchReadableRoles(accessToken) {
        const response = await this.request('/rest/v1/roles?select=*', {
            method: 'GET',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        const rows = await response.json();
        return rows.map(tableGateway.mapRoleRow);
    }

    async fetchOwnLogs(accessToken) {
        const response = await this.request('/rest/v1/logs?select=*', {
            method: 'GET',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        const rows = await response.json();
        return rows.map(tableGateway.mapLogRow);
    }

    async fetchCompanyAccess(accessToken) {
        const response = await this.request('/rest/v1/user_company_access?select=company_id', {
            method: 'GET',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        const rows = await response.json();
        return rows.map(row => row.company_id).filter(Boolean);
    }

    async fetchReadableSystemConfig(accessToken) {
        const response = await this.request('/rest/v1/system_config?select=*', {
            method: 'GET',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        const rows = await response.json();
        return tableGateway.mapSystemConfigRow(rows && rows[0] ? rows[0] : null);
    }

    async fetchStaffUsers(accessToken) {
        const response = await this.request('/rest/v1/users?select=*', {
            method: 'GET',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        const rows = await response.json();
        return rows.map(tableGateway.mapUserRow);
    }

    async fetchStaffCodes(accessToken) {
        const response = await this.request('/rest/v1/codes?select=*', {
            method: 'GET',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        const rows = await response.json();
        return rows.map(tableGateway.mapCodeRow);
    }

    async fetchStaffLogs(accessToken) {
        const response = await this.request('/rest/v1/logs?select=*', {
            method: 'GET',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        const rows = await response.json();
        return rows.map(tableGateway.mapLogRow);
    }

    async callRpc(accessToken, fnName, payload) {
        const response = await this.request('/rest/v1/rpc/' + fnName, {
            method: 'POST',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken,
                Prefer: 'return=representation'
            }),
            body: JSON.stringify(payload || {})
        });
        return response.json();
    }

    async callPublicRpc(fnName, payload) {
        const response = await this.request('/rest/v1/rpc/' + fnName, {
            method: 'POST',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + this.anonKey,
                Prefer: 'return=representation'
            }),
            body: JSON.stringify(payload || {})
        });
        return response.json();
    }

    async rpcAdjustBalance(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'staff_adjust_balance', payload);
        return row ? tableGateway.mapUserRow(row) : null;
    }

    async rpcUpdateRole(accessToken, payload) {
        let row;
        try {
            row = await this.callRpc(accessToken, 'staff_update_role', payload);
        } catch (error) {
            const canRetryWithoutCompany = payload && payload.target_company_id
                && /function|parameter|signature|schema cache|Could not find/i.test(error.message || '');
            if (!canRetryWithoutCompany) throw error;
            const legacyPayload = { ...payload };
            delete legacyPayload.target_company_id;
            row = await this.callRpc(accessToken, 'staff_update_role', legacyPayload);
        }
        return row ? tableGateway.mapUserRow(row) : null;
    }

    async rpcGenerateCode(accessToken, payload) {
        return this.callRpc(accessToken, 'staff_generate_code', payload);
    }

    async rpcCreateItem(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'store_create_item', payload);
        return row ? tableGateway.mapItemRow(row) : null;
    }

    async rpcDeleteItem(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'store_delete_item', payload);
        return row ? tableGateway.mapItemRow(row) : null;
    }

    async rpcCheckout(accessToken, payload) {
        const result = await this.callRpc(accessToken, 'store_checkout', payload);
        return {
            user: result && result.user ? tableGateway.mapUserRow(result.user) : null,
            totalCost: result ? result.total_cost : 0,
            companyId: result ? result.company_id : null
        };
    }

    async rpcDeleteCode(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'staff_delete_code', payload);
        return row ? tableGateway.mapCodeRow(row) : null;
    }

    async rpcArchiveUser(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'staff_archive_user', payload);
        return row ? tableGateway.mapUserRow(row) : null;
    }

    async rpcRestoreUser(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'staff_restore_user', payload);
        return row ? tableGateway.mapUserRow(row) : null;
    }

    async rpcDeleteArchivedUser(accessToken, payload) {
        return this.callRpc(accessToken, 'staff_delete_archived_user', payload);
    }

    async rpcActivateInvite(payload) {
        return this.callPublicRpc('public_activate_invite_code', payload);
    }

    async rpcAdminCreateCompany(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'admin_create_company', payload);
        return row ? tableGateway.mapCompanyRow(row) : null;
    }

    async rpcAdminRenameCompany(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'admin_rename_company', payload);
        return row ? tableGateway.mapCompanyRow(row) : null;
    }

    async rpcAdminUpdateCompanyWebhook(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'admin_update_company_webhook', payload);
        return row ? tableGateway.mapCompanyRow(row) : null;
    }

    async rpcAdminUpdateSystemWebhook(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'admin_update_system_webhook', payload);
        return row ? tableGateway.mapSystemConfigRow(row) : null;
    }

    async rpcAdminDeleteCompany(accessToken, payload) {
        return this.callRpc(accessToken, 'admin_delete_company', payload);
    }

    async rpcAdminSetUserCompanyAccess(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'admin_set_user_company_access', payload);
        return row ? tableGateway.mapUserRow(row) : null;
    }

    async rpcAdminUpdateUserDiscord(accessToken, payload) {
        const row = await this.callRpc(accessToken, 'admin_update_user_discord', payload);
        return row ? tableGateway.mapUserRow(row) : null;
    }

    async invokeDiscordWebhookRelay(accessToken, payload) {
        const response = await this.request('/functions/v1/discord-webhook-relay', {
            method: 'POST',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + this.anonKey,
                'X-Client-Authorization': 'Bearer ' + accessToken
            }),
            body: JSON.stringify(payload || {})
        });
        return response.json();
    }

    async invokeUserPasswordReset(accessToken, payload) {
        const response = await this.request('/functions/v1/reset-user-password', {
            method: 'POST',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + this.anonKey,
                'X-Client-Authorization': 'Bearer ' + accessToken
            }),
            body: JSON.stringify(payload || {})
        });
        return response.json();
    }

    async loadAuthorizedSnapshot(accessToken) {
        const [companies, items, roles, logs, companyAccess, systemConfig] = await Promise.all([
            this.fetchAccessibleCompanies(accessToken),
            this.fetchAccessibleItems(accessToken),
            this.fetchReadableRoles(accessToken),
            this.fetchOwnLogs(accessToken),
            this.fetchCompanyAccess(accessToken),
            this.fetchReadableSystemConfig(accessToken)
        ]);
        return { companies, items, roles, logs, companyAccess, systemConfig };
    }

    async loadStaffSnapshot(accessToken, options) {
        const tasks = [];
        const taskMap = [];

        if (options && options.includeUsers) {
            tasks.push(this.fetchStaffUsers(accessToken));
            taskMap.push('users');
        }
        if (options && options.includeCodes) {
            tasks.push(this.fetchStaffCodes(accessToken));
            taskMap.push('codes');
        }
        if (options && options.includeLogs) {
            tasks.push(this.fetchStaffLogs(accessToken));
            taskMap.push('logs');
        }

        const results = await Promise.all(tasks);
        const snapshot = {};
        taskMap.forEach((key, index) => {
            snapshot[key] = results[index];
        });
        return snapshot;
    }

    async updateOwnDiscord(accessToken, discordId, authUserId) {
        const filter = authUserId ? '&auth_user_id=eq.' + encodeURIComponent(authUserId) : '';
        const response = await this.request('/rest/v1/users?select=*' + filter + '&limit=1', {
            method: 'PATCH',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken,
                Prefer: 'return=representation'
            }),
            body: JSON.stringify({ discord_id: discordId || '' })
        });
        const rows = await response.json();
        return rows && rows[0] ? tableGateway.mapUserRow(rows[0]) : null;
    }

    async updatePassword(accessToken, password) {
        const response = await this.request('/auth/v1/user', {
            method: 'PUT',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            }),
            body: JSON.stringify({ password })
        });
        return response.json();
    }

    async signOut(accessToken) {
        const response = await fetch(this.url + '/auth/v1/logout', {
            method: 'POST',
            headers: this.getHeaders({
                Authorization: 'Bearer ' + accessToken
            })
        });
        if (!response.ok && response.status !== 401 && response.status !== 403) {
            throw new Error('Не удалось завершить сессию Supabase.');
        }
    }

    async hydrateCurrentUserFromSession(session) {
        if (!session || !session.access_token) return null;
        const authUser = await this.getAuthUser(session.access_token);
        const appUser = await this.fetchLinkedAppUser(session.access_token, authUser && authUser.id ? authUser.id : null);
        const snapshot = await this.loadAuthorizedSnapshot(session.access_token);
        if (!appUser) {
            throw new Error('Для этого Auth-пользователя не найдена связанная запись в public.users.');
        }
        appUser.authUserId = authUser.id || appUser.authUserId || null;
        appUser.email = authUser.email || appUser.email || '';
        if (snapshot.companyAccess && snapshot.companyAccess.length) {
            appUser.authorizedCompanies = [...new Set([appUser.companyId].concat(snapshot.companyAccess))];
        }
        this.saveSession(session);
        return { authUser, appUser, session, snapshot };
    }

    async restoreSessionContext() {
        const stored = this.getStoredSession();
        if (!stored) return null;
        try {
            return await this.hydrateCurrentUserFromSession(stored);
        } catch (e) {
            if (!stored.refresh_token) {
                this.clearSession();
                return null;
            }
            try {
                const refreshed = await this.refreshSession(stored.refresh_token);
                return await this.hydrateCurrentUserFromSession(refreshed);
            } catch (refreshError) {
                this.clearSession();
                return null;
            }
        }
    }
}


function getRoleTier(roleId) {
    const r = db.data.roles.find(x => x.id === roleId);
    return r ? r.tier : 1;
}

function ensureUserCompanyRoles(user) {
    if (!user) return {};
    if (!user.companyRoles || typeof user.companyRoles !== 'object' || Array.isArray(user.companyRoles)) {
        user.companyRoles = {};
    }

    const accessList = Array.isArray(user.authorizedCompanies) && user.authorizedCompanies.length
        ? Array.from(new Set(user.authorizedCompanies))
        : [user.companyId].filter(Boolean);

    if (user.companyId && !accessList.includes(user.companyId)) {
        accessList.unshift(user.companyId);
    }

    const fallbackRole = (user.role && user.role !== PENDING_ROLE_ID) ? user.role : 'helper';

    accessList.forEach(companyId => {
        if (!user.companyRoles[companyId]) {
            user.companyRoles[companyId] = fallbackRole;
        } else if (user.companyRoles[companyId] === PENDING_ROLE_ID) {
            user.companyRoles[companyId] = fallbackRole;
        }
    });

    if (user.role === 'admin') {
        accessList.forEach(companyId => {
            user.companyRoles[companyId] = 'admin';
        });
    }

    return user.companyRoles;
}

function ensureUserVacationRoles(user) {
    if (!user) return {};
    if (!user.vacationRoles || typeof user.vacationRoles !== 'object' || Array.isArray(user.vacationRoles)) {
        user.vacationRoles = {};
    }
    return user.vacationRoles;
}

function ensureUserReprimands(user) {
    if (!user) return {};
    if (!user.reprimands || typeof user.reprimands !== 'object' || Array.isArray(user.reprimands)) {
        user.reprimands = {};
    }
    return user.reprimands;
}

function ensureUserArchivedCompanies(user) {
    if (!user) return {};
    if (!user.archivedCompanies || typeof user.archivedCompanies !== 'object' || Array.isArray(user.archivedCompanies)) {
        user.archivedCompanies = {};
    }
    return user.archivedCompanies;
}

function isUserArchivedOnCompany(user, companyId = currentCompanyId) {
    if (!user) return false;
    if (user.isArchived && !user.archivedCompanies) return true;
    if (!companyId) return !!user.isArchived;
    const archivedCompanies = ensureUserArchivedCompanies(user);
    return !!archivedCompanies[companyId];
}

function getUserActiveCompanies(user) {
    if (!user) return [];
    const companies = Array.isArray(user.authorizedCompanies) && user.authorizedCompanies.length
        ? [...new Set(user.authorizedCompanies)]
        : (user.companyId ? [user.companyId] : []);
    return companies.filter(companyId => !isUserArchivedOnCompany(user, companyId));
}

function getPreferredActiveCompanyId(user) {
    if (!user) return null;
    if (currentCompanyId && hasUserCompanyAccess(user, currentCompanyId) && !isUserArchivedOnCompany(user, currentCompanyId)) {
        return currentCompanyId;
    }
    if (user.companyId && hasUserCompanyAccess(user, user.companyId) && !isUserArchivedOnCompany(user, user.companyId)) {
        return user.companyId;
    }
    const activeCompanies = getUserActiveCompanies(user);
    return activeCompanies[0] || null;
}

function getUserReprimandCount(user, companyId = currentCompanyId) {
    if (!user || !companyId) return 0;
    const reprimands = ensureUserReprimands(user);
    const count = Number(reprimands[companyId] || 0);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function getEffectiveItemPriceForUser(item, user = currentUser, companyId = currentCompanyId) {
    const basePrice = Number(item && item.price ? item.price : 0);
    const reprimandCount = getUserReprimandCount(user, companyId);
    return basePrice + (reprimandCount * REPRIMAND_STORE_SURCHARGE);
}

function getUserRoleForCompany(user, companyId = currentCompanyId) {
    if (!user) return null;
    const companyRoles = ensureUserCompanyRoles(user);
    if (user.role === 'admin') return 'admin';
    if (companyId && companyRoles[companyId]) return companyRoles[companyId];
    if (user.companyId && companyRoles[user.companyId]) return companyRoles[user.companyId];
    return user.role === PENDING_ROLE_ID ? 'helper' : (user.role || 'helper');
}

function getEffectiveUserRoleForCompany(user, companyId = currentCompanyId) {
    const currentRoleId = getUserRoleForCompany(user, companyId);
    if (currentRoleId !== VACATION_ROLE_ID) return currentRoleId;
    const vacationRoles = ensureUserVacationRoles(user);
    return vacationRoles[companyId] || 'helper';
}

function isUserOnVacation(user, companyId = currentCompanyId) {
    return getUserRoleForCompany(user, companyId) === VACATION_ROLE_ID;
}

function getCurrentUserRoleId(companyId = currentCompanyId) {
    return getUserRoleForCompany(currentUser, companyId);
}

function hasPermission(perm) {
    if (!currentUser) return false;
    const currentRoleId = getCurrentUserRoleId();
    const r = db.data.roles.find(x => x.id === currentRoleId);
    if (!r) return false;
    if (r.id === 'admin') return true; // God Mode always has all perms
    return r.perms.includes(perm) || r.perms.includes('all');
}

function hasGlobalControlAccess() {
    return getCurrentUserRoleId() === 'admin';
}

function canClearCurrentCompanyLogs() {
    if (!currentUser) return false;
    return getRoleTier(getCurrentUserRoleId()) >= 5;
}

function removeLogById(logId, silentMode) {
    db.data.logs = db.data.logs.filter(lx => lx.id !== logId);
    db.save();
    if (!silentMode) {
        showToast('Транзакция стерта');
    }
}

function getSnapshotWeight(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return 0;
    return [
        Array.isArray(snapshot.users) ? snapshot.users.length * 10 : 0,
        Array.isArray(snapshot.codes) ? snapshot.codes.length * 3 : 0,
        Array.isArray(snapshot.items) ? snapshot.items.length * 3 : 0,
        Array.isArray(snapshot.logs) ? snapshot.logs.length : 0,
        Array.isArray(snapshot.roles) ? snapshot.roles.length : 0,
        Array.isArray(snapshot.companies) ? snapshot.companies.length * 2 : 0
    ].reduce((sum, value) => sum + value, 0);
}

function shouldPreferRemoteSnapshot(localSnapshot, remoteSnapshot) {
    const remoteWeight = getSnapshotWeight(remoteSnapshot);
    if (remoteWeight <= 0) return false;

    const localWeight = getSnapshotWeight(localSnapshot);
    if (localWeight <= 0) return true;

    const localTimestamp = Date.parse(localSnapshot && localSnapshot._lastSavedAt ? localSnapshot._lastSavedAt : '') || 0;
    const remoteTimestamp = Date.parse(remoteSnapshot && remoteSnapshot._lastSavedAt ? remoteSnapshot._lastSavedAt : '') || 0;

    if (remoteTimestamp && localTimestamp) {
        return remoteTimestamp >= localTimestamp;
    }

    return remoteWeight >= localWeight;
}

class Database {
    constructor() {
        this.pendingRemoteSave = null;
        this.remoteSaveQueue = Promise.resolve();
        this.remoteSaveTimer = null;
        this.remoteSyncReady = false;
        this.load();
        if (!this.data) {
            this.data = {
                users: [
                    { id: this.generateId(), username: DEFAULT_ADMIN_USERNAME, password: DEFAULT_ADMIN_PASSWORD_HASH, coins: 0, role: 'admin', date: new Date().toISOString(), cart: [] }
                ],
                codes: [],
                items: [
                    { id: this.generateId(), name: 'Неоновая Рамка', description: 'Светящаяся рамка для вашего профиля.', price: 50, image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&q=80' },
                    { id: this.generateId(), name: 'Золотой Ник', description: 'Сделайте ваш ник золотым в списке.', price: 150, image: 'https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=400&q=80' }
                ],
                logs: [],
                roles: [
                    { id: PENDING_ROLE_ID, label: 'Ожидание', tier: 0, color: '#f59e0b', perms: [] },
                    { id: VACATION_ROLE_ID, label: 'В отпуске', tier: 0.5, color: '#14b8a6', perms: [] },
                    { id: 'admin', label: 'Гл. Администратор', tier: 8, color: '#ec4899', perms: ['all'] },
                    { id: 'server_admin', label: 'Админ Сервера', tier: 7, color: '#f59e0b', perms: ['access_mod_panel', 'generate_codes', 'manage_store', 'view_logs', 'edit_balance', 'edit_roles', 'access_archive', 'access_bonuses', 'review_bonuses'] },
                    { id: 'tech_admin', label: 'Тех-Админ', tier: 6, color: '#06b6d4', perms: ['access_mod_panel', 'manage_store', 'view_logs', 'edit_balance', 'access_archive', 'access_bonuses', 'review_bonuses'] },
                    { id: 'kurator', label: 'Куратор', tier: 5, color: '#eab308', perms: ['access_mod_panel', 'view_logs', 'edit_balance', 'access_archive', 'access_bonuses', 'review_bonuses'] },
                    { id: 'GM', label: 'Гл. Модератор', tier: 4, color: '#a855f7', perms: ['access_mod_panel', 'view_logs', 'access_archive', 'access_bonuses', 'review_bonuses'] },
                    { id: 'gd', label: 'ГД', tier: 4, color: '#10b981', perms: ['access_mod_panel', 'view_logs', 'access_archive', 'access_bonuses', 'review_bonuses'] },
                    { id: 'ST-moderator', label: 'Ст-Модератор', tier: 3, color: '#6366f1', perms: ['access_mod_panel', 'view_logs', 'access_archive', 'access_bonuses'] },
                    { id: 'moderator', label: 'Модератор', tier: 2, color: '#38bdf8', perms: ['access_mod_panel', 'access_bonuses'] },
                    { id: 'helper', label: 'Хелпер', tier: 1, color: '#10b881', perms: ['access_bonuses'] }
                ]
            };
            this.save();
        }
        
        if (!this.data.roles) {
            this.data.roles = [
                { id: PENDING_ROLE_ID, label: 'Ожидание', tier: 0, color: '#f59e0b', perms: [] },
                { id: VACATION_ROLE_ID, label: 'В отпуске', tier: 0.5, color: '#14b8a6', perms: [] },
                { id: 'admin', label: 'Гл. Администратор', tier: 8, color: '#ec4899', perms: ['all'] },
                { id: 'server_admin', label: 'Админ Сервера', tier: 7, color: '#f59e0b', perms: ['access_mod_panel', 'generate_codes', 'manage_store', 'view_logs', 'edit_balance', 'edit_roles', 'access_archive', 'access_bonuses', 'review_bonuses'] },
                { id: 'tech_admin', label: 'Тех-Админ', tier: 6, color: '#06b6d4', perms: ['access_mod_panel', 'manage_store', 'view_logs', 'edit_balance', 'access_archive', 'access_bonuses', 'review_bonuses'] },
                { id: 'kurator', label: 'Куратор', tier: 5, color: '#eab308', perms: ['access_mod_panel', 'view_logs', 'edit_balance', 'access_archive', 'access_bonuses', 'review_bonuses'] },
                { id: 'GM', label: 'Гл. Модератор', tier: 4, color: '#a855f7', perms: ['access_mod_panel', 'view_logs', 'access_archive', 'access_bonuses', 'review_bonuses'] },
                { id: 'gd', label: 'ГД', tier: 4, color: '#10b981', perms: ['access_mod_panel', 'view_logs', 'access_archive', 'access_bonuses', 'review_bonuses'] },
                { id: 'ST-moderator', label: 'Ст-Модератор', tier: 3, color: '#6366f1', perms: ['access_mod_panel', 'view_logs', 'access_archive', 'access_bonuses'] },
                { id: 'moderator', label: 'Модератор', tier: 2, color: '#38bdf8', perms: ['access_mod_panel', 'access_bonuses'] },
                { id: 'helper', label: 'Хелпер', tier: 1, color: '#10b881', perms: ['access_bonuses'] }
            ];
            this.save();
        }
        
        // Multi-Tenant Migration
        if (!this.data.companies) {
            this.data.companies = [{ id: 'comp_initial', name: 'Главный Сервер' }];
            this.data.users.forEach(u => { if (!u.companyId) u.companyId = 'comp_initial'; });
            this.data.codes.forEach(c => { if (!c.companyId) c.companyId = 'comp_initial'; });
            this.data.items.forEach(i => { if (!i.companyId) i.companyId = 'comp_initial'; });
            this.data.logs.forEach(l => { if (!l.companyId) l.companyId = 'comp_initial'; });
            this.save();
        }
        
        if (!this.data.roles.find(r => r.id === PENDING_ROLE_ID)) {
            this.data.roles.unshift({ id: PENDING_ROLE_ID, label: 'Ожидание', tier: 0, color: '#f59e0b', perms: [] });
        }
        if (!this.data.roles.find(r => r.id === VACATION_ROLE_ID)) {
            this.data.roles.splice(1, 0, { id: VACATION_ROLE_ID, label: 'В отпуске', tier: 0.5, color: '#14b8a6', perms: [] });
        } else {
            const vacationRole = this.data.roles.find(r => r.id === VACATION_ROLE_ID);
            if (vacationRole) {
                vacationRole.label = 'В отпуске';
                vacationRole.tier = 0.5;
                vacationRole.color = '#14b8a6';
                vacationRole.perms = [];
            }
        }

        repairKnownRoleLabels(this.data);
        initializeDefaultBonusPermissions(this.data);

        this.data.users.forEach(u => {
            if (!u.cart) u.cart = [];
            if (u.isArchived === undefined) u.isArchived = false;
            if (!u.archivedCompanies || typeof u.archivedCompanies !== 'object' || Array.isArray(u.archivedCompanies)) u.archivedCompanies = {};
            if (u.isArchived && Object.keys(u.archivedCompanies).length === 0) {
                const fallbackCompanies = Array.isArray(u.authorizedCompanies) && u.authorizedCompanies.length
                    ? u.authorizedCompanies
                    : (u.companyId ? [u.companyId] : []);
                fallbackCompanies.forEach(companyId => {
                    if (companyId) u.archivedCompanies[companyId] = true;
                });
            }
            u.isArchived = false;
            if (!u.accountStatus) u.accountStatus = u.isPendingActivation ? 'ожидание' : 'активен';
            if (u.role === PENDING_ROLE_ID) u.role = 'helper';
            if (u.companyRoles && typeof u.companyRoles === 'object' && !Array.isArray(u.companyRoles)) {
                Object.keys(u.companyRoles).forEach(companyId => {
                    if (u.companyRoles[companyId] === PENDING_ROLE_ID) {
                        u.companyRoles[companyId] = 'helper';
                    }
                });
            }
            if (u.mustChangePassword === undefined) u.mustChangePassword = false;
            if (u.discordId === undefined) u.discordId = '';
            if (!u.vacationRoles || typeof u.vacationRoles !== 'object' || Array.isArray(u.vacationRoles)) u.vacationRoles = {};
            if (u.discordUsername === undefined) u.discordUsername = '';
            if (u.discordAvatarUrl === undefined) u.discordAvatarUrl = '';
            if (u.authUserId === undefined) u.authUserId = null;
            if (u.email === undefined) u.email = '';
            if (!u.reprimands || typeof u.reprimands !== 'object' || Array.isArray(u.reprimands)) u.reprimands = {};
            const normalizedCoins = Number(u.coins);
            u.coins = Number.isFinite(normalizedCoins)
                ? Math.max(0, Math.min(MAX_USER_BALANCE, Math.trunc(normalizedCoins)))
                : 0;
            if (u.username === DEFAULT_ADMIN_USERNAME) u.password = DEFAULT_ADMIN_PASSWORD_HASH;
            // Multi-Server Access Migration
            if (!u.authorizedCompanies) u.authorizedCompanies = [u.companyId || 'comp_initial'];
            ensureUserCompanyRoles(u);
        });
        ensureDefaultAdminInData(this.data);
        this.data.items.forEach(i => {
            if (!i.itemType) i.itemType = 'item';
        });
        
        if (!this.data.systemConfig) {
            this.data.systemConfig = normalizeSystemConfig();
        } else {
            this.data.systemConfig = normalizeSystemConfig(this.data.systemConfig);
        }

        this.data.companies.forEach(c => {
            if (c.accentColor === undefined) c.accentColor = '#8b5cf6';
            if (c.webhookUrl === undefined) c.webhookUrl = '';
        });

        this.touchData(false);
        
        this.ready = this.initRemote();
    }

    async migrate() {
        let changed = false;
        // Hash any existing plain-text passwords
        for (const u of this.data.users) {
            // SHA-256 hashes are always 64 characters long in hex
            const isHashed = /^[a-f0-9]{64}$/i.test(u.password);
            if (!isHashed) {
                console.log(`[Security] Migrating password for ${u.username}...`);
                u.password = await hashPassword(u.password);
                changed = true;
            }
        }
        if (changed) this.save();
    }

    async initRemote() {
        await this.migrate();
        let serverDatabaseReady = !USE_SERVER_DATABASE_SYNC;
        if (USE_SERVER_DATABASE_SYNC) {
            try {
                const snapshot = await this.loadRemote();
                serverDatabaseReady = true;
                if (snapshot && !USE_LOCAL_STORAGE_CACHE && getSnapshotWeight(snapshot) > 0) {
                    this.applyTableSnapshot(snapshot);
                    ensureDefaultAdminInData(this.data);
                } else if (snapshot && shouldPreferRemoteSnapshot(this.data, snapshot)) {
                    this.applyTableSnapshot(snapshot);
                    ensureDefaultAdminInData(this.data);
                } else {
                    this.remoteSyncReady = true;
                    await this.saveRemote();
                }
            } catch (e) {
                console.error('Server database sync init error', e);
            }
        }
        if (USE_TABLE_MODE && tableGateway.isConfigured()) {
            try {
                const snapshot = await tableGateway.loadTableSnapshot();
                if (snapshot) {
                    this.applyTableSnapshot(snapshot);
                }
            } catch (e) {
                console.error('Table mode init error', e);
            }
        }
        this.remoteSyncReady = serverDatabaseReady;
        this.saveLocal();
        if (!USE_REMOTE_SYNC) {
            console.warn('Remote sync is disabled for security. The app is running in local-only mode.');
            return;
        }
    }

    load() {
        if (!USE_LOCAL_STORAGE_CACHE) {
            this.data = null;
            return;
        }
        try {
            const stored = localStorage.getItem(DB_KEY);
            this.data = stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error("localStorage error", e);
            this.data = null;
        }
    }

    saveLocal() {
        if (!USE_LOCAL_STORAGE_CACHE) {
            try {
                localStorage.removeItem(DB_KEY);
            } catch (e) {}
            this.scheduleRemoteSave();
            return;
        }
        try {
            localStorage.setItem(DB_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error("localStorage error", e);
        }
        this.scheduleRemoteSave();
    }

    async loadRemote() {
        if (!USE_SERVER_DATABASE_SYNC) {
            throw new Error('Remote sync is disabled');
        }
        const response = await fetch('/api/snapshot');
        if (!response.ok) {
            throw new Error('Не удалось загрузить данные из Supabase.');
        }
        const payload = await response.json();
        return payload.snapshot || null;
    }

    async saveRemote() {
        if (!USE_SERVER_DATABASE_SYNC || !this.remoteSyncReady) {
            return;
        }
        const response = await fetch('/api/snapshot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                snapshot: this.data,
                actorUserId: currentUser && currentUser.id ? currentUser.id : null
            })
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || 'Не удалось сохранить данные в Supabase.');
        }
        hasShownLocalPostgresSyncError = false;
    }

    scheduleRemoteSave() {
        if (!USE_SERVER_DATABASE_SYNC || !this.remoteSyncReady) return;
        if (this.remoteSaveTimer) {
            clearTimeout(this.remoteSaveTimer);
        }
        this.remoteSaveTimer = setTimeout(() => {
            const saveTask = this.remoteSaveQueue
                .catch(() => {})
                .then(() => this.saveRemote());
            this.remoteSaveQueue = saveTask;
            this.pendingRemoteSave = saveTask;
            saveTask.catch((error) => {
                console.error('Server database save failed', error);
                if (!hasShownLocalPostgresSyncError) {
                    hasShownLocalPostgresSyncError = true;
                    showToast(error.message || 'Не удалось синхронизировать данные с Supabase.', 'error');
                }
            }).finally(() => {
                if (this.pendingRemoteSave === saveTask) {
                    this.pendingRemoteSave = null;
                }
            });
        }, 200);
    }

    async flushRemoteSave() {
        if (!USE_SERVER_DATABASE_SYNC || !this.remoteSyncReady) return;
        if (this.remoteSaveTimer) {
            clearTimeout(this.remoteSaveTimer);
            this.remoteSaveTimer = null;
        }
        const saveTask = this.remoteSaveQueue
            .catch(() => {})
            .then(() => this.saveRemote());
        this.remoteSaveQueue = saveTask;
        this.pendingRemoteSave = saveTask;
        try {
            await saveTask;
        } finally {
            if (this.pendingRemoteSave === saveTask) {
                this.pendingRemoteSave = null;
            }
        }
    }

    getHeaders(extra) {
        return Object.assign({}, extra || {});
    }

    save() {
        this.touchData();
        this.saveLocal();
        this.scheduleRemoteSave();
        return Promise.resolve();
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    getDataTimestamp(data, fallbackUpdatedAt) {
        if (!data) return fallbackUpdatedAt ? Date.parse(fallbackUpdatedAt) || 0 : 0;
        if (data._lastSavedAt) {
            const parsed = Date.parse(data._lastSavedAt);
            if (!Number.isNaN(parsed)) return parsed;
        }
        if (fallbackUpdatedAt) {
            const parsedFallback = Date.parse(fallbackUpdatedAt);
            if (!Number.isNaN(parsedFallback)) return parsedFallback;
        }
        return 0;
    }

    touchData(updateTimestamp = true) {
        if (!this.data || typeof this.data !== 'object') return;
        if (updateTimestamp || !this.data._lastSavedAt) {
            this.data._lastSavedAt = new Date().toISOString();
        }
    }

    applyTableSnapshot(snapshot) {
        if (!snapshot) return;
        if (snapshot.companies) this.data.companies = snapshot.companies;
        if (snapshot.items) this.data.items = snapshot.items;
        if (snapshot.codes) this.data.codes = snapshot.codes;
        if (snapshot.roles) this.data.roles = snapshot.roles;
        if (snapshot.users) this.data.users = snapshot.users;
        if (snapshot.logs) this.data.logs = snapshot.logs;
        if (snapshot.systemConfig) this.data.systemConfig = normalizeSystemConfig(snapshot.systemConfig);
        ensureDefaultAdminInData(this.data);
        repairKnownRoleLabels(this.data);
        initializeDefaultBonusPermissions(this.data);
        this.touchData(false);
    }
}

const db = new Database();
const tableGateway = new SupabaseTableGateway();
const authGateway = new SupabaseAuthGateway();
let currentUser = null;
let currentCompanyId = 'comp_initial';
let profileDiscordEditMode = false;
let hasShownLocalPostgresSyncError = false;
let expandedPurchaseLogIds = new Set();
let isServerSwitcherOpen = false;
let selectedStaffProfileUserId = null;
const STAFF_PROFILE_STORAGE_KEY = 'staff_profile_user_id';

async function initApp() {
    await db.ready;
    if (!USE_SUPABASE_AUTH) {
        authGateway.clearSession();
    }
    try {
        selectedStaffProfileUserId = sessionStorage.getItem(STAFF_PROFILE_STORAGE_KEY) || null;
    } catch (e) {}
    try {
        const session = sessionStorage.getItem('session_user_id');
        if (session && db.data) {
            currentUser = db.data.users.find(u => u.id === session) || db.data.users.find(u => u.username === DEFAULT_ADMIN_USERNAME) || null;
            if (currentUser && !currentUser.cart) currentUser.cart = [];
            if (currentUser) {
                currentCompanyId = sessionStorage.getItem('admin_context_company') || currentUser.companyId || 'comp_initial';
            }
        }
    } catch (e) {}

    const handledDiscordCallback = await handleDiscordOAuthCallback();
    if (handledDiscordCallback) {
        ensureValidCurrentCompany();
        renderRoute();
        showPendingReloadToast();
        return;
    }

    const authContext = await authGateway.restoreSessionContext();
    if (authContext && authContext.appUser) {
        applyAuthenticatedSnapshot(authContext.snapshot);
        currentUser = upsertLocalUser(authContext.appUser);
        if (currentUser && !currentUser.cart) currentUser.cart = [];
        if (currentUser) {
            try { sessionStorage.setItem('session_user_id', currentUser.id); } catch (e) {}
            currentCompanyId = sessionStorage.getItem('admin_context_company') || currentUser.companyId || 'comp_initial';
            ensureValidCurrentCompany();
        }
    }

    renderRoute();
    showPendingReloadToast();
}

function renderRoute() {
    const root = document.getElementById('appRoot');
    root.innerHTML = '';
    
    if (!currentUser) {
        if (window.location.hash === '#register') {
            renderRegister(root);
        } else {
            renderLogin(root);
        }
    } else if (currentUser.mustChangePassword) {
        renderForcedPasswordSetup(root);
    } else {
        renderDashboard(root);
    }
}

window.addEventListener('hashchange', renderRoute);

function getCursorTooltip() {
    let tooltip = document.getElementById('cursorTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'cursorTooltip';
        tooltip.className = 'cursor-tooltip';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

function moveCursorTooltip(event) {
    const tooltip = document.getElementById('cursorTooltip');
    if (!tooltip) return;

    tooltip.style.left = (event.clientX + 14) + 'px';
    tooltip.style.top = (event.clientY + 14) + 'px';
}

function showCursorTooltip(event, text) {
    const tooltip = getCursorTooltip();
    tooltip.textContent = text;
    tooltip.classList.add('is-visible');
    moveCursorTooltip(event);
}

function hideCursorTooltip() {
    const tooltip = document.getElementById('cursorTooltip');
    if (!tooltip) return;

    tooltip.classList.remove('is-visible');
}

function showToast(message, type) {
    type = type || 'success';
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const key = type + '::' + message;
    const existingToast = Array.from(container.querySelectorAll('.toast'))
        .find(toastNode => toastNode.dataset.toastKey === key);

    const ensureClearAllButton = () => {
        const toasts = container.querySelectorAll('.toast');
        let clearButton = container.querySelector('.toast-clear-all');
        if (toasts.length > 1) {
            if (!clearButton) {
                clearButton = document.createElement('button');
                clearButton.className = 'toast-clear-all';
                clearButton.textContent = 'Очистить все';
                clearButton.onclick = () => {
                    container.querySelectorAll('.toast').forEach(toastNode => toastNode.remove());
                    clearButton.remove();
                };
                container.appendChild(clearButton);
            }
        } else if (clearButton) {
            clearButton.remove();
        }
    };

    const scheduleRemoval = (toastNode) => {
        if (!toastNode) return;
        if (toastNode._toastTimeout) clearTimeout(toastNode._toastTimeout);
        const progress = toastNode.querySelector('.toast-progress');
        if (progress) {
            progress.style.animation = 'none';
            void progress.offsetWidth;
            progress.style.animation = 'toastProgress 4s linear forwards';
        }
        toastNode._toastTimeout = setTimeout(() => {
            if (toastNode.parentElement) toastNode.remove();
            ensureClearAllButton();
        }, 4000);
    };

    if (existingToast) {
        const count = (parseInt(existingToast.dataset.count || '1', 10) || 1) + 1;
        existingToast.dataset.count = String(count);
        const counter = existingToast.querySelector('.toast-count');
        if (counter) counter.textContent = '×' + count;
        scheduleRemoval(existingToast);
        ensureClearAllButton();
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.dataset.toastKey = key;
    toast.dataset.count = '1';
    toast.innerHTML = [
        '<div class="toast-content">',
            '<span class="toast-message">' + escapeHTML(message) + '</span>',
            '<span class="toast-count" style="display:none">×1</span>',
        '</div>',
        '<button class="toast-close" type="button" aria-label="Закрыть">×</button>',
        '<div class="toast-progress"></div>'
    ].join('');

    const closeButton = toast.querySelector('.toast-close');
    if (closeButton) {
        closeButton.onclick = () => {
            if (toast._toastTimeout) clearTimeout(toast._toastTimeout);
            toast.remove();
            ensureClearAllButton();
        };
    }

    container.prepend(toast);
    scheduleRemoval(toast);
    ensureClearAllButton();
}

function showPendingReloadToast() {
    try {
        const raw = sessionStorage.getItem(POST_RELOAD_TOAST_KEY);
        if (!raw) return;
        sessionStorage.removeItem(POST_RELOAD_TOAST_KEY);
        const payload = JSON.parse(raw);
        if (!payload || !payload.message) return;
        showToast(payload.message, payload.type || 'success');
    } catch (e) {}
}

function renderLogin(root) {
    if (!db.data) {
        root.innerHTML = '<h2 style="color:white;text-align:center;padding:2rem;">Загрузка локальной базы данных...</h2>';
        return;
    }
    ensureDefaultAdminInData(db.data);
    root.innerHTML = [
        '<div class="auth-container">',
            '<div class="glass-panel">',
                '<h2>Вход в ModShop</h2>',
                '<p class="subtitle">Вход по нику и паролю</p>',
                '<form id="loginForm">',
                    '<div class="form-group">',
                        '<label>Имя пользователя (ваш игровой ник)</label>',
                        '<input type="text" id="l_username" class="form-control" required autocomplete="username">',
                    '</div>',
                    '<div class="form-group">',
                        '<label>Пароль</label>',
                        '<input type="password" id="l_password" class="form-control" required autocomplete="current-password">',
                        '<button type="button" class="password-reset-link" onmouseenter="showCursorTooltip(event, \'Обратитесь к старшей модерации сервера\')" onmousemove="moveCursorTooltip(event)" onmouseleave="hideCursorTooltip()" onclick="showToast(\'Обратитесь к старшей модерации сервера\', \'info\')">Сброс пароля</button>',
                    '</div>',
                    '<button type="submit" class="btn btn-primary">Войти</button>',
                '</form>',
                (isDiscordOAuthConfigured()
                    ? '<button type="button" class="btn btn-outline" id="discordLoginBtn" style="margin-top:0.85rem; width:100%; border-color:#5865F2; color:#c7d2fe;">Войти через Discord</button>'
                    : ''),
                '<div class="switch-auth">',
                    'Нет аккаунта? <a href="#register">Регистрация по инвайт-коду</a>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');

    document.getElementById('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        const identity = document.getElementById('l_username').value.trim();
        const pw = document.getElementById('l_password').value;

        const authManagedByUsername = db.data.users.find(u => u.username === identity && isAuthManagedUser(u) && u.email);
        if (authManagedByUsername && authGateway.isConfigured()) {
            try {
                const session = await authGateway.signInWithPassword(authManagedByUsername.email, pw);
                const authContext = await authGateway.hydrateCurrentUserFromSession(session);
                applyAuthenticatedSnapshot(authContext.snapshot);
                currentUser = upsertLocalUser(authContext.appUser);
                if (!currentUser.cart) currentUser.cart = [];
                try { sessionStorage.setItem('session_user_id', currentUser.id); } catch(err){}
                currentCompanyId = sessionStorage.getItem('admin_context_company') || currentUser.companyId || 'comp_initial';
                ensureValidCurrentCompany();
                window.location.hash = '';
                showToast('С возвращением, ' + currentUser.username);
                renderRoute();
                return;
            } catch (error) {
                // Fall through to local password check if the hidden auth route fails.
            }
        }

        const hpw = await hashPassword(pw);
        const user = db.data.users.find(u => u.username === identity && u.password === hpw);
        if (user) {
            if (user.isPendingActivation) {
                showToast('Аккаунт еще не активирован. Используйте инвайт-код, чтобы задать пароль.', 'error');
                return;
            }
            const preferredCompanyId = getPreferredActiveCompanyId(user);
            if (!preferredCompanyId) {
                showToast('Аккаунт деактивирован.', 'error');
                return;
            }
            currentUser = user;
            if (!currentUser.cart) currentUser.cart = [];
            try { sessionStorage.setItem('session_user_id', user.id); } catch(err){}
            currentCompanyId = preferredCompanyId;
            window.location.hash = '';
            showToast('С возвращением, ' + user.username);
            renderRoute();
        } else {
            showToast('Неверные данные для входа', 'error');
        }
    };

    const discordLoginBtn = document.getElementById('discordLoginBtn');
    if (discordLoginBtn) {
        discordLoginBtn.onclick = () => {
            window.location.href = buildDiscordOAuthUrl('login');
        };
    }
}

function renderForcedPasswordSetup(root) {
    const eUsername = escapeHTML(currentUser.username);
    root.innerHTML = [
        '<div class="auth-container">',
            '<div class="glass-panel">',
                '<h2>Смена пароля обязательна</h2>',
                '<p class="subtitle">Для аккаунта <strong>' + eUsername + '</strong> был выполнен сброс пароля. Перед продолжением нужно установить новый пароль.</p>',
                '<form id="forcedPasswordForm">',
                    '<div class="form-group">',
                        '<label>Новый пароль</label>',
                        '<input type="password" id="forced_new_pwd" class="form-control" required autocomplete="new-password">',
                    '</div>',
                    '<div class="form-group">',
                        '<label>Подтвердите пароль</label>',
                        '<input type="password" id="forced_confirm_pwd" class="form-control" required autocomplete="new-password">',
                    '</div>',
                    '<button type="submit" class="btn btn-primary">Сохранить новый пароль</button>',
                '</form>',
                '<div class="switch-auth" style="margin-top:1rem;">Пока новый пароль не установлен, остальные вкладки недоступны.</div>',
            '</div>',
        '</div>'
    ].join('');

    const forcedForm = document.getElementById('forcedPasswordForm');
    if (forcedForm) {
        forcedForm.onsubmit = async (e) => {
            e.preventDefault();
            await executePasswordChange(true);
        };
    }
}

function renderRegister(root) {
    root.innerHTML = [
        '<div class="auth-container">',
            '<div class="glass-panel">',
                '<h2>Регистрация в Nexus</h2>',
                '<p class="subtitle">Используйте инвайт-код для активации вашего аккаунта.</p>',
                '<form id="registerForm">',
                    '<div class="form-group">',
                        '<label>Инвайт-Код</label>',
                        '<input type="text" id="r_code" class="form-control" required autocomplete="off">',
                    '</div>',
                    '<div class="form-group">',
                        '<label>Задайте новый пароль</label>',
                        '<input type="password" id="r_password" class="form-control" required>',
                    '</div>',
                    '<button type="submit" class="btn btn-primary" id="activateAccountBtn">Активировать Аккаунт</button>',
                '</form>',
                '<div class="switch-auth">',
                    'Уже есть аккаунт? <a href="#">Назад ко входу</a>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');

    document.getElementById('registerForm').onsubmit = async (e) => {
        e.preventDefault();
        const registerForm = e.currentTarget;
        const submitButton = document.getElementById('activateAccountBtn');
        const formControls = Array.from(registerForm.querySelectorAll('input, button'));
        formControls.forEach(control => { control.disabled = true; });
        if (submitButton) {
            submitButton.classList.add('is-loading');
            submitButton.innerHTML = '<span class="btn-loading-spinner" aria-hidden="true"></span><span>Активируем аккаунт...</span>';
        }

        try {
        const codeValue = document.getElementById('r_code').value.trim();
        const pw = document.getElementById('r_password').value;
        const finalizeActivationLogin = (user, usernameLabel) => {
            if (!user) {
                showToast('Аккаунт активирован, но не удалось открыть сессию автоматически.', 'error');
                return;
            }
            currentUser = db.data.users.find(u => u.id === user.id) || user;
            if (!currentUser.cart) currentUser.cart = [];
            const preferredCompanyId = getPreferredActiveCompanyId(currentUser) || currentUser.companyId || 'comp_initial';
            currentCompanyId = preferredCompanyId;
            try {
                sessionStorage.setItem('session_user_id', currentUser.id);
                sessionStorage.setItem('admin_context_company', currentCompanyId);
                sessionStorage.setItem('active_tab', 'profile');
            } catch (err) {}
            if (window.location.hash) {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            }
            ensureValidCurrentCompany();
            showToast('Аккаунт ' + usernameLabel + ' активирован. Добро пожаловать!');
            renderRoute();
        };
        const localCodeObj = db.data.codes.find(c => c.code === codeValue && !c.isUsed);
        if (!localCodeObj && authGateway.isConfigured()) {
            try {
                const passwordHash = await hashPassword(pw);
                const result = await authGateway.rpcActivateInvite({
                    invite_code_value: codeValue,
                    new_password_hash: passwordHash
                });

                if (result && result.user) {
                    const activatedUser = tableGateway.mapUserRow(result.user);
                    upsertLocalUser(activatedUser);
                }
                if (result && result.code) {
                    const updatedCode = tableGateway.mapCodeRow(result.code);
                    const existingCodeIndex = db.data.codes.findIndex(code => code.id === updatedCode.id);
                    if (existingCodeIndex >= 0) db.data.codes[existingCodeIndex] = updatedCode;
                    else db.data.codes.push(updatedCode);
                }
                db.saveLocal();
                const activatedUsername = (result && result.username ? result.username : 'пользователя');
                const activatedLocalUser = (result && result.user)
                    ? (db.data.users.find(u => u.id === result.user.id) || null)
                    : null;
                finalizeActivationLogin(activatedLocalUser, activatedUsername);
                return;
            } catch (error) {
                showToast(error.message || 'Не удалось активировать аккаунт по коду.', 'error');
                return;
            }
        }

        const codeObj = localCodeObj;
        if (!codeObj) {
            showToast('Неверный или просроченный код', 'error');
            return;
        }
        
        const targetUn = codeObj.targetUsername;
        const assignedCompId = codeObj.companyId || 'comp_initial';
        const reservedUser = db.data.users.find(u => u.companyId === assignedCompId && u.username === targetUn && u.inviteCodeId === codeObj.id);
          const usersWithSameUsername = db.data.users.filter(u => {
              if (!u || !u.username) return false;
              if (u.inviteCodeId === codeObj.id) return false;
              return u.username.trim().toLowerCase() === targetUn.trim().toLowerCase();
          });
          
          if (usersWithSameUsername.length > 0) {
              showToast('Имя ' + targetUn + ' уже занято в системе.', 'error');
              return;
          }

        if (!reservedUser) {
            showToast('Для этого кода не найден предсозданный аккаунт.', 'error');
            return;
        }

          const hpw = await hashPassword(pw);
          reservedUser.password = hpw;
          reservedUser.isPendingActivation = false;
          reservedUser.role = 'helper';
          ensureUserCompanyRoles(reservedUser);
          reservedUser.companyRoles[assignedCompId] = 'helper';
          reservedUser.accountStatus = 'активен';
          reservedUser.mustChangePassword = false;
          reservedUser.inviteCodeId = null;
          codeObj.isUsed = true;
          await db.save();
          await db.flushRemoteSave();
          finalizeActivationLogin(reservedUser, targetUn);
        } finally {
            if (document.body.contains(registerForm)) {
                formControls.forEach(control => { control.disabled = false; });
                if (submitButton) {
                    submitButton.classList.remove('is-loading');
                    submitButton.textContent = 'Активировать Аккаунт';
                }
            }
        }
      };
  }

window.switchAdminCompany = (newCompId) => {
    const isWebsiteAdmin = hasGlobalControlAccess();
    const myAllowed = isWebsiteAdmin
        ? (currentUser.authorizedCompanies || [currentUser.companyId])
        : getUserActiveCompanies(currentUser);
    const targetCompanyExists = db.data.companies.some(company => company.id === newCompId);
    
    if (!isWebsiteAdmin && !myAllowed.includes(newCompId)) {
        showToast('У вас нет доступа к этому серверу!', 'error');
        return;
    }

    if (!targetCompanyExists) {
        ensureValidCurrentCompany();
        showToast('Выбранный сервер больше не существует в общей базе. Контекст обновлен автоматически.', 'error');
        renderRoute();
        return;
    }

    currentCompanyId = newCompId;
    sessionStorage.setItem('admin_context_company', newCompId);
    
    // Clear any active cart items
    if (currentUser) {
        currentUser.cart = [];
        const udb = db.data.users.find(u => u.id === currentUser.id);
        if (udb) {
            udb.cart = [];
        }
        db.save();
    }
    isServerSwitcherOpen = false;
    renderRoute();
};

window.toggleServerSwitcher = () => {
    isServerSwitcherOpen = !isServerSwitcherOpen;
    renderRoute();
};

function normalizeDashboardTarget(target) {
    return (target === 'admin' || target === 'highmod') ? 'users' : target;
}

function getDashboardContent() {
    return document.getElementById('dashboardContent');
}

function getActiveDashboardTab() {
    return document.querySelector('.nav-link.active')?.getAttribute('data-target')
        || sessionStorage.getItem('active_tab')
        || 'profile';
}

async function syncDashboardTabData(target) {
    if ((target === 'users' || target === 'logs' || target === 'globalctrl') && isSupabaseSessionActive()) {
        await syncStaffReadSnapshot();
    }
    if (target === 'globalctrl' && isSupabaseSessionActive()) {
        await syncStoreReadSnapshot();
    }
}

function renderDashboardTab(target, content, isWebsiteAdmin) {
    content.innerHTML = '';
    if (target === 'profile') renderProfile(content);
    if (target === 'store') renderStore(content);
    if (target === 'cart') renderCart(content);
    if (target === 'bonuses') renderBonuses(content);
    if (target === 'users') renderUsers(content);
    if (target === 'staffprofile') {
        const selectedUser = getSelectedStaffProfileUser();
        if (selectedUser && hasUserCompanyAccess(selectedUser, currentCompanyId)) {
            renderStaffProfile(content, selectedUser);
        } else {
            setSelectedStaffProfileUser(null);
            sessionStorage.setItem('active_tab', 'users');
            renderUsers(content);
        }
    }
    if (target === 'logs' && hasPermission('view_logs')) renderLogs(content);
    if (target === 'archive' && hasPermission('access_archive')) renderArchive(content);
    if (target === 'globalctrl' && isWebsiteAdmin) renderGlobalControl(content);
}

function canOpenDashboardTarget(target, isWebsiteAdmin) {
    target = normalizeDashboardTarget(target);
    if (target === 'profile' || target === 'store' || target === 'cart' || target === 'users') return true;
    if (target === 'bonuses') return hasPermission('access_bonuses') || hasPermission('review_bonuses');
    if (target === 'staffprofile') return !!getSelectedStaffProfileUser();
    if (target === 'logs') return hasPermission('view_logs');
    if (target === 'archive') return hasPermission('access_archive');
    if (target === 'globalctrl') return !!isWebsiteAdmin;
    return false;
}

function renderDashboard(root) {
    refreshCurrentUserReference();
    const isHighMod = hasPermission('access_mod_panel');
    const isWebsiteAdmin = hasGlobalControlAccess();
    const myAllowed = isWebsiteAdmin
        ? (currentUser.authorizedCompanies || [currentUser.companyId])
        : getUserActiveCompanies(currentUser);
    const availableCompanies = db.data.companies.filter(c => isWebsiteAdmin || myAllowed.includes(c.id));

    let switchTriggerHtml = '';
    let switchOverlayHtml = '';
    if (isWebsiteAdmin || myAllowed.length > 1) {
        const serverCards = availableCompanies.map(c => [
            '<button class="server-overlay-item ' + (currentCompanyId === c.id ? 'active' : '') + '" onclick="switchAdminCompany(\'' + c.id + '\')">',
                '<span class="server-switcher-item-name">' + escapeHTML(c.name) + '</span>',
                '<span class="server-switcher-item-meta">' + (currentCompanyId === c.id ? 'Текущий сервер' : 'Переключить') + '</span>',
            '</button>'
        ].join('')).join('');
        switchTriggerHtml = [
            '<button class="server-strip-trigger ' + (isServerSwitcherOpen ? 'open' : '') + '" type="button" onclick="toggleServerSwitcher()">',
                '<span class="server-strip-trigger-text">Смена сервера</span>',
            '</button>'
        ].join('');
        switchOverlayHtml = [
            '<div class="server-overlay ' + (isServerSwitcherOpen ? 'open' : '') + '" onclick="toggleServerSwitcher()">',
                '<div class="server-overlay-panel" onclick="event.stopPropagation()">',
                    '<div class="server-overlay-head-row">',
                        '<div class="server-overlay-head-block">',
                            '<div class="server-overlay-kicker">ModShop</div>',
                            '<div class="server-overlay-head">Выбор сервера</div>',
                            '<div class="server-overlay-subhead">Открой нужный сервер одним нажатием.</div>',
                        '</div>',
                        '<button class="server-overlay-close" type="button" onclick="toggleServerSwitcher()">Закрыть</button>',
                    '</div>',
                    '<div class="server-overlay-list">' + serverCards + '</div>',
                '</div>',
            '</div>'
        ].join('');
    }

    const currentCompanyDb = db.data.companies.find(c => c.id === currentCompanyId);

    const eUsername = escapeHTML(currentUser.username);
    const eCompName = escapeHTML(currentCompanyDb ? currentCompanyDb.name : 'Неизвестный сервер');
    const securityBanner = '';
    root.innerHTML = [
        '<div class="dashboard-layout">',
            '<aside class="sidebar">',
                '<div class="sidebar-brand" style="font-size:1.2rem;">ModShop · ' + eCompName + '</div>',
                '<nav id="navMenu">',
                    '<a class="nav-link active" data-target="profile">Профиль</a>',
                    '<a class="nav-link" data-target="store">Магазин</a>',
                    '<a class="nav-link" data-target="cart">Корзина (<span id="cartCount">0</span>)</a>',
                    (hasPermission('access_bonuses') || hasPermission('review_bonuses')) ? '<a class="nav-link" data-target="bonuses">Премии</a>' : '',
                    '<a class="nav-link" data-target="users">Сотрудники сервера</a>',
                    hasPermission('view_logs') ? '<a class="nav-link" data-target="logs">Транзакции</a>' : '',
                    hasPermission('access_archive') ? '<a class="nav-link" data-target="archive" style="color:#94a3b8">Архив</a>' : '',
                    isWebsiteAdmin ? '<a class="nav-link" data-target="globalctrl" style="color:var(--secondary)">Панель управления</a>' : '',
                '</nav>',
            '</aside>',
            '<main class="main-content">',
                '<div class="topbar-shell">',
                    '<div class="topbar">',
                        '<div class="topbar-brand-group">',
                            '<button type="button" class="topbar-brand" id="topbarHomeBtn" aria-label="Открыть профиль">ModShop</button>',
                            '<button type="button" class="theme-toggle" id="themeToggle" role="switch" aria-checked="false" title="Включить светлую тему" aria-label="Переключить тему">',
                                '<span class="theme-toggle-track">',
                                    '<span class="theme-toggle-thumb"></span>',
                                '</span>',
                            '</button>',
                        '</div>',
                        '<div class="topbar-center-block">',
                            '<div class="topbar-current-server">' + eCompName + '</div>',
                            switchTriggerHtml,
                        '</div>',
                        '<div style="display:flex; align-items:center; gap: 1rem;">',
                            '<div class="user-snippet">',
                                '<span style="font-weight:600">' + eUsername + '</span>',
                    '<img src="' + getUserAvatarUrl(currentUser.username, 32) + '" class="user-avatar" style="object-fit:cover; image-rendering:pixelated; background:transparent;">',
                                '<button class="btn btn-outline" style="padding: 0.5rem 1rem;" id="logoutBtn">Выйти</button>',
                            '</div>',
                        '</div>',
                    '</div>',
                '</div>',
                switchOverlayHtml,
                securityBanner,
                '<div id="dashboardContent"></div>',
            '</main>',
        '</div>'
    ].join('');

    document.getElementById('logoutBtn').onclick = async () => {
        const authSession = authGateway.getStoredSession();
        if (authSession && authSession.access_token) {
            try {
                await authGateway.signOut(authSession.access_token);
            } catch (e) {}
        }
        authGateway.clearSession();
        currentUser = null;
        try { sessionStorage.removeItem('session_user_id'); } catch(err){}
        showToast('Вы успешно вышли');
        renderRoute();
    };

    const links = document.querySelectorAll('.nav-link');
    const content = getDashboardContent();

    const switchTab = async (target) => {
        target = normalizeDashboardTarget(target);
        if (!canOpenDashboardTarget(target, isWebsiteAdmin)) {
            target = 'profile';
            try { sessionStorage.setItem('active_tab', target); } catch (e) {}
            showToast('Этот раздел недоступен для текущей роли.', 'error');
        }
        links.forEach(l => l.classList.remove('active'));
        const activeNavTarget = target === 'staffprofile' ? 'users' : target;
        const activeLink = document.querySelector('.nav-link[data-target="' + activeNavTarget + '"]');
        if(activeLink) activeLink.classList.add('active');
        
        sessionStorage.setItem('active_tab', target);
        refreshCurrentUserReference();
        if (!currentUser) {
            showToast('Не удалось восстановить текущего пользователя. Войдите заново.', 'error');
            renderRoute();
            return;
        }

        await syncDashboardTabData(target);
        renderDashboardTab(target, content, isWebsiteAdmin);
    };

    links.forEach(l => {
        l.onclick = () => { switchTab(l.getAttribute('data-target')); };
    });

    const topbarHomeBtn = document.getElementById('topbarHomeBtn');
    if (topbarHomeBtn) {
        topbarHomeBtn.onclick = () => { switchTab('profile'); };
    }
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        applyAppTheme(getStoredTheme());
        themeToggle.onclick = toggleAppTheme;
    }

    let lastTab = sessionStorage.getItem('active_tab') || 'profile';
    if (lastTab === 'staffprofile' && !getSelectedStaffProfileUser()) {
        lastTab = 'users';
    }
    if (!canOpenDashboardTarget(lastTab, isWebsiteAdmin)) {
        lastTab = 'profile';
        try { sessionStorage.setItem('active_tab', lastTab); } catch (e) {}
    }
    switchTab(lastTab);
    updateCartBadge();
}

function refreshTopbarServerName() {
    const currentCompany = db.data.companies.find(c => c.id === currentCompanyId);
    const serverName = currentCompany ? currentCompany.name : 'Неизвестный сервер';
    const label = document.querySelector('.topbar-current-server');
    if (label) {
        label.textContent = serverName;
    }
    const sidebarBrand = document.querySelector('.sidebar-brand');
    if (sidebarBrand) {
        sidebarBrand.textContent = 'ModShop · ' + serverName;
    }
}

function getBadge(roleId) {
    const fallbackRole = roleId === VACATION_ROLE_ID
        ? { label: 'В отпуске', color: '#14b8a6' }
        : { label: roleId, color: '#94a3b8' };
    const r = db.data.roles.find(x => x.id === roleId) || fallbackRole;
    const label = isBrokenRoleLabel(r.label) && DEFAULT_ROLE_LABELS[roleId] ? DEFAULT_ROLE_LABELS[roleId] : r.label;
    return '<span class="badge" style="background:rgba(255,255,255,0.1); border:1px solid ' + r.color + '; color:' + r.color + '">' + escapeHTML(label) + '</span>';
}

function getRoleLabel(roleId) {
    if (roleId === VACATION_ROLE_ID) return 'В отпуске';
    const role = db.data.roles.find(x => x.id === roleId);
    if (!role) return DEFAULT_ROLE_LABELS[roleId] || roleId;
    return isBrokenRoleLabel(role.label) && DEFAULT_ROLE_LABELS[roleId] ? DEFAULT_ROLE_LABELS[roleId] : role.label;
}

function getAccountStatusBadge(user) {
    const isWaiting = user.accountStatus === 'ожидание' || user.isPendingActivation;
    if (isWaiting) {
        return '<span class="badge" style="background:rgba(245, 158, 11, 0.12); border:1px solid #f59e0b; color:#f59e0b">Ожидание</span>';
    }
    return '<span class="badge" style="background:rgba(16, 185, 129, 0.12); border:1px solid #10b981; color:#10b981">Активен</span>';
}

function getItemTypeBadge(itemType) {
    if (itemType === 'donate') {
        return '<span class="badge" style="background:rgba(59, 130, 246, 0.12); border:1px solid #3b82f6; color:#93c5fd">Донат</span>';
    }
    return '<span class="badge" style="background:rgba(16, 185, 129, 0.12); border:1px solid #10b981; color:#86efac">Предмет</span>';
}

function normalizeAccentColor(value) {
    const raw = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#8b5cf6';
}

function getValidatedNonNegativePrice(inputId) {
    const input = document.getElementById(inputId);
    const rawValue = input ? String(input.value || '').trim() : '0';
    if (!rawValue) {
        return 0;
    }
    if (rawValue.startsWith('-')) {
        showToast('Цена не может быть отрицательной.', 'error');
        if (input) {
            input.value = '0';
            input.focus();
        }
        return null;
    }
    if (!/^\d+$/.test(rawValue)) {
        showToast('Цена должна содержать только цифры.', 'error');
        return null;
    }
    const parsedValue = Number(rawValue);
    if (parsedValue < 0) {
        showToast('Цена не может быть отрицательной.', 'error');
        if (input) {
            input.value = '0';
            input.focus();
        }
        return null;
    }
    return Math.floor(parsedValue);
}

async function invokeLocalWebhookRelay(webhookUrl, payload) {
    const relayMeta = arguments.length > 2 ? arguments[2] : null;
    if (!USE_LOCAL_WEBHOOK_RELAY) {
        throw new Error('Локальный webhook relay отключен.');
    }
    const response = await fetch('/api/webhook-relay', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            webhookUrl,
            payload,
            meta: relayMeta
        })
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Не удалось отправить webhook через локальный relay.');
    }
    return response.json();
}

async function sendArchiveWebhook(targetUser, companyId, removedByUser) {
    if (!USE_LOCAL_WEBHOOK_RELAY || !targetUser || !companyId) return;

    const company = db.data.companies.find(c => c.id === companyId);
    const webhookUrl = (company && company.webhookUrl)
        ? company.webhookUrl
        : ((db.data.systemConfig && db.data.systemConfig.webhookUrl) || '');

    if (!webhookUrl) return;

    const scopedRoleId = getUserRoleForCompany(targetUser, companyId);
    const scopedRoleLabel = escapeHTML((db.data.roles.find(r => r.id === scopedRoleId) || { label: scopedRoleId || 'Неизвестно' }).label);
    const removedByName = removedByUser ? removedByUser.username : 'Неизвестно';
    const targetName = targetUser.username || 'Неизвестно';
    const targetCoins = Number(targetUser.coins || 0);

    const payload = {
        embeds: [
            {
                title: 'Снятие с должности',
                color: 0xef4444,
                fields: [
                    { name: 'Сотрудник', value: '`' + removedByName + '`', inline: true },
                    { name: 'Снял', value: '`' + targetName + '`', inline: true },
                    { name: 'С роли', value: '`' + scopedRoleLabel + '`', inline: true },
                    { name: 'Накопленные баллы', value: '`' + targetCoins + '`', inline: true },
                    { name: 'Сервер', value: '`' + (company ? company.name : 'Неизвестно') + '`', inline: true }
                ],
                footer: {
                    text: new Date().toLocaleString('ru-RU')
                }
            }
        ]
    };

    await invokeLocalWebhookRelay(webhookUrl, payload);
}

function buildPurchaseMentions(cartItems) {
    return buildPurchaseMentionIds(cartItems).map(id => '<@' + id + '>').join(' ');
}

function buildPurchaseMentionIds(cartItems) {
    const roleTargets = new Set();
    cartItems.forEach(ci => {
        if (ci.itemObj.itemType === 'donate') {
            roleTargets.add('kurator');
            roleTargets.add('server_admin');
        } else {
            roleTargets.add('ST-moderator');
            roleTargets.add('GM');
        }
    });

    const mentionIds = [];

    db.data.users
        .filter(u => hasUserCompanyAccess(u, currentCompanyId) && !isUserArchivedOnCompany(u, currentCompanyId) && roleTargets.has(getUserRoleForCompany(u, currentCompanyId)))
        .forEach(u => {
            const discordId = normalizeDiscordId(u.discordId);
            if (discordId && !mentionIds.includes(discordId)) {
                mentionIds.push(discordId);
            }
        });

    return mentionIds;
}

function hasUserCompanyAccess(user, companyId) {
    if (!user || !companyId) return false;
    if (user.companyId === companyId) return true;
    if (!Array.isArray(user.authorizedCompanies)) return false;
    return user.authorizedCompanies.includes(companyId);
}

function canViewPendingUser(user) {
    return !!user && (!user.isPendingActivation || hasPermission('generate_codes'));
}

function buildPurchaseLogDetails(cartItems) {
    return {
        expiresAt: new Date(Date.now() + PURCHASE_LOG_DETAILS_TTL_MS).toISOString(),
        items: cartItems.map(ci => ({
            name: ci.itemObj.name,
            quantity: ci.quantity,
            price: ci.effectivePrice || ci.itemObj.price,
            subtotal: (ci.effectivePrice || ci.itemObj.price) * ci.quantity
        }))
    };
}

function isValidEnglishUsername(username) {
    return /^[A-Za-z0-9_]+$/.test(username);
}

function findUserByUsernameGlobally(username, excludeUserId) {
    const normalized = String(username || '').trim().toLowerCase();
    if (!normalized) return null;
    return db.data.users.find(user => {
        if (!user || !user.username) return false;
        if (excludeUserId && user.id === excludeUserId) return false;
        return user.username.trim().toLowerCase() === normalized;
    }) || null;
}

function getCompanyNameById(companyId) {
    return db.data.companies.find(company => company.id === companyId)?.name || 'неизвестный сервер';
}

function getUserRegisteredCompanyName(user) {
    if (!user) return 'неизвестный сервер';
    if (user.companyId) return getCompanyNameById(user.companyId);
    if (Array.isArray(user.authorizedCompanies) && user.authorizedCompanies.length) {
        return getCompanyNameById(user.authorizedCompanies[0]);
    }
    return 'неизвестный сервер';
}

function grantExistingUserAccessToCurrentServer(userId) {
    const existingUser = db.data.users.find(user => user.id === userId);
    if (!existingUser) {
        showToast('Пользователь больше не найден в системе.', 'error');
        return false;
    }

    if (!Array.isArray(existingUser.authorizedCompanies)) {
        existingUser.authorizedCompanies = [existingUser.companyId].filter(Boolean);
    }
    ensureUserCompanyRoles(existingUser);

    if (existingUser.authorizedCompanies.includes(currentCompanyId)) {
        showToast('У пользователя уже есть доступ к текущему серверу.', 'error');
        return false;
    }

    existingUser.authorizedCompanies.push(currentCompanyId);
    existingUser.companyRoles[currentCompanyId] = 'helper';
    db.save();

    showToast('Пользователю ' + existingUser.username + ' выдан доступ к серверу ' + getCompanyNameById(currentCompanyId) + '.');
    closeBalanceModal();
    if (typeof renderRoute === 'function') {
        renderRoute();
    }
    return true;
}

function ensureBalanceModalWrapper() {
    let modalWrapper = document.getElementById('balanceModalWrapper');
    if (!modalWrapper) {
        modalWrapper = document.createElement('div');
        modalWrapper.id = 'balanceModalWrapper';
        document.body.appendChild(modalWrapper);
    }
    return modalWrapper;
}

function openExistingUserAccessPrompt(existingUser) {
    if (!existingUser) return;

    const modalWrapper = ensureBalanceModalWrapper();

    const currentServerName = getCompanyNameById(currentCompanyId);
    const alreadyHasCurrentAccess = hasUserCompanyAccess(existingUser, currentCompanyId);
    ensureUserCompanyRoles(existingUser);
    const userCompanyIds = Array.from(new Set([
        existingUser.companyId,
        ...(Array.isArray(existingUser.authorizedCompanies) ? existingUser.authorizedCompanies : [])
    ].filter(Boolean)));
    const occupiedServers = userCompanyIds.map(companyId => {
        const roleId = getUserRoleForCompany(existingUser, companyId);
        return {
            serverName: getCompanyNameById(companyId),
            roleLabel: getRoleLabel(roleId)
        };
    });
    const rolesText = occupiedServers.map(entry => entry.roleLabel).join(', ');
    const serversText = occupiedServers.map(entry => entry.serverName).join(', ');
    const occupiedPairsText = occupiedServers
        .map(entry => entry.roleLabel + ' — ' + entry.serverName)
        .join(', ');
    const roleWord = occupiedServers.length > 1 ? 'должности' : 'должность';
    const serverWord = occupiedServers.length > 1 ? 'серверах' : 'сервере';

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="existing_user_access_overlay">',
            '<div class="modal-content" style="max-width:520px" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1rem">Пользователь уже существует</h3>',
                '<p style="line-height:1.6; margin-bottom:0.75rem;"><strong>' + escapeHTML(existingUser.username) + '</strong> уже занимает ' + roleWord + ' <strong>' + escapeHTML(rolesText) + '</strong>.</p>',
                '<p style="line-height:1.6; margin-bottom:0.5rem;">На ' + serverWord + ': <strong>' + escapeHTML(serversText) + '</strong>.</p>',
                '<p class="text-muted" style="line-height:1.6; margin-bottom:1rem;">Текущие назначения: <strong>' + escapeHTML(occupiedPairsText) + '</strong>.</p>',
                '<p class="text-muted" style="line-height:1.6; margin-bottom:1.5rem;">Вы желаете дать пользователю доступ на текущий сервер <strong>' + escapeHTML(currentServerName) + '</strong>?</p>',
                alreadyHasCurrentAccess
                    ? '<div class="glass-panel" style="padding:0.9rem 1rem; margin-bottom:1.25rem; color:var(--warning);">У пользователя уже есть доступ к текущему серверу.</div>'
                    : '',
                '<div class="action-row mt-4">',
                    (!alreadyHasCurrentAccess ? '<button class="btn btn-primary" id="existing_user_access_yes" type="button">Да</button>' : ''),
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Нет</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');

    document.getElementById('existing_user_access_overlay').onclick = closeBalanceModal;
    const yesBtn = document.getElementById('existing_user_access_yes');
    if (yesBtn) {
        yesBtn.onclick = () => grantExistingUserAccessToCurrentServer(existingUser.id);
    }
}

function getVisiblePurchaseLogDetails(log) {
    if (!log || !log.purchaseDetails || !Array.isArray(log.purchaseDetails.items)) return null;
    const expiresAt = log.purchaseDetails.expiresAt ? Date.parse(log.purchaseDetails.expiresAt) : 0;
    if (expiresAt && expiresAt < Date.now()) return null;
    return log.purchaseDetails;
}

function isPrimaryOwner(user = currentUser) {
    return !!(user && String(user.username || '').trim().toLowerCase() === DEFAULT_ADMIN_USERNAME.toLowerCase());
}

function isProtectedAdminRoleChange(targetUser, newRoleId) {
    const currentRoleId = targetUser ? getUserRoleForCompany(targetUser, currentCompanyId) : '';
    return currentRoleId === 'admin' || newRoleId === 'admin';
}

function canAssignRoleToUser(targetUser, roleId) {
    if (!targetUser) return false;
    if (isProtectedAdminRoleChange(targetUser, roleId) && !isPrimaryOwner()) return false;
    return getAssignableRoles(targetUser).includes(roleId);
}

function getAssignableRoles(targetUser) {
    const rolesArray = [...db.data.roles].sort((a, b) => a.tier - b.tier).map(r => r.id);
    const myTier = getRoleTier(getCurrentUserRoleId());
    let availableRolesToAssign = rolesArray.filter(r => getRoleTier(r) < myTier && r !== PENDING_ROLE_ID && r !== VACATION_ROLE_ID);
    if (myTier === 8) {
        availableRolesToAssign = rolesArray.filter(r => r !== PENDING_ROLE_ID && r !== VACATION_ROLE_ID);
    }
    if (isPrimaryOwner() && !availableRolesToAssign.includes('admin') && rolesArray.includes('admin')) {
        availableRolesToAssign.push('admin');
    }
    if (!isPrimaryOwner()) {
        availableRolesToAssign = availableRolesToAssign.filter(r => r !== 'admin');
        if (targetUser && getUserRoleForCompany(targetUser, currentCompanyId) === 'admin') {
            return [];
        }
    }
    return availableRolesToAssign;
}

function canManageUserBalance(user) {
    if (!hasPermission('edit_balance')) return false;
    const myTier = getRoleTier(getCurrentUserRoleId());
    const userTier = getRoleTier(getEffectiveUserRoleForCompany(user, currentCompanyId));
    return userTier < myTier || user.id === currentUser.id;
}

function canManageUserRole(user) {
    if (!hasPermission('edit_roles')) return false;
    if (user.id === currentUser.id) return false;
    if (isUserOnVacation(user, currentCompanyId)) return false;
    if (isPrimaryOwner()) return true;
    if (getUserRoleForCompany(user, currentCompanyId) === 'admin' && !isPrimaryOwner()) return false;
    const myTier = getRoleTier(getCurrentUserRoleId());
    const userTier = getRoleTier(getEffectiveUserRoleForCompany(user, currentCompanyId));
    return myTier === 8 ? true : userTier < myTier;
}

function canArchiveManagedUser(user) {
    return canManageUserRole(user) && user.id !== currentUser.id;
}

function canResetManagedUserPassword(user) {
    if (!currentUser || !user) return false;
    if (user.id === currentUser.id) return false;
    if (isUserArchivedOnCompany(user, currentCompanyId)) return false;
    const myTier = getRoleTier(getCurrentUserRoleId());
    const targetTier = getRoleTier(getEffectiveUserRoleForCompany(user, currentCompanyId));
    return myTier > 4 && targetTier < myTier;
}

function canManageVacation(user) {
    if (!currentUser || !user) return false;
    if (user.id === currentUser.id) return false;
    if (isUserArchivedOnCompany(user, currentCompanyId)) return false;
    const myTier = getRoleTier(getCurrentUserRoleId());
    const targetTier = getRoleTier(getEffectiveUserRoleForCompany(user, currentCompanyId));
    return myTier > 3 && targetTier < myTier;
}

function canManageUserReprimands(user) {
    if (!currentUser || !user) return false;
    if (user.id === currentUser.id) return false;
    if (isUserArchivedOnCompany(user, currentCompanyId)) return false;
    const myTier = getRoleTier(getCurrentUserRoleId());
    const targetTier = getRoleTier(getEffectiveUserRoleForCompany(user, currentCompanyId));
    return myTier > targetTier;
}

function renderAdmin(container) {
    renderUsers(container);
}





