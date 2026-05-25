// ── Verificación de acceso: solo Administrador o SuperAdministrador ───────────
// Al cargar la pagina, comprueba que exista sesion y que el usuario tenga
// permisos de administrador. Si no, redirige o muestra un bloqueo visual.
window.addEventListener("DOMContentLoaded", function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    if (!esAdmin()) {
document.body.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: #f8f9fa;
            font-family: sans-serif;
        ">
            <div style="
                width: 80px; height: 80px;
                background: #fee2e2;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 1.5rem;
            ">
                <svg width="40" height="40" fill="none" stroke="#dc2626" stroke-width="2.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
            </div>
            <h2 style="color:#1f2937;font-weight:800;margin:0 0 0.5rem;">Acceso no permitido</h2>
            <p style="color:#6c757d;margin:0 0 1.5rem;">No tienes permisos para acceder a esta sección.</p>
            <a href="proyectos.html" style="
                background:#C01717;
                color:white;
                padding:10px 24px;
                border-radius:6px;
                text-decoration:none;
                font-weight:600;
            ">Volver a Proyectos</a>
        </div>`;
    return;
}
    aplicarPermisosDom();
});

// ── Toggle visibilidad contraseña ─────────────────────────────────────────────
// Alterna entre mostrar y ocultar la contrasena del campo indicado,
// y actualiza el icono del boton segun el estado actual.
function togglePass(fieldId, btn) {
    const input = document.getElementById(fieldId);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.innerHTML = isText
        ? `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

// ── Evaluador de fortaleza de contraseña ──────────────────────────────────────
// Calcula una puntuacion basica de fortaleza usando longitud, mayusculas,
// numeros y simbolos, y refleja el resultado en la barra visual.
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

// ── Validación ────────────────────────────────────────────────────────────────
// Valida nombre, email y contrasenas antes de enviar el formulario.
// Tambien marca cada campo como valido o invalido para dar feedback visual.
function validar() {
    let ok = true;
    const nombre = document.getElementById('nombre');
    const email  = document.getElementById('email');
    const pass   = document.getElementById('password');
    const pass2  = document.getElementById('password2');

    if (!nombre.value.trim()) {
        nombre.classList.add('is-invalid'); ok = false;
    } else { nombre.classList.remove('is-invalid'); nombre.classList.add('is-valid'); }

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email.value.trim())) {
        email.classList.add('is-invalid'); ok = false;
    } else { email.classList.remove('is-invalid'); email.classList.add('is-valid'); }

    if (pass.value.length < 8) {
        pass.classList.add('is-invalid'); ok = false;
    } else { pass.classList.remove('is-invalid'); pass.classList.add('is-valid'); }

    if (pass2.value !== pass.value || pass2.value === '') {
        pass2.classList.add('is-invalid'); ok = false;
    } else { pass2.classList.remove('is-invalid'); pass2.classList.add('is-valid'); }

    return ok;
}

// ── Crear usuario (solo ADMIN llega aquí) ─────────────────────────────────────
// Recoge los datos del formulario, construye el payload y llama al backend para crear el usuario. Si todo sale bien, limpia el formulario y muestra aviso.
// Recoge los datos del formulario, construye el payload y llama al backend
// para crear el usuario. Si todo sale bien, limpia el formulario y muestra aviso.
async function crearUsuario() {
    ocultarMensajes();
    if (!validar()) return;

    const nombre   = document.getElementById('nombre').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rolSeleccionado = document.querySelector('input[name="rol"]:checked')?.value || 'USER';
    const excels   = document.getElementById('excels').checked;

    // ADMIN puede asignar cualquier rol; el backend lo valida también
    const payload = { nombre, email, password, rol: rolSeleccionado, excels };

    setBusy(true);
    try {
        const data = await peticionSegura("/usuarios", {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (data && data.success) {
            resetForm();
            mostrarExito(`Usuario "${nombre}" creado correctamente.`);
        } else {
            mostrarError((data && data.mensaje) || 'Error al crear el usuario.');
        }
    } catch (err) {
        mostrarError('No se pudo conectar con el servidor. Comprueba que el backend está en marcha.');
    } finally {
        setBusy(false);
    }
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────
// Activa o desactiva el estado de carga del boton principal para evitar envios duplicados mientras se procesa la peticion.
// Activa o desactiva el estado de carga de la accion actual
// para evitar envios duplicados mientras se procesa la peticion.
function setBusy(loading) {                                     
    const btn  = document.getElementById('btn-submit');
    const text = document.getElementById('btn-text');
    const spin = document.getElementById('btn-spinner');
    btn.disabled = loading;
    text.textContent = loading ? 'Creando...' : 'Crear usuario';
    spin.classList.toggle('d-none', !loading);
}

// Muestra el mensaje de exito y desplaza la vista hacia arriba para que sea visible.
// Muestra un mensaje de exito y lo hace visible en la parte superior de la vista.
function mostrarExito(msg) {
    document.getElementById('msg-success-text').textContent = msg;
    document.getElementById('msg-success').classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Muestra el mensaje de error y desplaza la vista hacia arriba para destacarlo.
// Muestra un mensaje de error visible para informar del problema actual.
function mostrarError(msg) {
    document.getElementById('msg-error-text').textContent = msg;
    document.getElementById('msg-error').classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Oculta ambos mensajes de estado antes de una nueva accion del usuario.
// Oculta los mensajes de estado antes de iniciar una nueva accion.
function ocultarMensajes() {
    document.getElementById('msg-success').classList.remove('show');
    document.getElementById('msg-error').classList.remove('show');
}

// Restaura el formulario a su estado inicial, incluidos validaciones,
// rol por defecto y medidor visual de fortaleza.
// Restablece el formulario a su estado inicial y limpia las validaciones previas.
function resetForm() {
    ['nombre','email','password','password2'].forEach(id => {
        const el = document.getElementById(id);
        el.value = '';
        el.classList.remove('is-valid','is-invalid');
    });
    document.getElementById('excels').checked = false;
    const rolEmpleado = document.querySelector('input[name="rol"][value="3"]');
    if (rolEmpleado) rolEmpleado.checked = true;
    document.getElementById('strength-bar').style.width = '0%';
    document.getElementById('strength-label').textContent = '';
    ocultarMensajes();
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = 'login.html';
}
