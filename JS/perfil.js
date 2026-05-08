// ── Verificación de sesión al cargar ──────────────────────────────────────────
window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    prepararContextoPerfil();
    aplicarPermisosDom();
    cargarDatosPerfil();
};

function esModoEdicionAjena() {
    const params = new URLSearchParams(window.location.search);
    return params.get("edit") === "1";
}

function prepararContextoPerfil() {
    if (!esModoEdicionAjena()) {
        localStorage.removeItem("usuarioEditando");
    }
}

// Devuelve los datos del usuario a mostrar/editar.
// Si hay un "usuarioEditando" en localStorage (viene desde gestionusuarios),
// usa ese. Si no, usa el propio usuario autenticado.
function getDatosActuales() {
    const editando = localStorage.getItem("usuarioEditando");
    if (esModoEdicionAjena() && editando) return JSON.parse(editando);
    return JSON.parse(localStorage.getItem("usuarioData"));
}

function esEdicionAjena() {
    return esModoEdicionAjena() && !!localStorage.getItem("usuarioEditando");
}

const AVATAR_POR_DEFECTO = "avatar_masculino.png";
const AVATARES_VALIDOS = ["avatar_masculino.png", "avatar_femenino.png"];

function normalizarAvatar(nombreArchivo) {
    const limpio = String(nombreArchivo || "").trim().split("/").pop().split("\\").pop();
    return AVATARES_VALIDOS.includes(limpio) ? limpio : AVATAR_POR_DEFECTO;
}

function getRutaAvatar(nombreArchivo) {
    return `../img/${normalizarAvatar(nombreArchivo)}`;
}

function aplicarAvatarPerfil(nombreArchivo) {
    const avatarFileName = normalizarAvatar(nombreArchivo);
    const profileImg = document.getElementById('profile-img');

    profileImg.onerror = function () {
        this.onerror = null;
        this.src = getRutaAvatar(AVATAR_POR_DEFECTO);
    };
    profileImg.src = getRutaAvatar(avatarFileName);

    document.querySelectorAll('.selector-avatar').forEach(img => img.classList.remove('active'));
    if (avatarFileName === "avatar_femenino.png") {
        document.getElementById('opt-fem').classList.add('active');
    } else {
        document.getElementById('opt-masc').classList.add('active');
    }

    avatarSeleccionadoTemporal = avatarFileName;
}

function cargarDatosPerfil() {
    const userData = getDatosActuales();
    if (!userData) return;

    document.getElementById('user-email').innerText = userData.email || "Sin email";
    document.getElementById('user-fullname').innerText = userData.nombre || "Sin nombre";

    aplicarAvatarPerfil(userData.foto);

    const rolTexto = userData.rol || "USUARIO";
    document.getElementById('user-role-display').innerText = "Rol: " + rolTexto;

    // Si estamos editando a otro usuario, cambiar título y añadir enlace de vuelta
    if (esEdicionAjena()) {
        document.querySelector('h1').innerText = "Editar Usuario";
        if (!document.getElementById('breadcrumb-edicion')) {
            const bc = document.createElement('p');
            bc.id = 'breadcrumb-edicion';
            bc.innerHTML = '<a href="gestionusuarios.html" style="color:#6c757d;text-decoration:none;font-size:0.85rem;">← Volver a Gestión de Usuarios</a>';
            bc.style.marginBottom = '1rem';
            document.querySelector('h1').insertAdjacentElement('afterend', bc);
        }
    }
}

function cerrarSesion() {
    localStorage.removeItem("usuarioEditando");
    localStorage.clear();
    window.location.href = "login.html";
}

// ── Modal de edición ──────────────────────────────────────────────────────────
function abrirModal(campo) {
    const userData = getDatosActuales();

    document.getElementById('campoAEditar').value = campo;
    document.getElementById('mensajeExito').style.display = 'none';

    const inputValor = document.getElementById('inputNuevoValor');
    const divPassVieja = document.getElementById('divPasswordVieja');
    const titulo = document.getElementById('tituloModal');

    inputValor.value = '';
    divPassVieja.style.display = 'none';

    if (campo === 'nombre') {
        titulo.innerText = 'Editar Nombre';
        inputValor.type = 'text';
        inputValor.value = userData.nombre || '';
    } else if (campo === 'email') {
        titulo.innerText = 'Editar Correo';
        inputValor.type = 'email';
        inputValor.value = userData.email || '';
    } else if (campo === 'password') {
        titulo.innerText = 'Cambiar Contraseña';
        inputValor.type = 'password';
        inputValor.placeholder = 'Nueva contraseña...';
        divPassVieja.style.display = 'block';
        document.getElementById('inputPasswordVieja').value = '';
    }

    let modalElement = document.getElementById('modalEdicionMini');
    let modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInstance.show();
}

async function guardarEdicion() {
    const userData = getDatosActuales();
    const campo = document.getElementById('campoAEditar').value;
    const nuevoValor = document.getElementById('inputNuevoValor').value;
    const token = localStorage.getItem("token");

    if (!nuevoValor) return;

    const idUsuario = userData.id;

    try {
        let response, data;

        if (campo === 'password') {
            const passVieja = document.getElementById('inputPasswordVieja').value;
            if (!passVieja) return;

            response = await fetch(`http://localhost:8080/api/usuarios/${idUsuario}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ passwordVieja: passVieja, passwordNueva: nuevoValor })
            });
        } else {
            const body = {};
            body[campo] = nuevoValor;

            response = await fetch(`http://localhost:8080/api/usuarios/${idUsuario}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
        }

        data = await response.json();

        if (data.success) {
            document.getElementById('mensajeExito').style.display = 'block';

            if (campo !== 'password') {
                userData[campo] = nuevoValor;
                if (esEdicionAjena()) {
                    localStorage.setItem("usuarioEditando", JSON.stringify(userData));
                } else {
                    localStorage.setItem("usuarioData", JSON.stringify(userData));
                }
                cargarDatosPerfil();
            }

            setTimeout(() => {
                let modalElement = document.getElementById('modalEdicionMini');
                let modalInstance = bootstrap.Modal.getInstance(modalElement);
                modalInstance.hide();
            }, 1500);

        } else {
            alert("Error: " + data.mensaje);
        }
    } catch (error) {
        alert("Error de conexión con el servidor.");
    }
}

let avatarSeleccionadoTemporal = "";

function abrirModalFoto() {
    const userData = getDatosActuales();
    const avatarFileName = normalizarAvatar(userData.foto);
    avatarSeleccionadoTemporal = avatarFileName;

    document.getElementById('mensajeExitoFoto').style.display = 'none';

    document.querySelectorAll('#modalEdicionFoto .selector-avatar').forEach(img => img.classList.remove('active'));

    if (avatarFileName === "avatar_femenino.png") {
        document.getElementById('opt-fem').classList.add('active');
    } else {
        document.getElementById('opt-masc').classList.add('active');
    }

    let modalElement = document.getElementById('modalEdicionFoto');
    let modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInstance.show();
}

function seleccionarAvatar(nombreArchivo, elementoContenedor) {
    avatarSeleccionadoTemporal = normalizarAvatar(nombreArchivo);
    document.querySelectorAll('#modalEdicionFoto .selector-avatar').forEach(img => img.classList.remove('active'));
    elementoContenedor.querySelector('.selector-avatar').classList.add('active');
}

async function guardarFoto() {
    const userData = getDatosActuales();
    const token = localStorage.getItem("token");

    if (!avatarSeleccionadoTemporal) return;

    try {
        const response = await fetch(`http://localhost:8080/api/usuarios/${userData.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ foto: avatarSeleccionadoTemporal })
        });

        const data = await response.json();

        if (data.success) {
            userData.foto = normalizarAvatar(avatarSeleccionadoTemporal);
            if (esEdicionAjena()) {
                localStorage.setItem("usuarioEditando", JSON.stringify(userData));
            } else {
                localStorage.setItem("usuarioData", JSON.stringify(userData));
            }

            aplicarAvatarPerfil(userData.foto);
            document.getElementById('mensajeExitoFoto').style.display = 'block';

            setTimeout(() => {
                let modalElement = document.getElementById('modalEdicionFoto');
                let modalInstance = bootstrap.Modal.getInstance(modalElement);
                modalInstance.hide();
            }, 1500);

        } else {
            alert("Error: " + data.mensaje);
        }
    } catch (error) {
        alert("Error de conexión con el servidor.");
    }
}
