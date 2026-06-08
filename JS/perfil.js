// ── Verificación de sesión al cargar ──────────────────────────────────────────
// Inicializa la pantalla, valida la sesion activa y carga el contexto
// principal necesario antes de que el usuario empiece a interactuar.
window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    prepararContextoPerfil();
    aplicarPermisosDom();
    cargarDatosPerfil();
};

// Detecta si el perfil se ha abierto en modo edicion desde otra pantalla.
function esModoEdicionAjena() {
    const params = new URLSearchParams(window.location.search);
    return params.get("edit") === "1";
}

// Limpia el contexto temporal de edicion cuando se entra al perfil propio.
function prepararContextoPerfil() {
    if (!esModoEdicionAjena()) {
        localStorage.removeItem("usuarioEditando");
    }
}

// Devuelve los datos del usuario a mostrar/editar.
// Si hay un "usuarioEditando" en localStorage (viene desde gestionusuarios),
// usa ese. Si no, usa el propio usuario autenticado.
// Devuelve los datos del usuario a mostrar o editar.
// Si se viene desde gestion de usuarios, prioriza el usuario almacenado para edicion.
function getDatosActuales() {
    const editando = localStorage.getItem("usuarioEditando");
    if (esModoEdicionAjena() && editando) return JSON.parse(editando);
    return JSON.parse(localStorage.getItem("usuarioData"));
}

// Indica si se esta editando el perfil de otro usuario y no el propio.
function esEdicionAjena() {
    return esModoEdicionAjena() && !!localStorage.getItem("usuarioEditando");
}

const AVATAR_POR_DEFECTO = "avatar_masculino.png";
const AVATARES_VALIDOS = ["avatar_masculino.png", "avatar_femenino.png"];
const ROLES_DISPONIBLES = [
    { id: "1", nombre: "SuperAdministrador", etiqueta: "Super Administrador" },
    { id: "2", nombre: "Administrador", etiqueta: "Administrador" },
    { id: "3", nombre: "Empleado", etiqueta: "Empleado" }
];

// Devuelve el rol mostrado de forma legible en el perfil.
function formatearRol(rol) {
    const encontrado = ROLES_DISPONIBLES.find(r => r.nombre === rol || r.id === String(rol));
    return encontrado ? encontrado.etiqueta : (rol || "USUARIO");
}

// Convierte el nombre de rol recibido del backend al identificador usado por la tabla rol.
function obtenerIdRol(rol) {
    const encontrado = ROLES_DISPONIBLES.find(r => r.nombre === rol || r.id === String(rol));
    return encontrado ? encontrado.id : "3";
}

// Convierte el identificador seleccionado al nombre de rol que usa el frontend.
function obtenerNombreRol(idRol) {
    const encontrado = ROLES_DISPONIBLES.find(r => r.id === String(idRol));
    return encontrado ? encontrado.nombre : "Empleado";
}

function normalizarNombreRol(rol) {
    const encontrado = ROLES_DISPONIBLES.find(r => r.nombre === rol || r.id === String(rol));
    return encontrado ? encontrado.nombre : (rol || "");
}

function esRolCuentaProtegida(rol) {
    const nombreRol = normalizarNombreRol(rol);
    return nombreRol === "SuperAdministrador" || nombreRol === "Administrador";
}

// Solo un SuperAdministrador puede cambiar el rol de otro usuario desde Gestion Usuarios.
function puedeCambiarRol(userData) {
    return esSuperAdmin()
        && esEdicionAjena()
        && userData
        && String(userData.id) !== String(getIdActual());
}

function puedeEditarPerfil(userData) {
    if (!userData) {
        return false;
    }

    if (!esEdicionAjena() || String(userData.id) === String(getIdActual())) {
        return true;
    }

    if (esSuperAdmin()) {
        return true;
    }

    if (typeof esAdmin === "function" && esAdmin()) {
        return !esRolCuentaProtegida(userData.rol);
    }

    return false;
}

function actualizarPermisosEdicionPerfil(userData) {
    const editable = puedeEditarPerfil(userData);
    const mensaje = "Un Administrador solo puede editar perfiles de empleados.";

    document.querySelectorAll(".field-group button").forEach((boton) => {
        boton.disabled = !editable;
        boton.classList.toggle("disabled", !editable);
        boton.title = editable ? "" : mensaje;
    });

    const botonFoto = document.getElementById("btn-cambiar-foto");
    if (botonFoto) {
        botonFoto.disabled = !editable;
        botonFoto.classList.toggle("disabled", !editable);
        botonFoto.title = editable ? "" : mensaje;
    }
}

// Normaliza el nombre del avatar y aplica uno por defecto si no es valido.
function normalizarAvatar(nombreArchivo) {
    const limpio = String(nombreArchivo || "").trim().split("/").pop().split("\\").pop();
    return AVATARES_VALIDOS.includes(limpio) ? limpio : AVATAR_POR_DEFECTO;
}

// Construye la ruta local del avatar que debe mostrarse en pantalla.
function getRutaAvatar(nombreArchivo) {
    return `../img/${normalizarAvatar(nombreArchivo)}`;
}

// Actualiza la imagen de perfil visible y sincroniza el selector de avatares.
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

// Carga en pantalla los datos del perfil actual o del usuario que se esta editando.
function cargarDatosPerfil() {
    const userData = getDatosActuales();
    if (!userData) return;

    document.getElementById('user-email').innerText = userData.email || "Sin email";
    document.getElementById('user-fullname').innerText = userData.nombre || "Sin nombre";

    aplicarAvatarPerfil(userData.foto);

    const rolDisplay = document.getElementById('user-role-display');
    const rolTexto = formatearRol(userData.rol);
    const rolEditable = puedeCambiarRol(userData);

    rolDisplay.innerText = "Rol: " + rolTexto;
    rolDisplay.disabled = !rolEditable;
    rolDisplay.classList.toggle("role-clickable", rolEditable);
    rolDisplay.title = rolEditable
        ? "Cambiar rol del usuario"
        : "Solo un SuperAdministrador puede cambiar roles de otros usuarios";

    actualizarPermisosEdicionPerfil(userData);

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

// Abre el selector de rol para SuperAdministrador cuando edita a otro usuario.
function abrirModalRol() {
    const userData = getDatosActuales();
    if (!puedeCambiarRol(userData)) {
        return;
    }

    document.getElementById("selectNuevoRol").value = obtenerIdRol(userData.rol);
    document.getElementById("mensajeExitoRol").style.display = "none";

    const modalElement = document.getElementById("modalCambioRol");
    const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInstance.show();
}

// Guarda el nuevo rol del usuario editado y refresca la vista local.
async function guardarRol() {
    const userData = getDatosActuales();
    if (!puedeCambiarRol(userData)) {
        return;
    }

    const nuevoRolId = document.getElementById("selectNuevoRol").value;
    const result = await peticionSegura(`/usuarios/${userData.id}/rol`, {
        method: "PUT",
        body: JSON.stringify({ rol: nuevoRolId })
    });

    if (!result || !result.success) {
        alert((result && result.mensaje) || "No se pudo cambiar el rol.");
        return;
    }

    userData.rol = obtenerNombreRol(nuevoRolId);
    localStorage.setItem("usuarioEditando", JSON.stringify(userData));
    cargarDatosPerfil();

    document.getElementById("mensajeExitoRol").style.display = "block";

    setTimeout(() => {
        const modalElement = document.getElementById("modalCambioRol");
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            modalInstance.hide();
        }
    }, 1000);
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.removeItem("usuarioEditando");
    localStorage.clear();
    window.location.href = "login.html";
}

// ── Modal de edición ──────────────────────────────────────────────────────────
// Abre el modal de edicion y lo prepara segun el campo que se quiere modificar.
function abrirModal(campo) {
    const userData = getDatosActuales();
    if (!puedeEditarPerfil(userData)) {
        alert("No tienes permisos para modificar los datos de este usuario.");
        return;
    }

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

// Guarda en el backend los cambios del modal de edicion y actualiza la vista.
async function guardarEdicion() {
    const userData = getDatosActuales();
    const campo = document.getElementById('campoAEditar').value;
    const nuevoValor = document.getElementById('inputNuevoValor').value;
    const token = localStorage.getItem("token");

    if (!puedeEditarPerfil(userData)) {
        alert("No tienes permisos para modificar los datos de este usuario.");
        return;
    }

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

// Abre el modal de seleccion de avatar dejando marcado el avatar actual.
function abrirModalFoto() {
    const userData = getDatosActuales();
    if (!puedeEditarPerfil(userData)) {
        alert("No tienes permisos para modificar este perfil.");
        return;
    }

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

// Guarda temporalmente el avatar elegido y resalta la opcion activa.
function seleccionarAvatar(nombreArchivo, elementoContenedor) {
    avatarSeleccionadoTemporal = normalizarAvatar(nombreArchivo);
    document.querySelectorAll('#modalEdicionFoto .selector-avatar').forEach(img => img.classList.remove('active'));
    elementoContenedor.querySelector('.selector-avatar').classList.add('active');
}

// Guarda el avatar seleccionado en el backend y actualiza la sesion local.
async function guardarFoto() {
    const userData = getDatosActuales();
    const token = localStorage.getItem("token");

    if (!puedeEditarPerfil(userData)) {
        alert("No tienes permisos para modificar este perfil.");
        return;
    }

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
