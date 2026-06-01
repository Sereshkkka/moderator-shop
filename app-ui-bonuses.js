const BONUS_COMMENT_MAX_LENGTH = 120;
const BONUS_REASON_MAX_LENGTH = 80;
const BONUS_REVIEW_COMMENT_MAX_LENGTH = 180;
const BONUS_FILTER_STORAGE_KEY = 'bonus_requests_filter';

const BONUS_EDIT_ICON_SVG = [
    '<svg class="icon-edit-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
        '<path d="M12 20h9"></path>',
        '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"></path>',
    '</svg>'
].join('');

function getBonusStatusBadge(status) {
    if (status === 'paid') return '<span class="badge badge-success" style="background:var(--success);color:white">Выплачена</span>';
    if (status === 'approved') return '<span class="badge badge-success" style="background:var(--success);color:white">Одобрена</span>';
    if (status === 'rejected') return '<span class="badge badge-error">Отклонена</span>';
    return '<span class="badge" style="border:1px solid var(--warning); color:var(--warning); background:rgba(245,158,11,0.12)">На рассмотрении</span>';
}

function normalizeBonusPayoutState(requests) {
    let changed = false;
    requests.forEach(request => {
        if (request.status === 'approved' && !Object.prototype.hasOwnProperty.call(request, 'paidAt')) {
            request.status = 'paid';
            request.paidAt = request.reviewedAt || request.createdAt || new Date().toISOString();
            request.paidBy = request.reviewedBy || null;
            changed = true;
        }
    });
    if (changed) db.save();
}

function renderBonuses(container) {
    const canCreateBonus = hasPermission('access_bonuses');
    const canReviewBonus = hasPermission('review_bonuses');
    const bonusRequests = getBonusRequests();
    normalizeBonusPayoutState(bonusRequests);
    const allRequests = getBonusRequests()
        .filter(request => request.companyId === currentCompanyId)
        .filter(request => canReviewBonus || request.userId === currentUser.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const storedFilter = sessionStorage.getItem(BONUS_FILTER_STORAGE_KEY) || 'all';
    const activeFilter = ['all', 'pending', 'approved', 'paid', 'rejected'].includes(storedFilter) ? storedFilter : 'all';
    const requests = activeFilter === 'all'
        ? allRequests
        : allRequests.filter(request => request.status === activeFilter);
    const totalCount = allRequests.length;
    const approvedCount = allRequests.filter(request => request.status === 'approved').length;
    const paidCount = allRequests.filter(request => request.status === 'paid').length;
    const rejectedCount = allRequests.filter(request => request.status === 'rejected').length;
    const totalPendingCount = allRequests.filter(request => request.status === 'pending').length;
    const filterButton = (filter, label, count) => {
        const activeClass = activeFilter === filter ? ' active' : '';
        return '<button type="button" class="bonus-filter-chip' + activeClass + '" onclick="setBonusRequestsFilter(\'' + filter + '\')">' + label + '<span>' + count + '</span></button>';
    };

    const rows = requests.length ? requests.map(request => {
        const user = db.data.users.find(u => u.id === request.userId);
        const reviewer = request.reviewedBy ? db.data.users.find(u => u.id === request.reviewedBy) : null;
        const payer = request.paidBy ? db.data.users.find(u => u.id === request.paidBy) : null;
        const deleteButton = (canReviewBonus || (request.userId === currentUser.id && request.status === 'pending'))
            ? '<button class="btn btn-outline" style="padding:0.35rem 0.7rem; width:auto;" onclick="deleteBonusRequest(\'' + request.id + '\')">Удалить</button>'
            : '';
        const amountEditButton = canReviewBonus && ['pending', 'approved'].includes(request.status)
            ? '<button type="button" class="icon-edit-trigger" onclick="openBonusAmountEditModal(\'' + request.id + '\')" title="Изменить сумму" aria-label="Изменить сумму">' + BONUS_EDIT_ICON_SVG + '</button>'
            : '';
        const amountWasEdited = request.originalAmount !== null && request.originalAmount !== undefined && Number(request.originalAmount) !== Number(request.amount);
        const amountContent = amountWasEdited
            ? [
                '<div class="bonus-amount-cell">',
                    '<div><span class="bonus-amount-old">' + formatCoinAmount(request.originalAmount) + '</span>' + amountEditButton + '</div>',
                    '<div class="bonus-amount-new">Изменено на: <strong>' + formatCoinAmount(request.amount) + '</strong></div>',
                '</div>'
            ].join('')
            : '<div class="bonus-amount-cell"><strong>' + formatCoinAmount(request.amount) + '</strong>' + amountEditButton + '</div>';
        const commentButton = canReviewBonus
            ? '<button class="bonus-comment-icon-btn" type="button" aria-label="Оставить комментарий" onmouseenter="showCursorTooltip(event, \'Оставить комментарий\')" onmousemove="moveCursorTooltip(event)" onmouseleave="hideCursorTooltip()" onclick="openBonusReviewCommentModal(\'' + request.id + '\')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v9.5H13.4L12 17.2 10.6 15H5V5.5Z"></path></svg></button>'
            : '';
        let reviewActions = '';
        if (canReviewBonus && request.status === 'pending') {
            reviewActions = [
                '<div class="bonus-actions-row">',
                    '<div class="bonus-actions-main">',
                        '<button class="btn btn-success" style="padding:0.35rem 0.7rem; width:auto;" onclick="approveBonusRequest(\'' + request.id + '\')">Одобрить</button>',
                        commentButton,
                        '<button class="btn btn-danger" style="padding:0.35rem 0.7rem; width:auto;" onclick="rejectBonusRequest(\'' + request.id + '\')">Отклонить</button>',
                    '</div>',
                    deleteButton,
                '</div>'
            ].join('');
        } else if (canReviewBonus && request.status === 'approved') {
            reviewActions = [
                '<div class="bonus-actions-row">',
                    '<div class="bonus-actions-main">',
                        '<span style="color:var(--text-muted)">' + (reviewer ? escapeHTML(reviewer.username) : '—') + '</span>',
                        '<button class="btn btn-success" style="padding:0.35rem 0.7rem; width:auto;" onclick="payBonusRequest(\'' + request.id + '\')">Выплатить</button>',
                    '</div>',
                    deleteButton,
                '</div>'
            ].join('');
        } else {
            reviewActions = [
                '<div class="bonus-actions-row">',
                    '<div class="bonus-actions-main">',
                        '<span style="color:var(--text-muted)">' + (request.status === 'paid' && payer ? escapeHTML(payer.username) : (reviewer ? escapeHTML(reviewer.username) : '—')) + '</span>',
                    '</div>',
                    deleteButton,
                '</div>'
            ].join('');
        }

        return [
            '<tr>',
                '<td><strong>' + escapeHTML(user ? user.username : 'Неизвестно') + '</strong><div class="text-muted" style="font-size:0.78rem;">' + new Date(request.createdAt).toLocaleString() + '</div></td>',
                '<td style="max-width:220px; white-space:normal; overflow-wrap:anywhere;">' + escapeHTML(request.reasonLabel) + '</td>',
                '<td style="max-width:360px; white-space:normal; overflow-wrap:anywhere;">' + escapeHTML(request.comment || '—') + '</td>',
                '<td>' + amountContent + '</td>',
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
            '<div class="staff-summary-card"><span class="staff-summary-label">Всего заявок</span><strong>' + totalCount + '</strong></div>',
            '<div class="staff-summary-card"><span class="staff-summary-label">На рассмотрении</span><strong>' + totalPendingCount + '</strong></div>',
            '<div class="staff-summary-card"><span class="staff-summary-label">Режим</span><strong>' + (canReviewBonus ? 'Рассмотрение' : 'Мои заявки') + '</strong></div>',
        '</div>',
        '<div class="bonus-filter-bar mb-4">',
            filterButton('all', 'Все', totalCount),
            filterButton('pending', 'На рассмотрении', totalPendingCount),
            filterButton('approved', 'Одобрены', approvedCount),
            filterButton('paid', 'Выплачены', paidCount),
            filterButton('rejected', 'Отклонены', rejectedCount),
        '</div>',
        '<div class="table-container">',
            '<table>',
                '<thead><tr><th>Сотрудник</th><th>Причина</th><th>Комментарий</th><th>Сумма</th><th>Статус</th><th>Рассмотрено</th></tr></thead>',
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
                    '<input type="text" class="form-control" id="bonus_reason_label" maxlength="' + BONUS_REASON_MAX_LENGTH + '" placeholder="Например, разбор темы на форуме">',
                '</div>',
                '<div class="form-group">',
                    '<label>Комментарий (ссылка на тему / #тикета)</label>',
                    '<textarea class="form-control" id="bonus_comment" rows="3" maxlength="' + BONUS_COMMENT_MAX_LENGTH + '" placeholder="Добавьте ссылку, номер тикета или краткий комментарий"></textarea>',
                    '<div class="text-muted" style="font-size:0.82rem; margin-top:0.35rem;">До ' + BONUS_COMMENT_MAX_LENGTH + ' символов.</div>',
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

function setBonusRequestsFilter(filter) {
    sessionStorage.setItem(BONUS_FILTER_STORAGE_KEY, filter);
    renderBonuses(getDashboardContent());
}

function openBonusReviewCommentModal(requestId) {
    if (!hasPermission('review_bonuses')) return showToast('Нет прав на рассмотрение премий.', 'error');
    const request = getBonusRequests().find(item => item.id === requestId);
    if (!request) return showToast('Заявка не найдена.', 'error');
    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="bonus_review_comment_overlay">',
            '<div class="modal-content" style="max-width:520px" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1rem;">Комментарий к решению</h3>',
                '<div class="form-group">',
                    '<label>Комментарий</label>',
                    '<textarea class="form-control" id="bonus_review_comment" rows="4" maxlength="' + BONUS_REVIEW_COMMENT_MAX_LENGTH + '" placeholder="Напишите причину одобрения или отказа">' + escapeHTML(request.reviewComment || '') + '</textarea>',
                    '<div class="text-muted" style="font-size:0.82rem; margin-top:0.35rem;">До ' + BONUS_REVIEW_COMMENT_MAX_LENGTH + ' символов.</div>',
                '</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" onclick="resolveBonusRequestWithComment(\'' + request.id + '\', \'approved\')">Одобрить + коммент</button>',
                    '<button class="btn btn-danger" onclick="resolveBonusRequestWithComment(\'' + request.id + '\', \'rejected\')">Отклонить + коммент</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
    document.getElementById('bonus_review_comment_overlay').onclick = closeBalanceModal;
}

function openBonusAmountEditModal(requestId) {
    if (!hasPermission('review_bonuses')) return showToast('Нет прав на рассмотрение премий.', 'error');
    const request = getBonusRequests().find(item => item.id === requestId);
    if (!request) return showToast('Заявка не найдена.', 'error');
    if (!['pending', 'approved'].includes(request.status)) return showToast('Сумму этой заявки уже нельзя изменить.', 'error');
    const modalWrapper = ensureBalanceModalWrapper();

    modalWrapper.innerHTML = [
        '<div class="modal-overlay" id="bonus_amount_edit_overlay">',
            '<div class="modal-content" style="max-width:480px" onclick="event.stopPropagation()">',
                '<h3 style="margin-bottom:1rem;">Изменить сумму</h3>',
                '<div class="form-group">',
                    '<label>Новая сумма</label>',
                    '<input type="number" class="form-control" id="bonus_amount_edit_value" min="1" max="' + MAX_USER_BALANCE + '" inputmode="numeric" value="' + Number(request.amount || 0) + '">',
                '</div>',
                '<div class="action-row mt-4">',
                    '<button class="btn btn-primary" onclick="saveBonusAmountEdit(\'' + request.id + '\')">Сохранить</button>',
                    '<button class="btn btn-outline" onclick="closeBalanceModal()">Отмена</button>',
                '</div>',
            '</div>',
        '</div>'
    ].join('');
    document.getElementById('bonus_amount_edit_overlay').onclick = closeBalanceModal;
}

async function saveBonusAmountEdit(requestId) {
    if (!hasPermission('review_bonuses')) return showToast('Нет прав на рассмотрение премий.', 'error');
    const requests = getBonusRequests();
    normalizeBonusPayoutState(requests);
    const request = requests.find(item => item.id === requestId);
    if (!request) return showToast('Заявка не найдена.', 'error');
    if (!['pending', 'approved'].includes(request.status)) return showToast('Сумму этой заявки уже нельзя изменить.', 'error');
    const nextAmount = Math.trunc(Number(document.getElementById('bonus_amount_edit_value')?.value || 0));
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) return showToast('Укажите корректную сумму.', 'error');
    const clampedAmount = Math.min(nextAmount, MAX_USER_BALANCE);
    if (Number(request.amount || 0) === clampedAmount) return showToast('Сумма не изменилась.', 'info');
    if (request.originalAmount === null || request.originalAmount === undefined) {
        request.originalAmount = Number(request.amount || 0);
    }
    request.amount = clampedAmount;
    request.amountEditedAt = new Date().toISOString();
    request.amountEditedBy = currentUser.id;
    await db.save();
    await db.flushRemoteSave();
    closeBalanceModal();
    showToast('Сумма заявки изменена.');
    renderBonuses(getDashboardContent());
}

async function resolveBonusRequestWithComment(requestId, status) {
    if (!hasPermission('review_bonuses')) return showToast('Нет прав на рассмотрение премий.', 'error');
    const requests = getBonusRequests();
    normalizeBonusPayoutState(requests);
    const request = requests.find(item => item.id === requestId);
    if (!request) return showToast('Заявка не найдена.', 'error');
    if (request.status !== 'pending') return showToast('Эта заявка уже рассмотрена.', 'error');
    if (!['approved', 'rejected'].includes(status)) return;
    const reviewComment = (document.getElementById('bonus_review_comment')?.value || '').trim();
    if (!reviewComment) return showToast('Добавьте комментарий к решению.', 'error');
    if (reviewComment.length > BONUS_REVIEW_COMMENT_MAX_LENGTH) return showToast('Комментарий слишком длинный.', 'error');
    request.reviewComment = reviewComment;
    request.status = status;
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = currentUser.id;
    request.paidAt = null;
    request.paidBy = null;
    await db.save();
    await db.flushRemoteSave();
    closeBalanceModal();
    showToast(status === 'approved' ? 'Премия одобрена с комментарием.' : 'Заявка отклонена с комментарием.');
    renderBonuses(getDashboardContent());
}

async function submitBonusRequest() {
    const reasonLabel = (document.getElementById('bonus_reason_label')?.value || '').trim();
    const amount = Math.trunc(Number(document.getElementById('bonus_amount')?.value || 0));
    const comment = (document.getElementById('bonus_comment')?.value || '').trim();

    if (!reasonLabel) return showToast('Укажите причину заявки.', 'error');
    if (!comment) return showToast('Добавьте комментарий к заявке.', 'error');
    if (reasonLabel.length > BONUS_REASON_MAX_LENGTH) return showToast('Причина заявки слишком длинная.', 'error');
    if (comment.length > BONUS_COMMENT_MAX_LENGTH) return showToast('Комментарий слишком длинный.', 'error');
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
        originalAmount: null,
        amountEditedAt: null,
        amountEditedBy: null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        paidAt: null,
        paidBy: null,
        reviewComment: ''
    });
    db.data.systemConfig.bonusRequests = requests;
    await db.save();
    await db.flushRemoteSave();
    closeBalanceModal();
    showToast('Заявка на премию отправлена.');
    renderBonuses(getDashboardContent());
}

async function approveBonusRequest(requestId) {
    if (!hasPermission('review_bonuses')) return showToast('Нет прав на рассмотрение премий.', 'error');
    const requests = getBonusRequests();
    normalizeBonusPayoutState(requests);
    const request = requests.find(item => item.id === requestId);
    if (!request || request.status !== 'pending') return;
    request.status = 'approved';
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = currentUser.id;
    request.paidAt = null;
    request.paidBy = null;
    await db.save();
    await db.flushRemoteSave();
    showToast('Премия одобрена. Теперь её можно выплатить.');
    renderBonuses(getDashboardContent());
}

async function payBonusRequest(requestId) {
    if (!hasPermission('review_bonuses')) return showToast('Нет прав на выплату премий.', 'error');
    const requests = getBonusRequests();
    normalizeBonusPayoutState(requests);
    const request = requests.find(item => item.id === requestId);
    if (!request || request.status !== 'approved') return;
    const targetUser = db.data.users.find(user => user.id === request.userId);
    if (!targetUser) return showToast('Пользователь заявки не найден.', 'error');
    const oldBalance = Number(targetUser.coins || 0);
    const nextBalance = Math.min(MAX_USER_BALANCE, oldBalance + Number(request.amount || 0));
    targetUser.coins = nextBalance;
    if (currentUser.id === targetUser.id) currentUser.coins = nextBalance;
    request.status = 'paid';
    request.paidAt = new Date().toISOString();
    request.paidBy = currentUser.id;
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
    await db.save();
    await db.flushRemoteSave();
    showToast('Премия выплачена.');
    renderBonuses(getDashboardContent());
}

async function rejectBonusRequest(requestId) {
    if (!hasPermission('review_bonuses')) return showToast('Нет прав на рассмотрение премий.', 'error');
    const requests = getBonusRequests();
    normalizeBonusPayoutState(requests);
    const request = requests.find(item => item.id === requestId);
    if (!request || request.status !== 'pending') return;
    request.status = 'rejected';
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = currentUser.id;
    await db.save();
    await db.flushRemoteSave();
    showToast('Заявка отклонена.');
    renderBonuses(getDashboardContent());
}

async function deleteBonusRequest(requestId) {
    const requests = getBonusRequests();
    const request = requests.find(item => item.id === requestId);
    if (!request) return;
    if (!hasPermission('review_bonuses') && !(request.userId === currentUser.id && request.status === 'pending')) {
        return showToast('Нет прав на удаление этой заявки.', 'error');
    }
    db.data.systemConfig.bonusRequests = requests.filter(item => item.id !== requestId);
    await db.save();
    await db.flushRemoteSave();
    showToast('Заявка удалена.');
    renderBonuses(getDashboardContent());
}

