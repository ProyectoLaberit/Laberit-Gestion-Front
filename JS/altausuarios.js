        // ── Configuración ──
        const API_BASE = 'http://localhost:8080/api/usuarios';

        // ── Toggle visibilidad contraseña ──
        function togglePass(fieldId, btn) {
            const input = document.getElementById(fieldId);
            const isText = input.type === 'text';
            input.type = isText ? 'password' : 'text';
            btn.innerHTML = isText
                ? `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
                : `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
        }

        // ── Evaluador de fortaleza de contraseña ──
        function evaluarContrasena() {
            const val = document.getElementById('password').value;
            const bar = document.getElementById('strength-bar');
            const label = document.getElementById('strength-label');

            let score = 0;
            if (val.length >= 8)  score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            const levels = [
                { w: '0%',   color: 'transparent', text: '' },
                { w: '25%',  color: '#dc3545', text: 'Débil' },
                { w: '50%',  color: '#ffc107', text: 'Regular' },
                { w: '75%',  color: '#fd7e14', text: 'Buena' },
                { w: '100%', color: '#18bc9c', text: 'Fuerte' },
            ];
            const lvl = val.length === 0 ? levels[0] : levels[score] || levels[1];
            bar.style.width = lvl.w;
            bar.style.background = lvl.color;
            label.textContent = lvl.text;
            label.style.color = lvl.color;
        }

        // ── Validación ──
        function validar() {
            let ok = true;
            const nombre = document.getElementById('nombre');
            const email  = document.getElementById('email');
            const pass   = document.getElementById('password');
            const pass2  = document.getElementById('password2');

            // Nombre
            if (!nombre.value.trim()) {
                nombre.classList.add('is-invalid'); ok = false;
            } else { nombre.classList.remove('is-invalid'); nombre.classList.add('is-valid'); }

            // Email
            const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRx.test(email.value.trim())) {
                email.classList.add('is-invalid'); ok = false;
            } else { email.classList.remove('is-invalid'); email.classList.add('is-valid'); }

            // Password
            if (pass.value.length < 8) {
                pass.classList.add('is-invalid'); ok = false;
            } else { pass.classList.remove('is-invalid'); pass.classList.add('is-valid'); }

            // Confirmar password
            if (pass2.value !== pass.value || pass2.value === '') {
                pass2.classList.add('is-invalid'); ok = false;
            } else { pass2.classList.remove('is-invalid'); pass2.classList.add('is-valid'); }

            return ok;
        }

        // ── Crear usuario (llamada a la API) ──
        async function crearUsuario() {
            ocultarMensajes();
            if (!validar()) return;

            const nombre = document.getElementById('nombre').value.trim();
            const email  = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const rol    = document.querySelector('input[name="rol"]:checked')?.value || 'USUARIO';
            const excels = document.getElementById('excels').checked;

            const payload = { nombre, email, password, rol, excels };

            setBusy(true);
            try {
                const res = await fetch(API_BASE, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    mostrarExito(`Usuario "${nombre}" creado correctamente.`);
                    resetForm();
                } else {
                    mostrarError(data.message || 'Error al crear el usuario.');
                }
            } catch (err) {
                mostrarError('No se pudo conectar con el servidor. Comprueba que el backend está en marcha.');
            } finally {
                setBusy(false);
            }
        }

        // ── Helpers de UI ──
        function setBusy(loading) {
            const btn  = document.getElementById('btn-submit');
            const text = document.getElementById('btn-text');
            const spin = document.getElementById('btn-spinner');
            btn.disabled = loading;
            text.textContent = loading ? 'Creando...' : 'Crear usuario';
            spin.classList.toggle('d-none', !loading);
        }

        function mostrarExito(msg) {
            document.getElementById('msg-success-text').textContent = msg;
            document.getElementById('msg-success').classList.add('show');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function mostrarError(msg) {
            document.getElementById('msg-error-text').textContent = msg;
            document.getElementById('msg-error').classList.add('show');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function ocultarMensajes() {
            document.getElementById('msg-success').classList.remove('show');
            document.getElementById('msg-error').classList.remove('show');
        }

        function resetForm() {
            ['nombre','email','password','password2'].forEach(id => {
                const el = document.getElementById(id);
                el.value = '';
                el.classList.remove('is-valid','is-invalid');
            });
            document.getElementById('excels').checked = false;
            document.querySelector('input[name="rol"][value="USUARIO"]').checked = true;
            document.getElementById('strength-bar').style.width = '0%';
            document.getElementById('strength-label').textContent = '';
            ocultarMensajes();
        }

        function cerrarSesion() {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }