let todosLosUsuarios = [];
let idAEliminar = null;

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

        return `
        <tr>
            <td>
                <div class="d-flex align-items-center gap-3">
                    <img src="../img/${avatar}" alt="${u.nombre}" class="avatar-sm"
                        onerror="this.src='../img/avatar_masculino.png'">
                    <div>
                        <div class="fw-semibold">${u.nombre || "Sin nombre"}</div>
                        <div class="text-muted small">#${u.id}</div>
                    </div>
                </div>
            </td>
            <td class="text-muted">${u.email || "—"}</td>
            <td>${rolBadge}</td>
            <td class="text-end">
                <div class="d-flex gap-2 justify-content-end">
                    <button class="btn btn-sm btn-outline-secondary"
                        onclick="irAEditar(${u.id}, '${(u.nombre||'').replace(/'/g,"\\'")}', '${(u.email||'').replace(/'/g,"\\'")}', '${u.rol||''}', '${u.foto||''}')"
                        title="Editar usuario">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Editar
                    </button>
                    ${!esPropioUsuario && !esAdmin() ? `
                    <button class="btn btn-sm btn-outline-danger"
                        onclick="confirmarEliminar(${u.id}, '${(u.nombre||'').replace(/'/g,"\\'")}')">
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
}

function badgeRol(rol) {
    if (!rol) return `<span class="badge-rol badge-empleado">—</span>`;
    if (rol === "SuperAdministrador") return `<span class="badge-rol badge-superadmin">SuperAdmin</span>`;
    if (rol === "Administrador")      return `<span class="badge-rol badge-admin">Administrador</span>`;
    return `<span class="badge-rol badge-empleado">${rol}</span>`;
}

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
function irAEditar(id, nombre, email, rol, foto) {
    localStorage.setItem("usuarioEditando", JSON.stringify({ id, nombre, email, rol, foto }));
    window.location.href = "perfil.html?edit=1";
}

// ── Eliminar ──────────────────────────────────────────────────────────────────
function confirmarEliminar(id, nombre) {
    idAEliminar = id;
    document.getElementById("modal-eliminar-nombre").textContent =
        `Se eliminará a "${nombre}". Esta acción no se puede deshacer.`;
    const modal = new bootstrap.Modal(document.getElementById("modalEliminar"));
    modal.show();
}

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

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
