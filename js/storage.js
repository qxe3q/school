const STORAGE_USERS = 'tls_users';
const STORAGE_SESSION = 'tls_session';
const STORAGE_REQUESTS = 'tls_requests';
const STORAGE_SCHEDULE = 'tls_schedule';
const STORAGE_MESSAGES = 'tls_messages';
const STORAGE_READ = 'tls_read';
const STORAGE_HOMEWORK = 'tls_homework';
const STORAGE_SEED = 'tls_seed_done';
const DEFAULT_PASSWORD = '1234';

function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function uid(prefix) {
    return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
}

function readJson(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v == null ? fallback : v;
    } catch (e) { return fallback; }
}

const ROLE_NAMES = { admin: 'Администратор', teacher: 'Преподаватель', student: 'Ученик' };

function getUsers() { return readJson(STORAGE_USERS, []); }
function saveUsers(users) { localStorage.setItem(STORAGE_USERS, JSON.stringify(users)); }

function findUserByLogin(login) {
    const l = String(login || '').trim().toLowerCase();
    return getUsers().find(u => String(u.login).toLowerCase() === l) || null;
}

function getUserName(login) {
    const u = findUserByLogin(login);
    return u ? u.name : login;
}

function createUser({ name, login, password = DEFAULT_PASSWORD, role, language, teacherLogin }) {
    name = String(name || '').trim();
    login = String(login || '').trim();
    if (name.length < 2) return { ok: false, error: 'Укажите имя (минимум 2 символа)' };
    if (login.length < 3) return { ok: false, error: 'Логин должен быть не короче 3 символов' };
    if (!password || String(password).length < 4) return { ok: false, error: 'Пароль должен быть не короче 4 символов' };
    if (findUserByLogin(login)) return { ok: false, error: 'Логин уже занят' };

    const users = getUsers();
    const user = {
        id: uid('u'),
        name,
        login,
        password,
        role,
        language: language || '',
        teacherLogin: teacherLogin || ''
    };
    users.push(user);
    saveUsers(users);
    return { ok: true, user };
}

function updatePassword(login, oldPassword, newPassword) {
    const users = getUsers();
    const user = users.find(u => u.login === login);
    if (!user) return { ok: false, error: 'Пользователь не найден' };
    if (user.password !== oldPassword) return { ok: false, error: 'Текущий пароль указан неверно' };
    if (!newPassword || newPassword.length < 4) return { ok: false, error: 'Новый пароль должен быть не короче 4 символов' };
    user.password = newPassword;
    saveUsers(users);
    return { ok: true };
}

function purgeStudentData(logins) {
    if (!logins.length) return;
    saveHomework(getHomework().filter(h => !logins.includes(h.studentLogin)));
    saveMessages(getMessages().filter(m => !logins.includes(m.fromLogin) && !logins.includes(m.toLogin)));

    const schedule = getSchedule()
        .map(l => Object.assign({}, l, { studentLogins: (l.studentLogins || []).filter(s => !logins.includes(s)) }))
        .filter(l => l.studentLogins.length > 0);
    saveSchedule(schedule);

    const readMap = readJson(STORAGE_READ, {});
    logins.forEach(l => delete readMap[l]);
    Object.keys(readMap).forEach(me => logins.forEach(l => delete readMap[me][l]));
    localStorage.setItem(STORAGE_READ, JSON.stringify(readMap));
}

function deleteUserByLogin(login) {
    const user = findUserByLogin(login);
    saveUsers(getUsers().filter(u => u.login !== login));
    if (user && user.role === 'student') purgeStudentData([login]);
}

function deleteAllStudents() {
    const logins = getUsers().filter(u => u.role === 'student').map(u => u.login);
    saveUsers(getUsers().filter(u => u.role !== 'student'));
    purgeStudentData(logins);
}

// Полный сброс базы
function resetAllData() {
    [STORAGE_USERS, STORAGE_REQUESTS, STORAGE_SCHEDULE, STORAGE_MESSAGES, STORAGE_READ,
     STORAGE_HOMEWORK, STORAGE_SEED, 'tls_grades'].forEach(k => localStorage.removeItem(k));
    seedUsers();
}

function getRequests() { return readJson(STORAGE_REQUESTS, []); }
function saveRequests(requests) { localStorage.setItem(STORAGE_REQUESTS, JSON.stringify(requests)); }

function addRequest({ name, phone, language, format }) {
    const requests = getRequests();
    requests.push({
        id: uid('r'), name, phone, language, format,
        status: 'new', createdAt: new Date().toISOString()
    });
    saveRequests(requests);
}

function deleteRequest(id) {
    saveRequests(getRequests().filter(r => r.id !== id));
}

function updateRequestStatus(id, status) {
    const requests = getRequests();
    const req = requests.find(r => r.id === id);
    if (req) { req.status = status; saveRequests(requests); }
}

const LESSON_MINUTES = 50;
const SLOT_MINUTES = 60;

const WORK_HOURS = {
    offline: { weekday: [9, 21], weekend: [10, 18] },
    online:  { weekday: [8, 22], weekend: [8, 22] }
};

function pad2(n) { return String(n).padStart(2, '0'); }
function dateToStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

function getSlotStarts(dateStr, format) {
    const cfg = WORK_HOURS[format];
    if (!cfg) return [];
    const wd = new Date(dateStr + 'T00:00').getDay();
    const range = (wd === 0 || wd === 6) ? cfg.weekend : cfg.weekday;
    const res = [];
    for (let m = range[0] * 60; m + LESSON_MINUTES <= range[1] * 60; m += SLOT_MINUTES) {
        res.push(pad2(Math.floor(m / 60)) + ':' + pad2(m % 60));
    }
    return res;
}
function isSlotAllowed(dateStr, time, format) { return getSlotStarts(dateStr, format).includes(time); }

function workHoursText(format) {
    const c = WORK_HOURS[format];
    const f = h => pad2(h) + ':00';
    const wd = f(c.weekday[0]) + '–' + f(c.weekday[1]);
    const we = f(c.weekend[0]) + '–' + f(c.weekend[1]);
    return wd === we ? 'ежедневно ' + wd : 'Пн–Пт ' + wd + ', Сб–Вс ' + we;
}

function lessonStart(l) { return new Date(l.date + 'T' + l.time); }
function lessonEnd(l) { return new Date(lessonStart(l).getTime() + LESSON_MINUTES * 60000); }

function lessonStatus(l, now) {
    now = now || new Date();
    if (now < lessonStart(l)) return 'upcoming';
    if (now < lessonEnd(l)) return 'live';
    return 'done';
}

function lessonsOverlap(a, b) {
    return lessonStart(a) < lessonEnd(b) && lessonStart(b) < lessonEnd(a);
}

function getSchedule() { return readJson(STORAGE_SCHEDULE, []).filter(l => !l.cancelled); }
function saveSchedule(list) { localStorage.setItem(STORAGE_SCHEDULE, JSON.stringify(list)); }

function createLesson({ teacherLogin, studentLogins, date, time, format, location }) {
    if (!teacherLogin) return { ok: false, error: 'Выберите преподавателя.' };
    if (!studentLogins || !studentLogins.length || !studentLogins[0]) return { ok: false, error: 'Выберите ученика.' };
    if (!WORK_HOURS[format]) return { ok: false, error: 'Выберите формат занятия.' };
    if (!String(location || '').trim()) return { ok: false, error: format === 'online' ? 'Укажите ссылку на занятие.' : 'Укажите кабинет.' };

    if (!isSlotAllowed(date, time, format)) {
        return { ok: false, error: (format === 'online' ? 'Онлайн-уроки проходят ' : 'Офлайн-уроки проходят ') + workHoursText(format) + '.' };
    }

    const candidate = { date, time };
    if (lessonStart(candidate) < new Date()) return { ok: false, error: 'Нельзя назначить занятие на прошедшее время.' };

    const schedule = getSchedule();
    if (schedule.some(l => l.teacherLogin === teacherLogin && lessonsOverlap(l, candidate))) {
        return { ok: false, error: 'У преподавателя уже есть занятие в это время.' };
    }
    for (const slogin of studentLogins) {
        if (schedule.some(l => (l.studentLogins || []).includes(slogin) && lessonsOverlap(l, candidate))) {
            return { ok: false, error: 'У ученика уже есть занятие в это время.' };
        }
    }

    const lesson = { id: uid('l'), teacherLogin, studentLogins, date, time, format, location: String(location).trim() };
    schedule.push(lesson);
    saveSchedule(schedule);
    return { ok: true, lesson };
}

function deleteLesson(id) {
    saveSchedule(getSchedule().filter(l => l.id !== id));
}

function setAttendance(lessonId, value) {
    const schedule = getSchedule();
    const l = schedule.find(x => x.id === lessonId);
    if (!l) return { ok: false, error: 'Занятие не найдено.' };
    if (lessonStatus(l) === 'upcoming') return { ok: false, error: 'Урок ещё не начался.' };
    l.attendance = (value === 'present' || value === 'absent') ? value : '';
    if (l.attendance === 'absent') { delete l.grade; delete l.gradeComment; }
    saveSchedule(schedule);
    return { ok: true };
}

function setLessonGrade(lessonId, value, comment) {
    const schedule = getSchedule();
    const l = schedule.find(x => x.id === lessonId);
    if (!l) return { ok: false, error: 'Занятие не найдено.' };
    if (lessonStatus(l) === 'upcoming') return { ok: false, error: 'Урок ещё не начался — оценку поставить нельзя.' };
    value = Number(value) || 0;
    if (value === 0) {
        delete l.grade; delete l.gradeComment;
    } else {
        if (!Number.isInteger(value) || value < 1 || value > 5) return { ok: false, error: 'Оценка — целое число от 1 до 5.' };
        if (l.attendance === 'absent') return { ok: false, error: 'Ученик пропустил урок — оценка не ставится.' };
        l.grade = value;
        l.gradeComment = String(comment || '').trim();
    }
    saveSchedule(schedule);
    return { ok: true };
}

function getMessages() { return readJson(STORAGE_MESSAGES, []); }
function saveMessages(msgs) { localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(msgs)); }

function addMessage({ fromLogin, toLogin, text }) {
    const msgs = getMessages();
    msgs.push({
        id: uid('m'),
        fromLogin,
        toLogin,
        text,
        date: new Date().toISOString()
    });
    saveMessages(msgs);
}

function markChatRead(me, partner) {
    const map = readJson(STORAGE_READ, {});
    if (!map[me]) map[me] = {};
    map[me][partner] = new Date().toISOString();
    localStorage.setItem(STORAGE_READ, JSON.stringify(map));
}

function getUnreadCount(me, partner) {
    const map = readJson(STORAGE_READ, {});
    const last = (map[me] && map[me][partner]) || '';
    return getMessages().filter(m => m.fromLogin === partner && m.toLogin === me && m.date > last).length;
}

function getTotalUnread(me) {
    const map = readJson(STORAGE_READ, {});
    return getMessages().filter(m => {
        if (m.toLogin !== me) return false;
        const last = (map[me] && map[me][m.fromLogin]) || '';
        return m.date > last;
    }).length;
}

function getHomework() { return readJson(STORAGE_HOMEWORK, []); }
function saveHomework(list) { localStorage.setItem(STORAGE_HOMEWORK, JSON.stringify(list)); }

function addHomework({ teacherLogin, studentLogin, title, description, deadline }) {
    const list = getHomework();
    list.push({
        id: uid('h'), teacherLogin, studentLogin, title,
        description: description || '', deadline, done: false,
        createdAt: new Date().toISOString()
    });
    saveHomework(list);
}
function setHomeworkDone(id, done) {
    const list = getHomework();
    const h = list.find(x => x.id === id);
    if (h) { h.done = !!done; saveHomework(list); }
}
function deleteHomework(id) { saveHomework(getHomework().filter(h => h.id !== id)); }

function setStudentTeacher(studentLogin, teacherLogin) {
    const users = getUsers();
    const s = users.find(u => u.login === studentLogin && u.role === 'student');
    if (s) { s.teacherLogin = teacherLogin || ''; saveUsers(users); }
}

function deleteTeacher(login) {
    const t = findUserByLogin(login);
    if (!t || t.role !== 'teacher') return { ok: false, error: 'Преподаватель не найден' };
    if (getUsers().some(u => u.role === 'student' && u.teacherLogin === login)) {
        return { ok: false, error: 'У преподавателя есть ученики. Сначала переназначьте их другому преподавателю (вкладка «Ученики»).' };
    }
    saveUsers(getUsers().filter(u => u.login !== login));
    saveSchedule(getSchedule().filter(l => l.teacherLogin !== login));
    saveHomework(getHomework().filter(h => h.teacherLogin !== login));
    saveMessages(getMessages().filter(m => m.fromLogin !== login && m.toLogin !== login));
    return { ok: true };
}

function setSession(userId) { localStorage.setItem(STORAGE_SESSION, userId); }
function clearSession() { localStorage.removeItem(STORAGE_SESSION); }
function getCurrentUser() {
    const id = localStorage.getItem(STORAGE_SESSION);
    if (!id) return null;
    return getUsers().find(u => u.id === id) || null;
}

function seedUsers() {
    if (localStorage.getItem(STORAGE_SEED) === 'yes') return;
    const users = getUsers();

    // Админ
    if (!users.some(u => u.login === 'admin')) {
        users.push({ id: 'u_admin', name: 'Администратор', login: 'admin', password: '1234', role: 'admin', language: '' });
    }
    
    // Преподаватели
    const teachers = [
        { login: 'english', name: 'Анна Миронова',  language: 'English' },
        { login: 'chinese', name: 'Ли Вэй',         language: '中文' },
        { login: 'french',  name: 'Жан Бернар',     language: 'Français' },
        { login: 'german',  name: 'Маркус Вебер',   language: 'Deutsch' },
        { login: 'spanish', name: 'Елена Гомес',    language: 'Español' }
    ];
    teachers.forEach((t, i) => {
        if (!users.some(u => u.login === t.login)) {
            users.push({ id: 'u_teacher_' + (i + 1), name: t.name, login: t.login, password: '1234', role: 'teacher', language: t.language });
        }
    });

    // Тестовый ученик (Иван Иванов)
    if (!users.some(u => u.login === 'student')) {
        users.push({ 
            id: 'u_student_1', 
            name: 'Иван Иванов', 
            login: 'student', 
            password: '1234', 
            role: 'student', 
            language: 'English', 
            teacherLogin: 'english' // <--- Жестко привязываем к английскому
        });
    }
    
    saveUsers(users);
    localStorage.setItem(STORAGE_SEED, 'yes');

    // --- АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ТЕСТОВОГО ЗАНЯТИЯ ---
    // Проверяем, есть ли уже занятия. Если нет — создаем одно для Ивана на прошедшую дату.
    const schedule = getSchedule();
    if (!schedule.length) {
        schedule.push({
            id: 'demo_lesson_1',
            teacherLogin: 'english',
            studentLogins: ['student'],
            date: '2026-11-20', // Дата из вашего запроса
            time: '09:00',
            format: 'online',
            location: 'https://zoom.us/j/123456789'
        });
        saveSchedule(schedule);
    }
}