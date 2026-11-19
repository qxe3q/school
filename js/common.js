document.addEventListener('DOMContentLoaded', function () {
    initYear();
    initActiveNav();
    initBurger();
    initScrollTop();
    initFooterLinks();
    initHead();
});

function initYear() {
    const el = document.getElementById('year');
    if (el) el.textContent = new Date().getFullYear();
}

function initActiveNav() {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav a').forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#')) return;
        if (link.classList.contains('nav-btn')) return;
        link.classList.remove('active-nav');
        if (href === current) link.classList.add('active-nav');
    });
}

function initBurger() {
    const header = document.querySelector('.header-content');
    const nav = document.querySelector('nav');
    if (!header || !nav) return;

    const burger = document.createElement('button');
    burger.className = 'burger';
    burger.setAttribute('aria-label', 'Открыть меню');
    burger.innerHTML = '<span></span><span></span><span></span>';
    header.appendChild(burger);

    burger.addEventListener('click', () => {
        nav.classList.toggle('nav-open');
        burger.classList.toggle('burger-active');
    });

    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('nav-open');
            burger.classList.remove('burger-active');
        });
    });
}

function initScrollTop() {
    const btn = document.createElement('button');
    btn.className = 'scroll-top';
    btn.innerHTML = '↑';
    btn.setAttribute('aria-label', 'Наверх');
    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 400);
    });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}
function initFooterLinks() {
    const bottom = document.querySelector('.footer-bottom');
    if (!bottom || bottom.querySelector('.footer-links')) return;
    const p = document.createElement('p');
    p.className = 'footer-links';
    p.innerHTML = '<a href="privacy.html">Политика конфиденциальности</a>';
    bottom.appendChild(p);
}

function initHead() {
    if (!document.querySelector('link[rel="icon"]')) {
        const l = document.createElement('link');
        l.rel = 'icon';
        l.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%237c3aed'/%3E%3Ctext x='32' y='44' font-size='34' font-family='Arial' font-weight='bold' text-anchor='middle' fill='white'%3ETL%3C/text%3E%3C/svg%3E";
        document.head.appendChild(l);
    }
    if (!document.querySelector('meta[name="description"]')) {
        const m = document.createElement('meta');
        m.name = 'description';
        m.content = 'TopLanguagesSchool — школа иностранных языков: английский, китайский, французский, немецкий и испанский. Онлайн и офлайн, первое занятие бесплатно.';
        document.head.appendChild(m);
    }
}

document.addEventListener('error', function (e) {
    if (e.target && e.target.tagName === 'IMG') e.target.style.visibility = 'hidden';
}, true);
