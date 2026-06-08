let todosLosUsuarios = [];
let idAEliminar = null;

// Inicializa la pantalla, valida la sesion activa y carga el contexto
// principal necesario antes de que el usuario empiece a interactuar.
window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
if (!esSuperAdmin() && !esAdmin()) {
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
    cargarUsuarios();
    configurarModalEliminar();
};

// Carga la lista de usuarios y delega su pintado en la tabla principal.
async function cargarUsuarios() {
    const result = await peticionSegura("/usuarios");

    if (!result || !result.success) {
        document.getElementById("tabla-usuarios").innerHTML = `
            <tr><td colspan="4" class="empty-state text-danger">
                Error al cargar los usuarios.
            </td></tr>`;
        return;
    }

    todosLosUsuarios = result.data || [];
    renderizarTabla(todosLosUsuarios);
}

// Pinta la tabla principal de esta vista usando los datos disponibles.
function renderizarTabla(usuarios) {
    const tbody = document.getElementById("tabla-usuarios");
    const contador = document.getElementById("contador-usuarios");
    const propioId = getIdActual();

    contador.textContent = `${usuarios.length} usuario${usuarios.length !== 1 ? "s" : ""}`;

    if (usuarios.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="4" class="empty-state">
                No se encontraron usuarios.
            </td></tr>`;
        return;
    }

    tbody.innerHTML = usuarios.map(u => {
        const avatar = u.foto || "avatar_masculino.png";
        const rolBadge = badgeRol(u.rol);
        const esPropioUsuario = u.id === propioId;
        const puedeEditar = puedeEditarUsuarioGestion(u);
        const accionEditar = puedeEditar
            ? `onclick="irAEditar(${u.id}, '${(u.nombre||'').replace(/'/g,"\\'")}', '${(u.email||'').replace(/'/g,"\\'")}', '${u.rol||''}', '${u.foto||''}')"`
            : "disabled";
        const tituloEditar = puedeEditar
            ? "Editar usuario"
            : "Un Administrador solo puede editar perfiles de empleados";

        return `
        <tr>
            <td class="user-main-cell" data-label="Usuario">
                <div class="d-flex align-items-center gap-3">
                    <img src="../img/${avatar}" alt="${u.nombre}" class="avatar-sm"
                        onerror="this.src='../img/avatar_masculino.png'">
                    <div>
                        <div class="fw-semibold">${u.nombre || "Sin nombre"}</div>
                        <div class="text-muted small">#${u.id}</div>
                    </div>
                </div>
            </td>
            <td class="text-muted" data-label="Correo">${u.email || "—"}</td>
            <td data-label="Rol">${rolBadge}</td>
            <td class="text-end user-actions-cell" data-label="Acciones">
                <div class="d-flex gap-2 justify-content-end user-actions">
                    <button class="btn btn-sm btn-outline-secondary"
                        ${accionEditar}
                        data-rol-minimo="ADMIN"
                        title="${tituloEditar}">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Editar
                    </button>
                    ${!esPropioUsuario && esSuperAdmin() ? `
                    <button class="btn btn-sm btn-outline-danger"
                        onclick="confirmarEliminar(${u.id}, '${(u.nombre||'').replace(/'/g,"\\'")}')"
                        data-rol-minimo="SUPERADMIN">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                        Eliminar
                    </button>` : `
                    <button class="btn btn-sm btn-outline-danger" disabled title="No puedes eliminarte a ti mismo">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                        Eliminar
                    </button>`}
                </div>
            </td>
        </tr>`;
    }).join("");
    if (typeof aplicarRestriccionesPorRol === "function") {
        aplicarRestriccionesPorRol();
    }
}

// Devuelve el badge HTML que representa visualmente el rol del usuario.
function badgeRol(rol) {
    if (!rol) return `<span class="badge-rol badge-empleado">—</span>`;
    if (rol === "SuperAdministrador") return `<span class="badge-rol badge-superadmin">SuperAdmin</span>`;
    if (rol === "Administrador")      return `<span class="badge-rol badge-admin">Administrador</span>`;
    return `<span class="badge-rol badge-empleado">${rol}</span>`;
}

function esRolGestionProtegido(rol) {
    return rol === "SuperAdministrador" || rol === "Administrador";
}

function puedeEditarUsuarioGestion(usuario) {
    if (esSuperAdmin()) {
        return true;
    }

    if (typeof esAdmin === "function" && esAdmin()) {
        return usuario && !esRolGestionProtegido(usuario.rol);
    }

    return false;
}

// Filtra la tabla de usuarios usando el texto escrito en el buscador.
function filtrarUsuarios() {
    const filtro = document.getElementById("input-busqueda").value.toLowerCase().trim();
    const filtrados = todosLosUsuarios.filter(u =>
        (u.nombre || "").toLowerCase().includes(filtro) ||
        (u.email  || "").toLowerCase().includes(filtro) ||
        (u.rol    || "").toLowerCase().includes(filtro)
    );
    renderizarTabla(filtrados);
}

// ── Editar: guarda los datos del usuario en localStorage y va a perfil.html ──
// Guarda el usuario seleccionado y navega al perfil en modo edicion.
function irAEditar(id, nombre, email, rol, foto) {
    if (!puedeEditarUsuarioGestion({ rol })) {
        alert("Un Administrador solo puede editar perfiles de empleados.");
        return;
    }

    localStorage.setItem("usuarioEditando", JSON.stringify({ id, nombre, email, rol, foto }));
    window.location.href = "perfil.html?edit=1";
}

// ── Eliminar ──────────────────────────────────────────────────────────────────
// Abre el modal de confirmacion para eliminar el usuario seleccionado.
function confirmarEliminar(id, nombre) {
    idAEliminar = id;
    document.getElementById("modal-eliminar-nombre").textContent =
        `Se eliminará a "${nombre}". Esta acción no se puede deshacer.`;
    const modal = new bootstrap.Modal(document.getElementById("modalEliminar"));
    modal.show();
}

// Configura los eventos del modal de eliminacion y ejecuta el borrado al confirmar.
function configurarModalEliminar() {
    document.getElementById("btn-confirmar-eliminar").addEventListener("click", async () => {
        if (!idAEliminar) return;

        const btn = document.getElementById("btn-confirmar-eliminar");
        btn.disabled = true;
        btn.textContent = "Eliminando...";

        const result = await peticionSegura(`/usuarios/${idAEliminar}`, { method: "DELETE" });

        btn.disabled = false;
        btn.textContent = "Eliminar";

        bootstrap.Modal.getInstance(document.getElementById("modalEliminar")).hide();

        if (result && result.success) {
            todosLosUsuarios = todosLosUsuarios.filter(u => u.id !== idAEliminar);
            renderizarTabla(todosLosUsuarios);
            idAEliminar = null;
        } else {
            alert((result && result.mensaje) || "Error al eliminar el usuario.");
        }
    });
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
