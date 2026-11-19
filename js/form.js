document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('requestForm');
    if (!form) return;

    const phoneInput = document.getElementById('reqPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            let digits = e.target.value.replace(/\D/g, '');
            if (digits.length > 0 && digits[0] !== '7' && digits[0] !== '8') digits = '7' + digits;
            digits = digits.substring(0, 11);

            let formatted = '';
            if (digits.length > 0) formatted = '+7';
            if (digits.length > 1) formatted += ' (' + digits.substring(1, 4);
            if (digits.length >= 5) formatted += ') ' + digits.substring(4, 7);
            if (digits.length >= 8) formatted += '-' + digits.substring(7, 9);
            if (digits.length >= 10) formatted += '-' + digits.substring(9, 11);
            e.target.value = formatted;
        });
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const msg = document.getElementById('requestMsg');

        const name = document.getElementById('reqName').value.trim();
        const phone = document.getElementById('reqPhone').value.trim();
        const language = document.getElementById('reqLanguage').value;
        const formatRadio = document.querySelector('input[name="reqFormat"]:checked');
        const format = formatRadio ? formatRadio.value : 'online';

        if (name.length < 2) {
            showMsg(msg, 'Пожалуйста, укажите имя (минимум 2 символа).', 'error');
            return;
        }
        if (phone.replace(/\D/g, '').length < 11) {
            showMsg(msg, 'Пожалуйста, введите корректный номер телефона.', 'error');
            return;
        }
        if (!language) {
            showMsg(msg, 'Пожалуйста, выберите язык.', 'error');
            return;
        }

        const consent = document.getElementById('reqConsent');
        if (consent && !consent.checked) {
            showMsg(msg, 'Подтвердите согласие на обработку персональных данных.', 'error');
            return;
        }

        const duplicate = getRequests().some(r =>
            r.phone === phone && r.language === language && r.status === 'new');
        if (duplicate) {
            showMsg(msg, 'Заявка с этим номером на выбранный язык уже отправлена — мы скоро с вами свяжемся.', 'error');
            return;
        }

        addRequest({ name, phone, language, format });

        showMsg(msg, `Спасибо, ${name}! Ваша заявка принята. Администратор свяжется с вами в ближайшее время.`, 'success');
        form.reset();
    });

    function showMsg(el, text, type) {
        if (!el) return;
        el.textContent = text;
        el.className = 'form-msg ' + type;
    }
});
