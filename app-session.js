function upsertLocalUser(userData) {
    if (!userData) return null;
    let existingUser = db.data.users.find(u => u.id === userData.id);
    if (!existingUser && userData.authUserId) {
        existingUser = db.data.users.find(u => u.authUserId === userData.authUserId);
    }
    if (!existingUser && userData.email) {
        existingUser = db.data.users.find(u => u.email && u.email === userData.email);
    }
    if (existingUser) {
        if (existingUser.discordId && !userData.discordId) {
            userData.discordId = existingUser.discordId;
        }
        if (existingUser.mustChangePassword && !userData.mustChangePassword) {
            userData.mustChangePassword = true;
        }
        Object.assign(existingUser, userData);
        return existingUser;
    }
    if (userData.mustChangePassword === undefined) {
        userData.mustChangePassword = false;
    }
    db.data.users.push(userData);
    db.saveLocal();
    return userData;
}

function upsertLocalCompany(companyData) {
    if (!companyData) return null;
    const existingCompany = db.data.companies.find(company => company.id === companyData.id);
    if (existingCompany) {
        Object.assign(existingCompany, companyData);
        return existingCompany;
    }
    db.data.companies.push(companyData);
    db.saveLocal();
    return companyData;
}

function applyAuthenticatedSnapshot(snapshot) {
    if (!snapshot) return;
    if (Array.isArray(snapshot.companies) && snapshot.companies.length) {
        db.data.companies = snapshot.companies;
    }
    if (Array.isArray(snapshot.items)) {
        db.data.items = snapshot.items;
    }
    if (Array.isArray(snapshot.roles) && snapshot.roles.length) {
        db.data.roles = snapshot.roles;
    }
    if (Array.isArray(snapshot.logs)) {
        db.data.logs = snapshot.logs;
    }
    if (snapshot.systemConfig) {
        db.data.systemConfig = normalizeSystemConfig(snapshot.systemConfig);
    }
    ensureValidCurrentCompany();
    db.saveLocal();
}

function isAuthManagedUser(user) {
    return !!(user && (user.authUserId || user.email));
}

function isSupabaseSessionActive() {
    return !!authGateway.getStoredSession();
}

function ensureValidCurrentCompany() {
    const companies = Array.isArray(db.data.companies) ? db.data.companies : [];
    if (!companies.length) return;

    const allowedCompanies = currentUser
        ? getUserActiveCompanies(currentUser)
        : [companies[0].id];

    const existingAllowedCompanies = companies.filter(company => allowedCompanies.includes(company.id));
    const preferredCompanyId = existingAllowedCompanies.length ? existingAllowedCompanies[0].id : companies[0].id;
    const currentCompanyExists = companies.some(company => company.id === currentCompanyId);
    const currentCompanyAllowed = allowedCompanies.includes(currentCompanyId);

    if (!currentCompanyExists || !currentCompanyAllowed) {
        currentCompanyId = preferredCompanyId;
        try {
            sessionStorage.setItem('admin_context_company', currentCompanyId);
        } catch (e) {}
    }
}

function refreshCurrentUserReference() {
    if (!currentUser || !db.data || !Array.isArray(db.data.users)) return currentUser;
    const refreshedUser =
        db.data.users.find(u => u.id === currentUser.id) ||
        db.data.users.find(u => u.username === currentUser.username) ||
        db.data.users.find(u => u.email && currentUser.email && u.email === currentUser.email) ||
        currentUser;
    currentUser = refreshedUser;
    if (currentUser && currentUser.id) {
        try { sessionStorage.setItem('session_user_id', currentUser.id); } catch (e) {}
    }
    return currentUser;
}

function getSelectedStaffProfileUser() {
    if (!selectedStaffProfileUserId) return null;
    return db.data.users.find(u => u.id === selectedStaffProfileUserId) || null;
}

function setSelectedStaffProfileUser(userId) {
    selectedStaffProfileUserId = userId || null;
    try {
        if (selectedStaffProfileUserId) sessionStorage.setItem(STAFF_PROFILE_STORAGE_KEY, selectedStaffProfileUserId);
        else sessionStorage.removeItem(STAFF_PROFILE_STORAGE_KEY);
    } catch (e) {}
}

async function syncStaffReadSnapshot() {
    const authSession = authGateway.getStoredSession();
    if (!authSession || !authSession.access_token || !currentUser) return false;
    if (!hasPermission('access_mod_panel') && !hasPermission('generate_codes') && !hasPermission('view_logs') && !hasPermission('access_global_hub')) return false;

    try {
        const snapshot = await authGateway.loadStaffSnapshot(authSession.access_token, {
            includeUsers: hasPermission('access_mod_panel') || hasPermission('access_global_hub'),
            includeCodes: hasPermission('generate_codes'),
            includeLogs: hasPermission('view_logs') || hasPermission('access_global_hub')
        });
        if (Array.isArray(snapshot.users) && snapshot.users.length) {
            const hydratedRemoteUsers = snapshot.users.map(user => {
                const existing = db.data.users.find(localUser => localUser.id === user.id);
                if (existing && existing.discordId && !user.discordId) {
                    user.discordId = existing.discordId;
                }
                return existing ? Object.assign(existing, user) : user;
            });
            db.data.users = hydratedRemoteUsers;
        }
        if (Array.isArray(snapshot.codes)) {
            const localOtherCompanyCodes = db.data.codes.filter(code => code.companyId !== currentCompanyId);
            db.data.codes = localOtherCompanyCodes.concat(snapshot.codes);
        }
        if (Array.isArray(snapshot.logs)) {
            db.data.logs = snapshot.logs;
        }
        db.saveLocal();
        if (currentUser) {
            currentUser = db.data.users.find(user => user.id === currentUser.id) || currentUser;
        }
        return true;
    } catch (error) {
        console.error('Staff read sync failed', error);
        showToast('Не удалось обновить staff-данные из Supabase. Остаемся на локальном снапшоте.', 'error');
        return false;
    }
}

async function syncStoreReadSnapshot() {
    const authSession = authGateway.getStoredSession();
    if (!authSession || !authSession.access_token || !currentUser) return false;
    try {
        const snapshot = await authGateway.loadAuthorizedSnapshot(authSession.access_token);
        applyAuthenticatedSnapshot(snapshot);
        if (snapshot.companyAccess && snapshot.companyAccess.length) {
            currentUser.authorizedCompanies = [...new Set([currentUser.companyId].concat(snapshot.companyAccess))];
        }
        currentUser = db.data.users.find(user => user.id === currentUser.id) || currentUser;
        return true;
    } catch (error) {
        console.error('Store read sync failed', error);
        showToast('Не удалось обновить магазин из Supabase.', 'error');
        return false;
    }
}

function updateCartBadge() {
    const el = document.getElementById('cartCount');
    if (el && currentUser && currentUser.cart) {
        let cnt = 0;
        currentUser.cart.forEach(c => { cnt += c.quantity; });
        el.innerText = cnt;
    }
}

db.ready.then(() => initApp());
