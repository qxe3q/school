const LANG_MAP = { 'Английский': 'English', 'Китайский': '中文', 'Французский': 'Français', 'Немецкий': 'Deutsch', 'Испанский': 'Español' };
const FORMAT_NAMES = { online: 'Онлайн', offline: 'Офлайн' };

document.addEventListener('DOMContentLoaded', function () {
    const user = getCurrentUser();

    if (!user) {
        document.getElementById('notLoggedBox').style.display = 'block';
        return;
    }

    document.getElementById('dashboardBox').style.display = 'block';
    document.getElementById('welcomeTitle').textContent = 'Здравствуйте, ' + user.name + '!';

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    if (user.role === 'admin') buildAdmin(user);
    else if (user.role === 'teacher') buildTeacher(user);
    else buildStudent(user);
});

function safeSession(fn) { try { return fn(); } catch (e) { return null; } }

function setupTabs(tabs) {
    const saved = safeSession(() => sessionStorage.getItem('tls_tab'));
    const startId = tabs.some(t => t.id === saved) ? saved : tabs[0].id;
    const box = document.getElementById('dashboardTabs');

    box.innerHTML = tabs.map(t =>
        `<button class="dash-tab" data-tab="${t.id}">${t.label}${t.badgeId ? `<span class="tab-badge" id="${t.badgeId}" style="display:none"></span>` : ''}</button>`
    ).join('');

    const show = id => {
        box.querySelectorAll('.dash-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
        const activeBtn = box.querySelector('.dash-tab.active');
        if (activeBtn) box.scrollTo({ left: box.scrollLeft + activeBtn.getBoundingClientRect().left - box.getBoundingClientRect().left - 20 });
        document.querySelectorAll('.dash-panel').forEach(p => { p.style.display = 'none'; });
        const panel = document.getElementById('panel-' + id);
        if (panel) panel.style.display = 'block';
        safeSession(() => sessionStorage.setItem('tls_tab', id));
        const msgBox = document.getElementById('chatMessagesBox');
        if (id === 'messages' && msgBox) msgBox.scrollTop = msgBox.scrollHeight;
    };

    box.querySelectorAll('.dash-tab').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
    show(startId);
}

function setBadge(id, n) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = n > 99 ? '99+' : n;
    el.style.display = n > 0 ? 'inline-block' : 'none';
}

function setSubtitle(text) {
    const el = document.getElementById('welcomeSubtitle');
    if (el) el.textContent = text;
}

function openModal(html) {
    closeModal();
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.id = 'modalOverlay';
    ov.innerHTML = `<div class="modal-box">${html}</div>`;
    ov.addEventListener('mousedown', e => { if (e.target === ov) closeModal(); });
    document.body.appendChild(ov);
    return ov;
}
function closeModal() {
    const o = document.getElementById('modalOverlay');
    if (o) o.remove();
}

function todayStr() { return dateToStr(new Date()); }

function translit(str) {
    const map = { а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'y', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f', х:'h', ц:'ts', ч:'ch', ш:'sh', щ:'sch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya' };
    return str.toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('').replace(/[^a-z0-9]/g, '');
}
function suggestLogin(name) {
    const base = translit(String(name).trim().split(' ')[0]) || 'student';
    let login = base, i = 1;
    while (findUserByLogin(login)) login = base + (++i);
    return login;
}

function findTeacherForLanguage(fullLang) {
    const t = getUsers().find(u => u.role === 'teacher' && u.language === fullLang);
    return t ? t.login : '';
}

function buildAdmin(user) {
    setupTabs([
        { id: 'requests', label: 'Заявки', badgeId: 'reqTabBadge' },
        { id: 'create-student', label: 'Создать ученика' },
        { id: 'students', label: 'Ученики' },
        { id: 'teachers', label: 'Преподаватели' },
        { id: 'schedule', label: 'Расписание' },
        { id: 'messages', label: 'Сообщения', badgeId: 'msgTabBadge' },
        { id: 'data', label: 'Данные' }
    ]);

    renderAdminRequests();
    initCreateStudent();
    initCreateTeacher();
    initDataPanel();
    renderAdminStudents();
    renderAdminTeachers();
    buildSchedulePanel(user, 'admin');

    const contacts = getUsers().filter(u => u.role !== 'admin');
    buildChatUI(document.getElementById('messagesView'), contacts, user);
    updateBadges(user);
}

function updateBadges(user) {
    setBadge('msgTabBadge', getTotalUnread(user.login));
    if (user.role === 'student') {
        setBadge('hwTabBadge', getHomework().filter(h => h.studentLogin === user.login && !h.done).length);
    }
    if (user.role === 'admin') {
        setBadge('reqTabBadge', getRequests().filter(r => r.status === 'new').length);
        const n = getRequests().filter(r => r.status === 'new').length;
        setSubtitle(n ? `Новых заявок: ${n}` : 'Новых заявок нет');
    }
}

function renderAdminRequests() {
    const wrap = document.getElementById('adminRequestsList');
    const requests = getRequests().slice().reverse();
    if (!requests.length) { wrap.innerHTML = '<p class="empty-state">Заявок нет.</p>'; return; }

    wrap.innerHTML = requests.map(req => {
        let statusText = 'Новая', statusClass = 'status-new';
        if (req.status === 'called') { statusText = 'Позвонили'; statusClass = 'status-called'; }
        if (req.status === 'student_created') { statusText = 'ЛК создан'; statusClass = 'status-done'; }

        const btnCall = req.status === 'new' ? `<button class="btn btn-sm btn-outline" data-act="called" data-id="${req.id}">Позвонил</button>` : '';
        const btnCreate = req.status !== 'student_created' ? `<button class="btn btn-sm" data-act="create-lk" data-id="${req.id}">Создать ЛК</button>` : '';
        const created = req.createdAt ? new Date(req.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

        return `
            <div class="request-card">
                <div class="request-head">
                    <strong>${escapeHtml(req.name)}</strong>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <p>Тел: <a href="tel:${escapeHtml(req.phone.replace(/[^\d+]/g, ''))}">${escapeHtml(req.phone)}</a> · Язык: ${escapeHtml(req.language)} · Формат: ${FORMAT_NAMES[req.format] || '—'}${created ? ' · ' + created : ''}</p>
                <div class="request-actions">
                    ${btnCall} ${btnCreate}
                    <button class="btn btn-sm btn-danger" data-act="del-req" data-id="${req.id}">Удалить</button>
                </div>
            </div>
        `;
    }).join('');

    wrap.onclick = function (e) {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const id = b.dataset.id;
        if (b.dataset.act === 'called') { updateRequestStatus(id, 'called'); renderAdminRequests(); }
        if (b.dataset.act === 'create-lk') openCreateLkModal(id);
        if (b.dataset.act === 'del-req' && confirm('Удалить заявку?')) { deleteRequest(id); renderAdminRequests(); }
        updateBadges(getCurrentUser());
    };
}

function openCreateLkModal(id) {
    const req = getRequests().find(r => r.id === id);
    if (!req) return;

    const lang = LANG_MAP[req.language] || '';
    const teacherLogin = findTeacherForLanguage(lang);
    const teacherName = teacherLogin ? getUserName(teacherLogin) : 'не найден (назначьте позже)';

    const ov = openModal(`
        <h3>Создать личный кабинет</h3>
        <p class="modal-hint">Ученик: <b>${escapeHtml(req.name)}</b><br>Язык: ${escapeHtml(req.language)} · Преподаватель: ${escapeHtml(teacherName)}</p>
        <form id="lkForm">
            <label for="lkLogin">Логин</label>
            <input type="text" id="lkLogin" value="${escapeHtml(suggestLogin(req.name))}" required>
            <p class="modal-hint" style="margin:-4px 0 14px;">Пароль для входа: <b>${DEFAULT_PASSWORD}</b></p>
            <p class="form-msg" id="lkMsg"></p>
            <div class="modal-actions">
                <button type="button" class="btn-outline" id="lkCancel">Отмена</button>
                <button type="submit">Создать</button>
            </div>
        </form>
    `);

    ov.querySelector('#lkCancel').onclick = closeModal;
    ov.querySelector('#lkForm').onsubmit = function (e) {
        e.preventDefault();
        const login = ov.querySelector('#lkLogin').value.trim();
        const result = createUser({ name: req.name, login, role: 'student', language: lang, teacherLogin });
        const msg = ov.querySelector('#lkMsg');
        if (!result.ok) { msg.textContent = result.error; msg.className = 'form-msg error'; return; }

        updateRequestStatus(req.id, 'student_created');
        renderAdminRequests();
        refreshAdminAll();
        updateBadges(getCurrentUser());

        ov.querySelector('.modal-box').innerHTML = `
            <h3>Кабинет создан</h3>
            <p class="modal-hint">Передайте эти данные ученику.</p>
            <div class="profile-card" style="max-width:none;margin-bottom:18px;">
                <p><strong>Логин:</strong> ${escapeHtml(login)}</p>
                <p><strong>Пароль:</strong> ${DEFAULT_PASSWORD}</p>
            </div>
            <div class="modal-actions"><button id="lkClose">Закрыть</button></div>
        `;
        ov.querySelector('#lkClose').onclick = closeModal;
    };
}

function initCreateStudent() {
    document.getElementById('createStudentForm').onsubmit = function (e) {
        e.preventDefault();
        const d = new FormData(this);
        const language = d.get('language');
        const teacherLogin = findTeacherForLanguage(language);

        const result = createUser({
            name: d.get('name'), login: d.get('login'),
            role: 'student', language, teacherLogin
        });
        const msg = document.getElementById('createStudentMsg');
        if (result.ok) {
            msg.textContent = `Ученик создан! Логин: ${result.user.login}, пароль: ${result.user.password}`;
            msg.className = 'form-msg success';
            this.reset();
            refreshAdminAll();
        } else {
            msg.textContent = result.error;
            msg.className = 'form-msg error';
        }
    };

    document.getElementById('clearAllStudentsBtn').onclick = () => {
        if (confirm('Удалить ВСЕХ учеников? Их оценки, сообщения и занятия тоже будут удалены.')) {
            deleteAllStudents();
            refreshAdminAll();
        }
    };
}

function renderAdminStudents() {
    const wrap = document.getElementById('adminStudentsList');
    const students = getUsers().filter(u => u.role === 'student');
    const teachers = getUsers().filter(u => u.role === 'teacher');

    if (!students.length) { wrap.innerHTML = '<p class="empty-state">Учеников нет.</p>'; return; }
    wrap.innerHTML = students.map(s => {
        const login = escapeHtml(s.login);
        const options = '<option value="">Не назначен</option>' + teachers.map(t =>
            `<option value="${escapeHtml(t.login)}"${t.login === s.teacherLogin ? ' selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.language || '')})</option>`).join('');
        return `
        <div class="list-card list-card-wrap">
            <div><strong>${escapeHtml(s.name)}</strong><p>Логин: ${login} · Язык: ${escapeHtml(s.language || '—')}</p></div>
            <div class="list-actions">
                <select class="teacher-select" data-login="${login}" title="Преподаватель">${options}</select>
                <button class="btn btn-sm btn-danger" data-act="del" data-login="${login}">Удалить</button>
            </div>
        </div>`;
    }).join('');

    wrap.onclick = function (e) {
        const b = e.target.closest('button[data-act]');
        if (!b) return;
        if (b.dataset.act === 'del' && confirm('Удалить ученика? Его оценки, задания, сообщения и занятия тоже будут удалены.')) {
            deleteUserByLogin(b.dataset.login);
            refreshAdminAll();
        }
    };
    wrap.onchange = function (e) {
        const sel = e.target.closest('.teacher-select');
        if (!sel) return;
        setStudentTeacher(sel.dataset.login, sel.value);
        refreshAdminAll();
    };
}

function renderAdminTeachers() {
    const wrap = document.getElementById('adminTeachersList');
    const teachers = getUsers().filter(u => u.role === 'teacher');
    const students = getUsers().filter(u => u.role === 'student');

    wrap.innerHTML = teachers.length ? teachers.map(t => {
        const count = students.filter(s => s.teacherLogin === t.login).length;
        const login = escapeHtml(t.login);
        return `
        <div class="list-card list-card-wrap">
            <div><strong>${escapeHtml(t.name)}</strong><p>Логин: ${login} · Язык: ${escapeHtml(t.language || '—')} · Учеников: ${count}</p></div>
            <div class="list-actions">
                <button class="btn btn-sm btn-danger" data-act="del" data-login="${login}">Удалить</button>
            </div>
        </div>`;
    }).join('') : '<p class="empty-state">Преподавателей нет.</p>';

    wrap.onclick = function (e) {
        const b = e.target.closest('button[data-act]');
        if (!b) return;
        if (b.dataset.act === 'del' && confirm('Удалить преподавателя? Его занятия и задания тоже будут удалены.')) {
            const r = deleteTeacher(b.dataset.login);
            if (!r.ok) { alert(r.error); return; }
            refreshAdminAll();
        }
    };
}

function buildStudent(user) {
    setupTabs([
        { id: 'student-schedule', label: 'Моё расписание' },
        { id: 'grades', label: 'Оценки' },
        { id: 'homework', label: 'Задания', badgeId: 'hwTabBadge' },
        { id: 'messages', label: 'Сообщения', badgeId: 'msgTabBadge' },
        { id: 'profile', label: 'Профиль' }
    ]);

    const teacher = findUserByLogin(user.teacherLogin);
    setSubtitle('Ученик' + (user.language ? ' · ' + user.language : '') + (teacher ? ' · Преподаватель: ' + teacher.name : ''));

    createWeekGrid(document.getElementById('studentScheduleList'), { mode: 'student', user });

    renderStudentGrades(user);
    renderStudentHomework(user);

    const admin = getUsers().find(u => u.role === 'admin');
    const contacts = [];
    if (teacher) contacts.push(teacher);
    if (admin) contacts.push(admin);
    buildChatUI(document.getElementById('messagesView'), contacts, user);

    renderProfile(user);
    updateBadges(user);
}

const GRADE_NAMES = { 5: 'Отлично', 4: 'Хорошо', 3: 'Удовлетворительно', 2: 'Плохо', 1: 'Очень плохо' };

function gradeChipHtml(v, extraClass) {
    return `<span class="grade-chip g-${v}${extraClass ? ' ' + extraClass : ''}" title="${escapeHtml(GRADE_NAMES[v] || '')}">${v}</span>`;
}

function lessonWhenText(l) {
    return new Date(l.date + 'T00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) + ', ' + l.time;
}

function lessonTimeRange(l) {
    const e = lessonEnd(l);
    return l.time + '–' + pad2(e.getHours()) + ':' + pad2(e.getMinutes());
}

function gradedLessons(list) {
    return list.filter(l => l.grade).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

function gradeCardHtml(l, who) {
    return `
        <div class="grade-card">
            <div class="grade-value g-${l.grade}">${l.grade}</div>
            <div class="grade-info">
                <strong>${escapeHtml(who)}</strong>
                <span>${escapeHtml(lessonWhenText(l))}</span>
                ${l.gradeComment ? `<p class="grade-comment">${escapeHtml(l.gradeComment)}</p>` : ''}
            </div>
        </div>`;
}

function renderStudentGrades(user) {
    const wrap = document.getElementById('gradesView');
    const list = gradedLessons(getSchedule().filter(l => (l.studentLogins || []).includes(user.login)));
    if (!list.length) { wrap.innerHTML = '<p class="empty-state">Оценок пока нет. Преподаватель ставит их за проведённые уроки.</p>'; return; }

    const avg = list.reduce((s, l) => s + l.grade, 0) / list.length;
    wrap.innerHTML = `<p class="grades-avg">Средний балл: ${gradeChipHtml(Math.round(avg))} <strong>${avg.toFixed(1)}</strong></p>` +
        list.map(l => gradeCardHtml(l, getUserName(l.teacherLogin))).join('');
}

function renderTeacherGrades(user) {
    const wrap = document.getElementById('gradesView');
    const list = gradedLessons(getSchedule().filter(l => l.teacherLogin === user.login));
    wrap.innerHTML = '<p class="hint-text">Оценки ставятся за конкретный урок: откройте вкладку «Расписание», нажмите на начавшийся урок и выберите оценку.</p>' +
        (list.length
            ? list.map(l => gradeCardHtml(l, (l.studentLogins || []).map(getUserName).join(', '))).join('')
            : '<p class="empty-state">Вы пока не ставили оценки.</p>');
}

function buildTeacher(user) {
    setupTabs([
        { id: 'teacher-students', label: 'Мои ученики' },
        { id: 'grades', label: 'Оценки' },
        { id: 'homework', label: 'Задания' },
        { id: 'schedule', label: 'Расписание' },
        { id: 'messages', label: 'Сообщения', badgeId: 'msgTabBadge' },
        { id: 'profile', label: 'Профиль' }
    ]);

    setSubtitle('Преподаватель' + (user.language ? ' · ' + user.language : ''));

    const students = getUsers().filter(u => u.role === 'student' && u.teacherLogin === user.login);
    const wrap = document.getElementById('teacherStudentsList');
    wrap.innerHTML = students.length
        ? students.map(s => `<div class="list-card"><div><strong>${escapeHtml(s.name)}</strong><p>Логин: ${escapeHtml(s.login)}</p></div></div>`).join('')
        : '<p class="empty-state">Пока нет учеников.</p>';

    renderTeacherGrades(user);
    renderTeacherHomework(user, students);
    buildSchedulePanel(user, 'teacher');

    const admin = getUsers().find(u => u.role === 'admin');
    const contacts = [...students];
    if (admin) contacts.push(admin);
    buildChatUI(document.getElementById('messagesView'), contacts, user);

    renderProfile(user);
    updateBadges(user);
}

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const schedState = { weekStart: null, teacher: '' };
let schedTimer = null;

function startOfWeek(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
}

function shortName(full) {
    const p = String(full || '').trim().split(/\s+/);
    return p.length > 1 ? p[0] + ' ' + p[1].charAt(0) + '.' : p[0];
}

function humanDelta(ms) {
    const mins = Math.max(1, Math.ceil(ms / 60000));
    if (mins < 60) return mins + ' мин';
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h < 24) return h + ' ч' + (m ? ' ' + m + ' мин' : '');
    const dd = Math.floor(h / 24), hh = h % 24;
    return dd + ' дн' + (hh ? ' ' + hh + ' ч' : '');
}

function statusInfo(l, now) {
    const st = lessonStatus(l, now);
    if (st === 'upcoming') return { st, text: 'Предстоит', short: 'Предстоит', note: 'начнётся через ' + humanDelta(lessonStart(l) - now) };
    if (st === 'live') return { st, text: 'Идёт сейчас', short: 'Идёт', note: 'осталось ' + humanDelta(lessonEnd(l) - now) };
    return { st, text: 'Завершён', short: 'Завершён', note: '' };
}

function hourKey(l) { return l.time.slice(0, 2) + ':00'; }

function scheduleRulesText() {
    return `Урок — ${LESSON_MINUTES} минут, затем перерыв ${SLOT_MINUTES - LESSON_MINUTES} минут. ` +
        `Офлайн: ${workHoursText('offline')}. Онлайн: ${workHoursText('online')}.`;
}

function startSchedTimer(fn, box) {
    if (schedTimer) clearInterval(schedTimer);
    schedTimer = setInterval(() => { if (box.isConnected && !document.hidden) fn(); }, 30000);
}
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window._schedRender) window._schedRender();
});

function createWeekGrid(box, opts) {
    const isStudent = opts.mode === 'student';
    if (!schedState.weekStart) schedState.weekStart = startOfWeek(new Date());

    const viewLessons = () => {
        const all = getSchedule();
        return isStudent
            ? all.filter(l => (l.studentLogins || []).includes(opts.user.login))
            : all.filter(l => l.teacherLogin === opts.getTeacher());
    };

    function bannerHtml(now) {
        const mine = viewLessons();
        const live = mine.find(l => lessonStatus(l, now) === 'live');
        if (live) {
            return `<div class="sched-banner is-live"><b>Сейчас идёт урок</b> · ${lessonTimeRange(live)}, ${escapeHtml(getUserName(live.teacherLogin))} · осталось ${humanDelta(lessonEnd(live) - now)}</div>`;
        }
        const next = mine.filter(l => lessonStatus(l, now) === 'upcoming').sort((a, b) => lessonStart(a) - lessonStart(b))[0];
        if (next) {
            return `<div class="sched-banner"><b>Ближайший урок</b> · ${escapeHtml(lessonWhenText(next))} · через ${humanDelta(lessonStart(next) - now)}</div>`;
        }
        return '<div class="sched-banner">Ближайших занятий пока нет.</div>';
    }

    function render() {
        const oldWrap = box.querySelector('.sched-wrap');
        const keepLeft = oldWrap ? oldWrap.scrollLeft : null;
        const now = new Date();
        const todayKey = dateToStr(now);
        const ws = schedState.weekStart;
        const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return d; });
        const keys = days.map(dateToStr);
        const week = viewLessons().filter(l => keys.includes(l.date));

        const hours = new Set();
        week.forEach(l => hours.add(hourKey(l)));
        if (!isStudent) keys.forEach(k => ['online', 'offline'].forEach(f => getSlotStarts(k, f).forEach(t => hours.add(t))));
        let rows = [...hours].sort();
        if (isStudent && rows.length) {
            const a = parseInt(rows[0], 10), b = parseInt(rows[rows.length - 1], 10);
            rows = [];
            for (let h = a; h <= b; h++) rows.push(pad2(h) + ':00');
        }

        const head = '<tr><th class="sched-corner"></th>' + days.map((d, i) =>
            `<th class="sched-day${keys[i] === todayKey ? ' is-today' : ''}">${DAY_NAMES[i]}<b>${d.getDate()}</b></th>`).join('') + '</tr>';

        const body = rows.map(t => {
            const endMin = parseInt(t.slice(0, 2), 10) * 60 + LESSON_MINUTES;
            const endTxt = pad2(Math.floor(endMin / 60)) + ':' + pad2(endMin % 60);
            const cells = keys.map(date => {
                const l = week.find(x => x.date === date && hourKey(x) === t);
                const start = new Date(date + 'T' + t);
                const isNow = date === todayKey && now >= start && now < new Date(start.getTime() + SLOT_MINUTES * 60000);
                const nowCls = isNow ? ' is-now' : '';

                if (l) {
                    const si = statusInfo(l, now);
                    const who = isStudent ? getUserName(l.teacherLogin) : (l.studentLogins || []).map(getUserName).join(', ');
                    const grade = l.grade ? gradeChipHtml(l.grade, 'slot-grade') : '';
                    const absent = l.attendance === 'absent' ? ' · пропуск' : '';
                    return `<td class="sched-td${nowCls}"><button type="button" class="slot slot-${si.st}" data-lesson="${escapeHtml(l.id)}">` +
                        `<span class="slot-name">${escapeHtml(shortName(who))}</span>` +
                        `<span class="slot-meta">${FORMAT_NAMES[l.format] || ''} · ${si.short}${absent}</span>${grade}</button></td>`;
                }
                if (isStudent) return `<td class="sched-td${nowCls}"></td>`;

                const fmts = ['online', 'offline'].filter(f => isSlotAllowed(date, t, f));
                if (!fmts.length) return `<td class="sched-td sched-closed${nowCls}"></td>`;
                if (start < now) return `<td class="sched-td sched-past${nowCls}"></td>`;
                const hint = fmts.length === 1 ? `<small>только ${fmts[0] === 'online' ? 'онлайн' : 'офлайн'}</small>` : '';
                return `<td class="sched-td${nowCls}"><button type="button" class="slot slot-free${fmts.length === 1 && fmts[0] === 'online' ? ' slot-online-only' : ''}" data-free="${date}" data-time="${t}">+${hint}</button></td>`;
            }).join('');
            return `<tr><th class="sched-time">${t}<small>до ${endTxt}</small></th>${cells}</tr>`;
        }).join('');

        const range = days[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' – ' +
            days[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

        const legend = `
            <div class="sched-legend">
                ${isStudent ? '' : '<span><i class="lg lg-free"></i>Свободно</span><span><i class="lg lg-online"></i>Свободно только онлайн</span>'}
                <span><i class="lg lg-upcoming"></i>Предстоит</span>
                <span><i class="lg lg-live"></i>Идёт</span>
                <span><i class="lg lg-done"></i>Завершён</span>
                ${!isStudent && body.includes('sched-closed') ? '<span><i class="lg lg-closed"></i>Школа закрыта</span>' : ''}
                <span class="lg-grades">Оценки: ${[5, 4, 3, 2, 1].map(v => gradeChipHtml(v)).join('')}</span>
            </div>`;

        box.innerHTML = `
            ${isStudent ? bannerHtml(now) : `<p class="hint-text">${scheduleRulesText()} Нажмите на свободное время, чтобы назначить урок, или на урок — чтобы открыть его.</p>`}
            <div class="sched-toolbar">
                <div class="sched-nav">
                    <button type="button" class="btn-outline" data-nav="-1">← Неделя</button>
                    <button type="button" class="btn-outline" data-nav="0">Сегодня</button>
                    <button type="button" class="btn-outline" data-nav="1">Неделя →</button>
                </div>
                <div class="sched-range">${range}</div>
            </div>
            ${legend}
            ${isStudent && !week.length
                ? '<p class="empty-state">На этой неделе занятий нет.</p>'
                : `<div class="sched-wrap"><table class="sched-grid"><thead>${head}</thead><tbody>${body}</tbody></table></div>`}
        `;

        const wrap = box.querySelector('.sched-wrap');
        if (wrap) {
            if (keepLeft !== null) wrap.scrollLeft = keepLeft;
            else {
                const today = wrap.querySelector('.sched-day.is-today');
                if (today) wrap.scrollLeft = Math.max(0, today.offsetLeft - 70);
            }
        }
    }

    const api = {
        mode: opts.mode,
        user: opts.user,
        getTeacher: opts.getTeacher,
        refresh() { render(); if (opts.onChange) opts.onChange(); }
    };

    box.onclick = e => {
        const nav = e.target.closest('[data-nav]');
        if (nav) {
            const v = Number(nav.dataset.nav);
            if (v === 0) schedState.weekStart = startOfWeek(new Date());
            else { const d = new Date(schedState.weekStart); d.setDate(d.getDate() + 7 * v); schedState.weekStart = d; }
            render();
            return;
        }
        const lb = e.target.closest('[data-lesson]');
        if (lb) { openLessonModal(api, lb.dataset.lesson); return; }
        const fb = e.target.closest('[data-free]');
        if (fb && !isStudent) openBookModal(api, fb.dataset.free, fb.dataset.time);
    };

    render();
    startSchedTimer(render, box);
    window._schedRender = render;
    return { render };
}

function openBookModal(api, date, time) {
    const teacherLogin = api.getTeacher();
    const students = getUsers().filter(u => u.role === 'student' && u.teacherLogin === teacherLogin);
    const formats = ['online', 'offline'].filter(f => isSlotAllowed(date, time, f));
    const endMin = parseInt(time.slice(0, 2), 10) * 60 + parseInt(time.slice(3), 10) + LESSON_MINUTES;
    const when = new Date(date + 'T00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

    const intro = `<h3>Назначить занятие</h3>
        <p class="modal-hint">${escapeHtml(when)}, ${time}–${pad2(Math.floor(endMin / 60))}:${pad2(endMin % 60)}<br>Преподаватель: ${escapeHtml(getUserName(teacherLogin))}</p>`;

    if (!students.length) {
        const ov = openModal(intro + `<p class="empty-state">У этого преподавателя пока нет учеников.${api.mode === 'admin' ? ' Назначьте их на вкладке «Ученики».' : ''}</p>
            <div class="modal-actions" style="margin-top:16px;"><button type="button" id="bookCancel">Закрыть</button></div>`);
        ov.querySelector('#bookCancel').onclick = closeModal;
        return;
    }

    const ov = openModal(intro + `
        <form id="bookForm">
            <label for="bookStudent">Ученик</label>
            <select id="bookStudent" name="student" required>${students.map(s => `<option value="${escapeHtml(s.login)}">${escapeHtml(s.name)}</option>`).join('')}</select>
            <label>Формат</label>
            <div class="fmt-choice">
                ${formats.map((f, i) => `<label><input type="radio" name="format" value="${f}"${i === 0 ? ' checked' : ''}> ${f === 'online' ? 'Онлайн' : 'Офлайн'}</label>`).join('')}
            </div>
            <label for="bookLoc" id="bookLocLabel">Ссылка на занятие</label>
            <input type="text" id="bookLoc" name="location" required>
            <p class="form-msg" id="bookMsg"></p>
            <div class="modal-actions">
                <button type="button" class="btn-outline" id="bookCancel">Отмена</button>
                <button type="submit">Назначить</button>
            </div>
        </form>`);

    const loc = ov.querySelector('#bookLoc');
    const label = ov.querySelector('#bookLocLabel');
    const syncFormat = () => {
        const f = ov.querySelector('input[name="format"]:checked').value;
        label.textContent = f === 'online' ? 'Ссылка на занятие' : 'Кабинет';
        loc.placeholder = f === 'online' ? 'https://zoom.us/j/123456789' : 'Например: каб. 3';
    };
    ov.querySelectorAll('input[name="format"]').forEach(r => r.addEventListener('change', syncFormat));
    syncFormat();

    ov.querySelector('#bookCancel').onclick = closeModal;
    ov.querySelector('#bookForm').onsubmit = function (e) {
        e.preventDefault();
        const format = ov.querySelector('input[name="format"]:checked').value;
        let location = loc.value.trim();
        if (format === 'online' && location && !/^https?:\/\//i.test(location)) location = 'https://' + location;
        const r = createLesson({
            teacherLogin, studentLogins: [ov.querySelector('#bookStudent').value],
            date, time, format, location
        });
        if (!r.ok) {
            const msg = ov.querySelector('#bookMsg');
            msg.textContent = r.error;
            msg.className = 'form-msg error';
            return;
        }
        closeModal();
        api.refresh();
    };
}

function openLessonModal(api, id) {
    const l = getSchedule().find(x => x.id === id);
    if (!l) { closeModal(); return; }

    const now = new Date();
    const si = statusInfo(l, now);
    const manage = api.mode !== 'student';
    const canGrade = api.mode === 'teacher';
    const students = (l.studentLogins || []).map(getUserName).map(escapeHtml).join(', ');

    let place = escapeHtml(l.location || '—');
    if (l.format === 'online' && /^https?:\/\//i.test(l.location || '')) {
        place = `<a href="${escapeHtml(l.location)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.location)}</a>`;
    }

    let attendance = '';
    if (si.st !== 'upcoming') {
        if (manage) {
            attendance = `<div class="lm-block"><div class="lm-title">Посещение</div><div class="lm-row">
                <button type="button" class="btn btn-sm btn-outline${l.attendance === 'present' ? ' btn-active' : ''}" data-act="att" data-val="present">Был на занятии</button>
                <button type="button" class="btn btn-sm btn-outline${l.attendance === 'absent' ? ' btn-active' : ''}" data-act="att" data-val="absent">Пропустил</button>
            </div></div>`;
        } else if (l.attendance) {
            attendance = `<p class="lm-line"><strong>Посещение:</strong> ${l.attendance === 'present' ? 'был на занятии' : 'пропуск'}</p>`;
        }
    }

    let grade = '';
    if (si.st === 'upcoming') {
        if (canGrade) grade = '<p class="hint-text">Оценку можно поставить, когда урок начнётся.</p>';
    } else if (l.attendance === 'absent') {
        grade = '<p class="hint-text">Ученик пропустил урок — оценка не ставится.</p>';
    } else if (canGrade) {
        grade = `<div class="lm-block"><div class="lm-title">Оценка за урок</div>
            <div class="gpick-row">${[5, 4, 3, 2, 1].map(v =>
                `<button type="button" class="gpick g-${v}${l.grade === v ? ' sel' : ''}" data-act="pick" data-val="${v}" title="${GRADE_NAMES[v]}">${v}</button>`).join('')}</div>
            <input type="text" id="gradeComment" placeholder="Комментарий (необязательно)" maxlength="200" value="${escapeHtml(l.gradeComment || '')}">
            <div class="lm-row">
                <button type="button" class="btn btn-sm" data-act="save-grade">Сохранить оценку</button>
                ${l.grade ? '<button type="button" class="btn btn-sm btn-outline" data-act="clear-grade">Снять оценку</button>' : ''}
            </div></div>`;
    } else if (l.grade) {
        grade = `<div class="lm-block"><div class="lm-title">Оценка за урок</div>
            <div class="grade-card" style="margin-bottom:0;"><div class="grade-value g-${l.grade}">${l.grade}</div>
            <div class="grade-info"><strong>${GRADE_NAMES[l.grade]}</strong>${l.gradeComment ? `<p class="grade-comment">${escapeHtml(l.gradeComment)}</p>` : ''}</div></div></div>`;
    } else {
        grade = '<p class="hint-text">Оценка пока не выставлена.</p>';
    }

    const cancel = manage && si.st === 'upcoming'
        ? '<div class="lm-row" style="margin-top:14px;"><button type="button" class="btn btn-sm btn-danger" data-act="cancel">Отменить занятие</button></div>' : '';

    const ov = openModal(`
        <h3>Занятие</h3>
        <p class="modal-hint">${escapeHtml(lessonWhenText(l))}<br>${lessonTimeRange(l)}</p>
        <div class="lesson-status st-${si.st}">${si.text}${si.note ? ' · ' + si.note : ''}</div>
        <p class="lm-line"><strong>Преподаватель:</strong> ${escapeHtml(getUserName(l.teacherLogin))}</p>
        <p class="lm-line"><strong>Ученик:</strong> ${students}</p>
        <p class="lm-line"><strong>Формат:</strong> ${FORMAT_NAMES[l.format] || ''}</p>
        <p class="lm-line"><strong>${l.format === 'online' ? 'Ссылка' : 'Кабинет'}:</strong> ${place}</p>
        ${attendance}
        ${grade}
        ${cancel}
        <div class="modal-actions" style="margin-top:16px;"><button type="button" class="btn-outline" data-act="close">Закрыть</button></div>
    `);

    let picked = l.grade || 0;
    ov.onclick = e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'close') { closeModal(); return; }
        if (act === 'pick') {
            picked = Number(b.dataset.val);
            ov.querySelectorAll('.gpick').forEach(x => x.classList.toggle('sel', Number(x.dataset.val) === picked));
            return;
        }
        let r = { ok: true };
        if (act === 'att') r = setAttendance(id, l.attendance === b.dataset.val ? '' : b.dataset.val);
        if (act === 'save-grade') {
            if (!picked) { alert('Выберите оценку от 1 до 5.'); return; }
            r = setLessonGrade(id, picked, ov.querySelector('#gradeComment').value);
        }
        if (act === 'clear-grade') r = setLessonGrade(id, 0, '');
        if (act === 'cancel') {
            if (!confirm('Отменить занятие? Время освободится для других уроков.')) return;
            deleteLesson(id);
            closeModal();
            api.refresh();
            return;
        }
        if (!r.ok) { alert(r.error); return; }
        api.refresh();
        openLessonModal(api, id);
    };
}

function buildSchedulePanel(user, role) {
    const isAdmin = role === 'admin';
    const panel = document.getElementById('panel-schedule');
    const teachers = getUsers().filter(u => u.role === 'teacher');

    if (isAdmin && !teachers.length) {
        panel.innerHTML = '<h3>Расписание преподавателей</h3><p class="empty-state">Сначала добавьте преподавателя на вкладке «Преподаватели».</p>';
        return;
    }
    if (isAdmin && !teachers.some(t => t.login === schedState.teacher)) schedState.teacher = teachers[0].login;

    panel.innerHTML = `
        <h3>${isAdmin ? 'Расписание преподавателей' : 'Моё расписание'}</h3>
        ${isAdmin ? `<div class="sched-teacher"><label for="schedTeacher">Преподаватель</label>
            <select id="schedTeacher">${teachers.map(t => `<option value="${escapeHtml(t.login)}"${t.login === schedState.teacher ? ' selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.language || '')})</option>`).join('')}</select></div>` : ''}
        <div id="schedBox"></div>
    `;

    const grid = createWeekGrid(document.getElementById('schedBox'), {
        mode: role,
        user,
        getTeacher: () => isAdmin ? schedState.teacher : user.login,
        onChange: () => { if (!isAdmin) renderTeacherGrades(user); }
    });
    if (isAdmin) {
        document.getElementById('schedTeacher').onchange = function () {
            schedState.teacher = this.value;
            grid.render();
        };
    }
}

function buildChatUI(container, contacts, me) {
    if (!contacts.length) {
        container.innerHTML = '<p class="empty-state">Нет доступных контактов для чата.</p>';
        return;
    }

    let activeLogin = null;
    let filter = '';

    container.innerHTML = `
        <div class="chat-container" id="chatContainer">
            <div class="chat-sidebar">
                <h4 class="chat-sidebar-title">Контакты</h4>
                <input type="text" class="chat-search" id="chatSearch" placeholder="Поиск по имени...">
                <div class="chat-contact-list" id="chatContactList"></div>
            </div>
            <div class="chat-main">
                <div id="chatHeader" class="chat-header" style="display:none;"></div>
                <div class="chat-messages" id="chatMessagesBox">
                    <div class="chat-empty">Выберите контакт, чтобы начать общение</div>
                </div>
                <form id="chatForm" class="chat-input-form" style="display:none;">
                    <textarea id="chatInput" placeholder="Написать сообщение... (Enter — отправить)" required></textarea>
                    <button type="submit" class="btn">Отправить</button>
                </form>
            </div>
        </div>
    `;

    const chatBox = container.querySelector('#chatContainer');
    const listEl = container.querySelector('#chatContactList');
    const headerEl = container.querySelector('#chatHeader');
    const msgBox = container.querySelector('#chatMessagesBox');
    const form = container.querySelector('#chatForm');
    const input = container.querySelector('#chatInput');

    const dialog = login => getMessages().filter(m =>
        (m.fromLogin === me.login && m.toLogin === login) ||
        (m.fromLogin === login && m.toLogin === me.login));

    const shorten = (s, n) => s.length > n ? s.substring(0, n) + '...' : s;

    function renderContacts() {
        const rows = contacts.map(c => {
            const msgs = dialog(c.login);
            const last = msgs.length ? msgs[msgs.length - 1] : null;
            return { c, last, unread: getUnreadCount(me.login, c.login) };
        })
        .filter(r => r.c.name.toLowerCase().includes(filter))
        .sort((a, b) => {
            if (a.last && b.last) return b.last.date.localeCompare(a.last.date);
            if (a.last) return -1;
            if (b.last) return 1;
            return a.c.name.localeCompare(b.c.name, 'ru');
        });

        if (!rows.length) { listEl.innerHTML = '<div class="chat-no-results">Никого не найдено</div>'; return; }

        listEl.innerHTML = rows.map(({ c, last, unread }) => {
            let preview = ROLE_NAMES[c.role] || '';
            if (last) preview = (last.fromLogin === me.login ? 'Вы: ' : '') + last.text.replace(/\s+/g, ' ');
            return `
                <div class="chat-contact${c.login === activeLogin ? ' active' : ''}${unread ? ' contact-unread' : ''}" data-login="${escapeHtml(c.login)}">
                    <div class="contact-avatar">${escapeHtml(c.name.charAt(0))}</div>
                    <div class="contact-info">
                        <strong>${escapeHtml(c.name)}</strong>
                        <span class="contact-preview">${escapeHtml(shorten(preview, 30))}</span>
                    </div>
                    ${unread ? `<span class="contact-badge">${unread}</span>` : ''}
                </div>`;
        }).join('');
    }

    function renderMessages() {
        if (!activeLogin) return;
        const msgs = dialog(activeLogin);
        if (!msgs.length) { msgBox.innerHTML = '<div class="chat-empty">Сообщений нет. Напишите первым!</div>'; return; }

        const todayKey = new Date().toDateString();
        msgBox.innerHTML = msgs.map(m => {
            const dt = new Date(m.date);
            const time = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const when = dt.toDateString() === todayKey ? time : dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + time;
            return `
                <div class="chat-bubble ${m.fromLogin === me.login ? 'bubble-out' : 'bubble-in'}">
                    <div class="bubble-text">${escapeHtml(m.text)}</div>
                    <div class="bubble-time">${when}</div>
                </div>`;
        }).join('');
        msgBox.scrollTop = msgBox.scrollHeight;
    }

    function refreshBadges() { updateBadges(me); }

    function openChat(login) {
        const partner = contacts.find(c => c.login === login);
        if (!partner) return;
        activeLogin = login;
        markChatRead(me.login, login);

        chatBox.classList.add('chat-open');
        headerEl.style.display = 'block';
        headerEl.innerHTML = `<button type="button" class="chat-back">← Назад</button><strong>${escapeHtml(partner.name)}</strong> <span style="color:#64748b;font-weight:normal;font-size:13px;">· ${escapeHtml(ROLE_NAMES[partner.role] || '')}</span>`;
        form.style.display = 'flex';

        renderMessages();
        renderContacts();
        refreshBadges();
        input.focus();
    }

    listEl.addEventListener('click', e => {
        const el = e.target.closest('.chat-contact');
        if (el) openChat(el.dataset.login);
    });

    headerEl.addEventListener('click', e => {
        if (e.target.closest('.chat-back')) {
            chatBox.classList.remove('chat-open');
            activeLogin = null;
            headerEl.style.display = 'none';
            form.style.display = 'none';
            msgBox.innerHTML = '<div class="chat-empty">Выберите контакт, чтобы начать общение</div>';
            renderContacts();
        }
    });

    container.querySelector('#chatSearch').addEventListener('input', e => {
        filter = e.target.value.trim().toLowerCase();
        renderContacts();
    });

    form.onsubmit = function (e) {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || !activeLogin) return;
        addMessage({ fromLogin: me.login, toLogin: activeLogin, text });
        markChatRead(me.login, activeLogin);
        input.value = '';
        renderMessages();
        renderContacts();
    };

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.requestSubmit();
        }
    });

    if (window._chatStorageHandler) window.removeEventListener('storage', window._chatStorageHandler);
    window._chatStorageHandler = e => {
        if (e.key === STORAGE_MESSAGES) {
            if (activeLogin) { markChatRead(me.login, activeLogin); renderMessages(); }
            renderContacts();
            refreshBadges();
        } else if (e.key === STORAGE_READ) {
            renderContacts();
            refreshBadges();
        }
    };
    window.addEventListener('storage', window._chatStorageHandler);

    renderContacts();
}

function renderProfile(user) {
    const wrap = document.getElementById('profileView');
    const teacher = findUserByLogin(user.teacherLogin);

    wrap.innerHTML = `
        <p><strong>Имя:</strong> ${escapeHtml(user.name)}</p>
        <p><strong>Логин:</strong> ${escapeHtml(user.login)}</p>
        <p><strong>Роль:</strong> ${escapeHtml(ROLE_NAMES[user.role] || user.role)}</p>
        <p><strong>Язык:</strong> ${escapeHtml(user.language || '—')}</p>
        ${teacher ? `<p><strong>Преподаватель:</strong> ${escapeHtml(teacher.name)}</p>` : ''}
    `;

    wrap.insertAdjacentHTML('afterend', `
        <div class="dash-form-box password-box">
            <h4>Сменить пароль</h4>
            <form id="passwordForm">
                <input type="password" id="pwOld" placeholder="Текущий пароль" autocomplete="current-password" required style="margin-bottom:10px;">
                <input type="password" id="pwNew" placeholder="Новый пароль (минимум 4 символа)" autocomplete="new-password" required style="margin-bottom:10px;">
                <input type="password" id="pwNew2" placeholder="Повторите новый пароль" autocomplete="new-password" required style="margin-bottom:12px;">
                <button type="submit" class="btn">Сохранить</button>
            </form>
            <p class="form-msg" id="pwMsg"></p>
        </div>
    `);

    document.getElementById('passwordForm').onsubmit = function (e) {
        e.preventDefault();
        const msg = document.getElementById('pwMsg');
        const oldP = document.getElementById('pwOld').value;
        const newP = document.getElementById('pwNew').value;
        const newP2 = document.getElementById('pwNew2').value;
        if (newP !== newP2) { msg.textContent = 'Новые пароли не совпадают.'; msg.className = 'form-msg error'; return; }
        const r = updatePassword(user.login, oldP, newP);
        if (!r.ok) { msg.textContent = r.error; msg.className = 'form-msg error'; return; }
        msg.textContent = 'Пароль изменён.';
        msg.className = 'form-msg success';
        this.reset();
    };
}

function rebuildAdminChat() {
    const me = getCurrentUser();
    buildChatUI(document.getElementById('messagesView'), getUsers().filter(u => u.role !== 'admin'), me);
    updateBadges(me);
}

function refreshAdminAll() {
    renderAdminStudents();
    renderAdminTeachers();
    buildSchedulePanel(getCurrentUser(), 'admin');
    rebuildAdminChat();
}

function initCreateTeacher() {
    document.getElementById('createTeacherForm').onsubmit = function (e) {
        e.preventDefault();
        const d = new FormData(this);
        const result = createUser({
            name: d.get('name'), login: d.get('login'),
            role: 'teacher', language: d.get('language')
        });
        const msg = document.getElementById('createTeacherMsg');
        if (result.ok) {
            msg.textContent = `Преподаватель создан! Логин: ${result.user.login}, пароль: ${result.user.password}`;
            msg.className = 'form-msg success';
            this.reset();
            refreshAdminAll();
        } else {
            msg.textContent = result.error;
            msg.className = 'form-msg error';
        }
    };
}

function initDataPanel() {
    document.getElementById('resetDataBtn').onclick = () => {
        if (!confirm('Удалить ВСЕ данные (заявки, учеников, расписание, оценки, задания, сообщения) и вернуть демо-пользователей?')) return;
        resetAllData();
        clearSession();
        window.location.href = 'login.html';
    };
}

function hwStatus(h) {
    if (h.done) return { text: 'Выполнено', cls: 'status-done' };
    if (h.deadline < todayStr()) return { text: 'Просрочено', cls: 'status-overdue' };
    return { text: 'В работе', cls: 'status-new' };
}

function hwDeadlineText(h) {
    return new Date(h.deadline + 'T00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function hwCardHtml(h, who, actionsHtml) {
    const st = hwStatus(h);
    return `
        <div class="hw-card${h.done ? ' hw-done' : ''}">
            <div class="request-head">
                <strong>${escapeHtml(h.title)}</strong>
                <span class="status-badge ${st.cls}">${st.text}</span>
            </div>
            <p class="hw-meta">${who} · Срок: ${escapeHtml(hwDeadlineText(h))}</p>
            ${h.description ? `<p class="hw-desc">${escapeHtml(h.description)}</p>` : ''}
            <div class="request-actions">${actionsHtml}</div>
        </div>`;
}

function renderTeacherHomework(user, students) {
    const wrap = document.getElementById('homeworkView');
    const options = students.length
        ? students.map(s => `<option value="${escapeHtml(s.login)}">${escapeHtml(s.name)}</option>`).join('')
        : '<option value="">Нет учеников</option>';

    wrap.innerHTML = `
        <div class="dash-form-box">
            <h4>Новое задание</h4>
            <form id="addHwForm">
                <div class="dash-form-row">
                    <select name="studentLogin" required>${options}</select>
                    <input type="date" name="deadline" min="${todayStr()}" required>
                    <input type="text" name="title" placeholder="Название задания" maxlength="100" required style="grid-column:1/-1;">
                    <textarea name="description" placeholder="Описание (необязательно)" maxlength="1000" rows="3" style="grid-column:1/-1;"></textarea>
                </div>
                <button type="submit" class="btn" ${students.length ? '' : 'disabled'}>Задать</button>
            </form>
            <p class="form-msg" id="hwMsg"></p>
        </div>
        <div id="teacherHwList"></div>
    `;

    const list = document.getElementById('teacherHwList');
    const update = () => {
        const items = getHomework().filter(h => h.teacherLogin === user.login)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        list.innerHTML = items.length
            ? items.map(h => hwCardHtml(h, 'Ученик: ' + escapeHtml(getUserName(h.studentLogin)),
                `<button class="btn btn-sm btn-danger" data-act="del-hw" data-id="${h.id}">Удалить</button>`)).join('')
            : '<p class="empty-state">Вы пока не задавали домашних заданий.</p>';
    };

    list.onclick = e => {
        const b = e.target.closest('[data-act="del-hw"]');
        if (b && confirm('Удалить задание?')) { deleteHomework(b.dataset.id); update(); }
    };

    document.getElementById('addHwForm').onsubmit = function (e) {
        e.preventDefault();
        const d = new FormData(this);
        const msg = document.getElementById('hwMsg');
        const title = String(d.get('title')).trim();
        if (!d.get('studentLogin') || title.length < 2) {
            msg.textContent = 'Выберите ученика и введите название задания.';
            msg.className = 'form-msg error';
            return;
        }
        addHomework({
            teacherLogin: user.login, studentLogin: d.get('studentLogin'),
            title, description: String(d.get('description')).trim(), deadline: d.get('deadline')
        });
        this.reset();
        msg.textContent = 'Задание отправлено ученику.';
        msg.className = 'form-msg success';
        update();
    };
    update();
}

function renderStudentHomework(user) {
    const wrap = document.getElementById('homeworkView');

    const render = () => {
        const items = getHomework().filter(h => h.studentLogin === user.login)
            .sort((a, b) => (a.done - b.done) || a.deadline.localeCompare(b.deadline));
        wrap.innerHTML = items.length
            ? items.map(h => hwCardHtml(h, 'Преподаватель: ' + escapeHtml(getUserName(h.teacherLogin)),
                `<button class="btn btn-sm ${h.done ? 'btn-outline' : ''}" data-act="toggle-hw" data-id="${h.id}">${h.done ? 'Вернуть в работу' : 'Отметить выполненным'}</button>`)).join('')
            : '<p class="empty-state">Домашних заданий пока нет.</p>';
        updateBadges(user);
    };

    wrap.onclick = e => {
        const b = e.target.closest('[data-act="toggle-hw"]');
        if (!b) return;
        const h = getHomework().find(x => x.id === b.dataset.id);
        if (h) { setHomeworkDone(h.id, !h.done); render(); }
    };
    render();
}
