document.addEventListener('DOMContentLoaded', function () {
    seedUsers();
    renderAuthHeader();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        if (getCurrentUser()) {
            window.location.replace('dashboard.html');
            return;
        }
        loginForm.addEventListener('submit', onLoginSubmit);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', onLogout);
    }
});

function onLoginSubmit(e) {
    e.preventDefault();
    const login = document.getElementById('loginInput').value.trim();
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMsg');

    if (!login || !password) {
        showLoginMsg(msg, 'Введите логин и пароль.', 'error');
        return;
    }

    const user = findUserByLogin(login);
    if (!user || user.password !== password) {
        showLoginMsg(msg, 'Неверный логин или пароль.', 'error');
        return;
    }

    setSession(user.id);
    showLoginMsg(msg, 'Вход выполнен! Перенаправляем...', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
}

function showLoginMsg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'login-msg ' + type;
}

function onLogout() {
    clearSession();
    window.location.href = 'index.html';
}

function renderAuthHeader() {
    const nav = document.querySelector('nav ul');
    if (!nav) return;

    const old = nav.querySelector('.auth-nav-item');
    if (old) old.remove();

    const li = document.createElement('li');
    li.className = 'auth-nav-item';

    const user = getCurrentUser();
    const page = window.location.pathname.split('/').pop();

    if (user) {
        const unread = getTotalUnread(user.login);
        const badge = unread ? `<span class="tab-badge">${unread}</span>` : '';
        li.innerHTML = `
            <a href="dashboard.html" class="nav-auth-link${page === 'dashboard.html' ? ' active-nav' : ''}" title="Личный кабинет">
                <span class="user-avatar">${escapeHtml(user.name.charAt(0))}</span>
                <span class="user-name">${escapeHtml(user.name.split(' ')[0])}</span>${badge}
            </a>
        `;
    } else {
        li.innerHTML = `<a href="login.html" class="nav-auth-link${page === 'login.html' ? ' active-nav' : ''}">Войти</a>`;
    }
    nav.appendChild(li);
}
