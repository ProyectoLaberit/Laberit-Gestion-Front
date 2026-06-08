let todosLosProyectos = [];
let proyectoAEliminar = null;

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
                <p style="color:#6c757d;margin:0 0 1.5rem;">No tienes permisos para acceder a esta seccion.</p>
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

    cargarProyectos();
    configurarModalEliminar();
};

// Carga la lista de proyectos, la guarda en sesion y actualiza la tabla principal.
async function cargarProyectos() {
    const result = await peticionSegura("/proyectos/cargar");

    if (!result || !result.success) {
        document.getElementById("tabla-proyectos").innerHTML = `
            <tr><td colspan="5" class="empty-state text-danger">
                Error al cargar los proyectos.
            </td></tr>`;
        return;
    }

    todosLosProyectos = Array.isArray(result.data) ? result.data : [];
    localStorage.setItem("proyectos", JSON.stringify(todosLosProyectos));
    renderizarTabla(todosLosProyectos);
}

// Pinta la tabla principal de esta vista usando los datos disponibles.
function renderizarTabla(proyectos) {
    const tbody = document.getElementById("tabla-proyectos");
    const contador = document.getElementById("contador-proyectos");

    contador.textContent = `${proyectos.length} proyecto${proyectos.length !== 1 ? "s" : ""}`;

    if (proyectos.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="5" class="empty-state">
                No se encontraron proyectos.
            </td></tr>`;
        return;
    }

    tbody.innerHTML = proyectos.map((proyecto) => {
        const nombreSeguro = escaparTexto(proyecto.nombre || "");
        const descripcion = proyecto.descripcion || "Sin descripcion";
        const fechaInicio = formatearFecha(proyecto.fechaInicio);
        const badgeEstado = obtenerBadgeEstado(proyecto.activo);

        return `
        <tr>
            <td class="project-main-cell" data-label="Proyecto">
                <div class="d-flex align-items-center gap-3">
                    <div class="project-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        </svg>
                    </div>
                    <div>
                        <div class="fw-semibold">${escaparHtml(proyecto.nombre || "Sin nombre")}</div>
                        <div class="text-muted small">#${escaparHtml(proyecto.id)}</div>
                    </div>
                </div>
            </td>
            <td class="text-muted" data-label="Descripcion">${escaparHtml(descripcion)}</td>
            <td data-label="Estado">${badgeEstado}</td>
            <td class="text-muted" data-label="Fecha inicio">${escaparHtml(fechaInicio)}</td>
            <td class="text-end project-actions-cell" data-label="Acciones">
                <div class="d-flex gap-2 justify-content-end project-actions">
                    <button class="btn btn-sm btn-outline-secondary"
                        onclick="irAEditarProyecto(${Number(proyecto.id)})"
                        data-rol-minimo="ADMIN"
                        title="Editar proyecto">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Editar
                    </button>
                    ${esSuperAdmin() ? `
                    <button class="btn btn-sm btn-outline-danger"
                        onclick="confirmarEliminarProyecto(${Number(proyecto.id)}, '${nombreSeguro}')"
                        data-rol-minimo="SUPERADMIN">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                        Eliminar
                    </button>` : `
                    <button class="btn btn-sm btn-outline-danger" disabled title="Solo SuperAdmin puede eliminar proyectos">
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

// Filtra la tabla de proyectos usando el texto escrito en el buscador.
function filtrarProyectos() {
    const filtro = document.getElementById("input-busqueda").value.toLowerCase().trim();
    const filtrados = todosLosProyectos.filter((proyecto) =>
        (proyecto.nombre || "").toLowerCase().includes(filtro) ||
        (proyecto.descripcion || "").toLowerCase().includes(filtro) ||
        String(proyecto.id || "").toLowerCase().includes(filtro)
    );
    renderizarTabla(filtrados);
}

// Guarda el proyecto seleccionado y abre su pantalla de edicion.
function irAEditarProyecto(id) {
    localStorage.setItem("proyectoId", String(id));
    localStorage.setItem("proyectos", JSON.stringify(todosLosProyectos));
    window.location.href = "editarproyecto.html?volver=gestionproyectos.html";
}

// Abre el modal de confirmacion reforzada para borrar un proyecto.
function confirmarEliminarProyecto(id, nombre) {
    proyectoAEliminar = { id, nombre };

    const modalTexto = document.getElementById("modal-eliminar-texto");
    const input = document.getElementById("input-confirmacion-proyecto");
    const error = document.getElementById("error-confirmacion-proyecto");
    const boton = document.getElementById("btn-confirmar-eliminar-proyecto");

    modalTexto.textContent = `Se eliminara permanentemente el proyecto "${nombre}" y tambien se borrara de la base de datos todo lo relacionado con el.`;
    input.value = "";
    error.textContent = "El nombre no coincide.";
    error.classList.add("d-none");
    boton.disabled = true;

    const modal = new bootstrap.Modal(document.getElementById("modalEliminarProyecto"));
    modal.show();

    setTimeout(() => input.focus(), 200);
}

// Configura los eventos del modal de eliminacion y ejecuta el borrado al confirmar.
function configurarModalEliminar() {
    const input = document.getElementById("input-confirmacion-proyecto");
    const boton = document.getElementById("btn-confirmar-eliminar-proyecto");
    const error = document.getElementById("error-confirmacion-proyecto");
    const modalElemento = document.getElementById("modalEliminarProyecto");

    input.addEventListener("input", () => {
        const coincide = proyectoAEliminar && input.value.trim() === proyectoAEliminar.nombre;
        boton.disabled = !coincide;

        if (input.value.trim() === "" || coincide) {
            error.textContent = "El nombre no coincide.";
            error.classList.add("d-none");
            return;
        }

        error.textContent = "El nombre no coincide.";
        error.classList.remove("d-none");
    });

    modalElemento.addEventListener("hidden.bs.modal", () => {
        proyectoAEliminar = null;
        input.value = "";
        boton.disabled = true;
        boton.textContent = "Eliminar";
        boton.classList.remove("disabled");
        error.textContent = "El nombre no coincide.";
        error.classList.add("d-none");
    });

    boton.addEventListener("click", async () => {
        if (!proyectoAEliminar || input.value.trim() !== proyectoAEliminar.nombre) {
            error.classList.remove("d-none");
            return;
        }

        boton.disabled = true;
        boton.textContent = "Eliminando...";

        const result = await peticionSegura(`/proyectos/${proyectoAEliminar.id}`, { method: "DELETE" });

        if (result && result.success) {
            todosLosProyectos = todosLosProyectos.filter((proyecto) => proyecto.id !== proyectoAEliminar.id);
            localStorage.setItem("proyectos", JSON.stringify(todosLosProyectos));
            renderizarTabla(todosLosProyectos);
            bootstrap.Modal.getInstance(modalElemento).hide();
            return;
        }

        boton.disabled = false;
        boton.textContent = "Eliminar";
        error.textContent = (result && result.mensaje) || "Error al eliminar el proyecto.";
        error.classList.remove("d-none");
    });
}

// Devuelve el badge visual que representa si un proyecto esta activo o inactivo.
function obtenerBadgeEstado(activo) {
    const estaActivo = activo === true || activo === "true";
    if (estaActivo) {
        return '<span class="badge-estado badge-activo">Activo</span>';
    }

    return '<span class="badge-estado badge-inactivo">Inactivo</span>';
}

// Convierte la fecha del proyecto a un formato corto para la tabla.
function formatearFecha(valor) {
    if (!valor) {
        return "Sin fecha";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        const [year, month, day] = valor.split("-");
        return `${day}/${month}/${year}`;
    }

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
        return "Sin fecha";
    }

    const day = String(fecha.getDate()).padStart(2, "0");
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const year = fecha.getFullYear();
    return `${day}/${month}/${year}`;
}

// Escapa texto para reutilizarlo con seguridad dentro de atributos o eventos inline.
function escaparTexto(texto) {
    return String(texto)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");
}

// Escapa texto para insertarlo de forma segura dentro de HTML.
function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
