function getBonusStatusBadge(status) {
    if (status === 'approved') return '<span class="badge badge-success" style="background:var(--success);color:white">Одобрена</span>';
    if (status === 'rejected') return '<span class="badge badge-error">Отклонена</span>';
    return '<span class="badge" style="border:1px solid var(--warning); color:var(--warning); background:rgba(245,158,11,0.12)">На рассмотрении</span>';
}

function renderBonuses(container) {
    const canCreateBonus = hasPermission('access_bonuses');
    const canReviewBonus = hasPermission('review_bonuses');
    const requests = getBonusRequests()
        .filter(request => request.companyId === currentCompanyId)
        .filter(request => canReviewBonus || request.userId === currentUser.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const pendingCount = requests.filter(request => request.status === 'pending').length;
    const rows = requests.length ? requests.map(request => {
        const user = db.data.users.find(u => u.id === request.userId);
        const reviewer = request.reviewedBy ? db.data.users.find(u => u.id === request.reviewedBy) : null;
        const reviewActions = canReviewBonus && request.status === 'pending'
            ? [
                '<div style="display:flex; gap:0.5rem; flex-wrap:wrap;">',
                    '<button class="btn btn-success" style="padding:0.35rem 0.7rem; width:auto;" onclick="approveBonusRequest(\'' + request.id + '\')">Одобрить</button>',
                    '<button class="btn btn-danger" style="padding:0.35rem 0.7rem; width:auto;" onclick="rejectBonusRequest(\'' + request.id + '\')">Отклонить</button>',
                '</div>'
            ].join('')
            : '<span style="color:var(--text-muted)">' + (reviewer ? escapeHTML(reviewer.username) : '—') + '</span>';

        return [
            '<tr>',
                '<td><strong>' + escapeHTML(user ? user.username : 'Неизвестно') + '</strong><div class="text-muted" style="font-size:0.78rem;">' + new Date(request.createdAt).toLocaleString() + '</div></td>',
                '<td>' + escapeHTML(request.reasonLabel) + '</td>',
                '<td>' + escapeHTML(request.comment || '—') + '</td>',
                '<td><strong style="color:var(--warning)">' + formatCoinAmount(request.amount) + '</strong></td>',
                '<td>' + getBonusStatusBadge(request.status) + (request.reviewComment ? '<div class="text-muted" style="font-size:0.78rem; margin-top:0.25rem;">' + escapeHTML(request.reviewComment) + '</div>' : '') + '</td>',
                '<td>' + reviewActions + '</td>',
            '</tr>'
        ].join('');
    }).join('') : '<tr><td colspan="6">Заявок на премии пока нет.</td></tr>';

    container.innerHTML = [
        '<div class="flex-between mb-3">',
            '<div>',
                '<h3 class="mb-2">Премии</h3>',
                '<p class="text-muted">Заявки на поощрение сотрудников текущего сервера.</p>',
            '</div>',
            canCreateBonus ? '<button class="btn btn-primary" style="width:auto;" onclick="openBonusRequestModal()">Оставить заявку</button>' : '',
        '</div>',
        '<div class="glass-panel mb-4" style="max-width:100%; padding:1rem 1.25rem; border:1px solid rgba(239,68,68,0.35); background:rgba(239,68,68,0.10); color:#fecaca; font-weight:700;">ВНИМАНИЕ: злоупотребление либо оставление некоректных заявок карается штрафом/выговором</div>',
        '<div class="staff-summary-row">',
            '<div class="staff-summary-card"><span class="staff-summary-label">Всего заявок</span><strong>' + requests.length + '</strong></div>',
            '<div class="staff-summary-card"><span class="staff-summary-label">На рассмотрении</span><strong>' + pendingCount + '</strong></div>',
            '<div class="staff-summary-card"><span class="staff-summary-label">Режим</span><strong>' + (canReviewBonus ? 'Рассмотрение' : 'Мои заявки') + '</strong></div>',
        '</div>',
        '<div class="table-container">',
            '<table>',
                '<thead><tr><th>Сотрудник</th><th>Причина</th><th>Комментарий</th><th>Сумма</th><th>Статус</th><th>Действие</th></tr></thead>',
                '<tbody>' + rows + '</tbody>',
            '</table>',
        '</div>'
    ].join('');
}

function openBonusRequestModal() {
    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="bonus_overlay">',
            '<div class="modal-content" style="max-width:560px" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1rem;">Заявка на премию</h3>',
                '<div class="form-group">',
                    '<label>Причина заявки</label>',
                    '<input type="text" class="form-control" id="bonus_reason_label" maxlength="120" placeholder="Например, разбор темы на форуме">',
                '</div>',
                '<div class="form-group">',
                    '<label>Комментарий (ссылка на тему / #тикета)</label>',
                    '<textarea class="form-control" id="bonus_comment" rows="4" maxlength="500" placeholder="Добавьте ссылку, номер тикета или краткий комментарий"></textarea>',
                '</div>',
                '<div class="form-group">',
                    '<label>Сумма надбавки</label>',
                    '<input type="number" class="form-control" id="bonus_amount" min="1" max="' + MAX_USER_BALANCE + '" inputmode="numeric" placeholder="Например, 100">',
                '</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" onclick="submitBonusRequest()">Отправить заявку</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
    document.getElementById('bonus_overlay').onclick = closeBalanceModal;
}

function submitBonusRequest() {
    const reasonLabel = (document.getElementById('bonus_reason_label')?.value || '').trim();
    const amount = Math.trunc(Number(document.getElementById('bonus_amount')?.value || 0));
    const comment = (document.getElementById('bonus_comment')?.value || '').trim();

    if (!reasonLabel) return showToast('Укажите причину заявки.', 'error');
    if (!comment) return showToast('Добавьте комментарий к заявке.', 'error');
    if (!Number.isFinite(amount) || amount <= 0) return showToast('Укажите корректную сумму надбавки.', 'error');

    const requests = getBonusRequests();
    requests.push({
        id: db.generateId(),
        companyId: currentCompanyId,
        userId: currentUser.id,
        reasonId: '',
        reasonLabel,
        fieldType: 'none',
        forumUrl: '',
        ticketNumber: '',
        comment,
        amount: Math.min(amount, MAX_USER_BALANCE),
        status: 'pending',
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        reviewComment: ''
    });
    db.data.systemConfig.bonusRequests = requests;
    db.save();
    closeBalanceModal();
    showToast('Заявка на премию отправлена.');
    renderBonuses(getDashboardContent());
}

function approveBonusRequest(requestId) {
    if (!hasPermission('review_bonuses')) return showToast('Нет прав на рассмотрение премий.', 'error');
    const request = getBonusRequests().find(item => item.id === requestId);
    if (!request || request.status !== 'pending') return;
    const targetUser = db.data.users.find(user => user.id === request.userId);
    if (!targetUser) return showToast('Пользователь заявки не найден.', 'error');
    const oldBalance = Number(targetUser.coins || 0);
    const nextBalance = Math.min(MAX_USER_BALANCE, oldBalance + Number(request.amount || 0));
    targetUser.coins = nextBalance;
    if (currentUser.id === targetUser.id) currentUser.coins = nextBalance;
    request.status = 'approved';
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = currentUser.id;
    db.data.logs.push({
        id: db.generateId(),
        userId: targetUser.id,
        modifierId: currentUser.id,
        companyId: currentCompanyId,
        oldBalance,
        newBalance: nextBalance,
        type: 'Bonus Approval',
        reason: 'Премия: ' + request.reasonLabel,
        date: new Date().toISOString()
    });
    db.save();
    showToast('Премия одобрена и начислена.');
    renderBonuses(getDashboardContent());
}

function rejectBonusRequest(requestId) {
    if (!hasPermission('review_bonuses')) return showToast('Нет прав на рассмотрение премий.', 'error');
    const request = getBonusRequests().find(item => item.id === requestId);
    if (!request || request.status !== 'pending') return;
    request.status = 'rejected';
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = currentUser.id;
    db.save();
    showToast('Заявка отклонена.');
    renderBonuses(getDashboardContent());
}

