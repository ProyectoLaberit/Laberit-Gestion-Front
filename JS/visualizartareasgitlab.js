let tareasGitlab = [];
let filtroGitlabActual = "validas";
let paginaGitlabActual = 1;
let gitlabPorPagina = 10;
let issueEditandoId = null;

// Inicializa la pantalla de control de tareas importadas desde GitLab.
window.onload = async function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    cargarBreadcrumbGitlab();
    await cargarTareasGitlab();
    setFiltroGitlab("validas");

    document.addEventListener("keydown", manejarTeclasModalIssue);
};

// Rellena la ruta superior con el contexto que ya usa la pantalla de tareas.
function cargarBreadcrumbGitlab() {
    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoId = localStorage.getItem("proyectoId");
    const departamento = obtenerDepartamentoGitlabActual();
    const proyecto = proyectos.find(p => String(p.id) === String(proyectoId));
    const nombreProyecto = proyecto ? proyecto.nombre : "Proyecto";

    document.getElementById("bc-proyecto").innerText = nombreProyecto;
    document.getElementById("bc-fase").innerText = localStorage.getItem("faseSeleccionada") || "Fase";
    document.getElementById("bc-subfase").innerText = localStorage.getItem("subfaseSeleccionada") || "Subfase";
    document.getElementById("bc-tarea").innerText = localStorage.getItem("nombreTarea") || "Tarea";
    document.getElementById("gitlab-proyecto").innerText = departamento
        ? `${nombreProyecto} / ${departamento}`
        : nombreProyecto;
}

// Carga todas las tareas registradas de GitLab para el proyecto actual.
async function cargarTareasGitlab() {
    const proyectoId = localStorage.getItem("proyectoId");
    const departamento = obtenerDepartamentoGitlabActual();

    if (!proyectoId) {
        mostrarErrorGitlab("Falta el proyecto actual. Vuelve atras y entra de nuevo.");
        return;
    }

    const btnSincronizar = document.getElementById("btn-sincronizar-gitlab");
    if (btnSincronizar && typeof esAdmin === "function" && !esAdmin()) {
        btnSincronizar.style.display = "none";
    }

    setEstadoCargaGitlab("Cargando tareas de GitLab...");

    const endpoint = departamento
        ? `/gitlab/vinculadas/departamento/${encodeURIComponent(proyectoId)}/${encodeURIComponent(departamento)}`
        : `/gitlab/vinculadas/todas/${encodeURIComponent(proyectoId)}`;
    const result = await peticionSegura(endpoint);
    const listaTareas = extraerListaTareasGitlab(result);

    if (!Array.isArray(listaTareas)) {
        tareasGitlab = [];
        actualizarEstadisticasGitlab();
        mostrarErrorGitlab((result && result.mensaje) || "No se pudieron cargar las tareas de GitLab.");
        return;
    }

    tareasGitlab = listaTareas.map(normalizarTareaGitlab);
    paginaGitlabActual = 1;
    actualizarEstadisticasGitlab();
    actualizarEstadoFiltroGitlab(departamento
        ? `Mostrando tareas de GitLab del departamento ${departamento}.`
        : "Mostrando tareas registradas en GitLab.");
    renderPaginaGitlab();
}

// Recupera el departamento enviado desde paginatareas para filtrar la consulta.
function obtenerDepartamentoGitlabActual() {
    return (localStorage.getItem("nombreDepartamentoGitlabVis") || "").trim();
}

// Soporta tanto ApiResponse como la lista directa que devuelve el endpoint por departamento.
function extraerListaTareasGitlab(result) {
    if (Array.isArray(result)) {
        return result;
    }

    if (result && result.success && Array.isArray(result.data)) {
        return result.data;
    }

    return null;
}

// Lanza la sincronizacion contra GitLab y recarga la tabla local al terminar.
async function sincronizarGitLab() {
    const proyectoId = localStorage.getItem("proyectoId");
    const btn = document.getElementById("btn-sincronizar-gitlab");

    if (!proyectoId) {
        alert("No se ha encontrado el proyecto actual.");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Sincronizando...";
    }

    actualizarEstadoFiltroGitlab("Importando tareas desde GitLab...");

    try {
        const result = await peticionSegura(`/gitlab/sincronizar/${proyectoId}`, {
            method: "GET"
        });

        await cargarTareasGitlab();
        actualizarEstadoFiltroGitlab((result && result.mensaje) || "Sincronizacion de GitLab completada.");
    } catch (error) {
        console.error("Error al sincronizar GitLab:", error);
        actualizarEstadoFiltroGitlab("Error al sincronizar tareas de GitLab.");
        alert("No se pudieron sincronizar las tareas de GitLab.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Sincronizar GitLab";
        }
    }
}

// Ajusta la estructura recibida desde el backend para evitar diferencias de nombres.
function normalizarTareaGitlab(tarea) {
    return {
        id: tarea.id,
        issueId: tarea.issueId || tarea.id || "",
        numeroGitLab: tarea.numeroGitLab ?? tarea.numeroGitlab ?? tarea.numeroGit ?? "",
        titulo: tarea.titulo || tarea.title || "Sin titulo",
        estado: tarea.estado || "Sin estado",
        valida: tarea.valida === true || tarea.vinculada === true
    };
}

// Cambia el filtro activo entre validas, invalidas y todas.
function setFiltroGitlab(filtro) {
    filtroGitlabActual = filtro;
    paginaGitlabActual = 1;

    document.querySelectorAll(".filter-tab").forEach(boton => {
        boton.classList.remove("active", "active-correctas", "active-incorrectas");
    });

    if (filtro === "validas") {
        document.getElementById("tab-validas").classList.add("active", "active-correctas");
    }

    if (filtro === "invalidas") {
        document.getElementById("tab-invalidas").classList.add("active", "active-incorrectas");
    }

    if (filtro === "todas") {
        document.getElementById("tab-todas").classList.add("active");
    }

    renderPaginaGitlab();
}

// Recalcula contadores y tarjetas superiores.
function actualizarEstadisticasGitlab() {
    const total = tareasGitlab.length;
    const validas = tareasGitlab.filter(t => t.valida).length;
    const invalidas = total - validas;
    const abiertas = tareasGitlab.filter(t => esEstadoAbierto(t.estado)).length;
    const cerradas = tareasGitlab.filter(t => esEstadoCerrado(t.estado)).length;
    const pct = total > 0 ? Math.round((validas / total) * 100) : 0;
    const pctInvalidas = total > 0 ? 100 - pct : 0;

    document.getElementById("stat-validas").innerText = validas;
    document.getElementById("stat-invalidas").innerText = invalidas;
    document.getElementById("stat-abiertas").innerText = abiertas;
    document.getElementById("stat-cerradas").innerText = cerradas;
    document.getElementById("stat-pct-validas").innerText = `${pct}%`;
    document.getElementById("stat-pct-invalidas").innerText = `${pctInvalidas}%`;
    document.getElementById("cnt-validas").innerText = validas;
    document.getElementById("cnt-invalidas").innerText = invalidas;
    document.getElementById("cnt-todas").innerText = total;
    document.getElementById("resumen-gitlab").innerText = `${validas} / ${total} tareas validas`;
    document.getElementById("pct-text").innerText = `${pct}%`;

    const circunferencia = 2 * Math.PI * 30;
    const offset = circunferencia - (pct / 100) * circunferencia;
    document.getElementById("ring-fill").style.strokeDashoffset = offset;
}

// Aplica filtros, busqueda y paginacion antes de pintar la tabla.
function renderPaginaGitlab() {
    const busqueda = (document.getElementById("input-busqueda")?.value || "").toLowerCase().trim();
    const filtradas = tareasGitlab.filter(tarea => {
        if (filtroGitlabActual === "validas" && !tarea.valida) {
            return false;
        }

        if (filtroGitlabActual === "invalidas" && tarea.valida) {
            return false;
        }

        if (busqueda) {
            const texto = `${tarea.issueId} ${tarea.numeroGitLab} ${tarea.titulo} ${tarea.estado}`.toLowerCase();
            if (!texto.includes(busqueda)) {
                return false;
            }
        }

        return true;
    });

    const total = filtradas.length;
    const totalPaginas = Math.max(1, Math.ceil(total / gitlabPorPagina));

    if (paginaGitlabActual > totalPaginas) {
        paginaGitlabActual = totalPaginas;
    }

    const inicio = (paginaGitlabActual - 1) * gitlabPorPagina;
    const pagina = filtradas.slice(inicio, inicio + gitlabPorPagina);

    renderTablaGitlab(pagina, inicio, total);
    renderPaginacionGitlab(total, totalPaginas);
}

// Pinta las filas de GitLab en la tabla principal.
function renderTablaGitlab(filas, inicio, total) {
    const tbody = document.getElementById("tabla-gitlab");

    if (!filas.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay tareas de GitLab que coincidan.</td></tr>`;
        document.getElementById("pag-info").innerText = "Sin resultados";
        return;
    }

    tbody.innerHTML = filas.map(tarea => {
        const estadoDot = tarea.valida ? renderEstadoDot(true) : renderEstadoDot(false);
        const issue = tarea.numeroGitLab ? `#${escaparHtml(tarea.numeroGitLab)}` : escaparHtml(tarea.issueId || "-");
        const claseEstado = obtenerClaseEstadoGitlab(tarea.estado);
        const textoEstado = formatearEstadoGitlab(tarea.estado);
        const vinculacion = tarea.valida ? "Valida" : "Pendiente";
        const claseVinculacion = tarea.valida ? "text-success fw-semibold" : "text-danger fw-semibold";
        const botonEditar = typeof esAdmin === "function" && esAdmin()
            ? `<button class="btn btn-sm btn-outline-secondary" onclick="editarNombreIssue('${escaparParaJs(tarea.issueId)}')">Editar</button>`
            : "-";

        return `
            <tr>
                <td>${estadoDot}</td>
                <td class="fw-semibold">${issue}</td>
                <td class="gitlab-issue-title">${escaparHtml(tarea.titulo)}</td>
                <td><span class="gitlab-state-badge ${claseEstado}">${escaparHtml(textoEstado)}</span></td>
                <td class="${claseVinculacion}">${vinculacion}</td>
                <td>${botonEditar}</td>
            </tr>
        `;
    }).join("");

    document.getElementById("pag-info").innerText =
        `Mostrando ${inicio + 1} a ${Math.min(inicio + filas.length, total)} de ${total} tareas`;
}

// Genera el icono circular de estado de vinculacion.
function renderEstadoDot(esValida) {
    return esValida
        ? `
            <div class="estado-dot estado-ok">
                <svg width="13" height="13" fill="none" stroke="#16a34a" stroke-width="2.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="9 12 11 14 15 10"></polyline>
                </svg>
            </div>
        `
        : `
            <div class="estado-dot estado-err">
                <svg width="13" height="13" fill="none" stroke="#dc2626" stroke-width="2.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            </div>
        `;
}

// Genera los botones de paginacion.
function renderPaginacionGitlab(total, totalPaginas) {
    const contenedor = document.getElementById("pag-btns");
    contenedor.innerHTML = "";

    const prev = crearPagBtnGitlab("<", paginaGitlabActual === 1, () => {
        paginaGitlabActual--;
        renderPaginaGitlab();
    });
    contenedor.appendChild(prev);

    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        const btn = crearPagBtnGitlab(pagina, false, () => {
            paginaGitlabActual = pagina;
            renderPaginaGitlab();
        });

        if (pagina === paginaGitlabActual) {
            btn.classList.add("active");
        }

        contenedor.appendChild(btn);
    }

    const next = crearPagBtnGitlab(">", paginaGitlabActual === totalPaginas || total === 0, () => {
        paginaGitlabActual++;
        renderPaginaGitlab();
    });
    contenedor.appendChild(next);
}

// Crea un boton de paginacion reutilizable.
function crearPagBtnGitlab(label, disabled, onClick) {
    const btn = document.createElement("button");
    btn.className = "pag-btn";
    btn.textContent = label;
    btn.disabled = disabled;

    if (!disabled) {
        btn.addEventListener("click", onClick);
    }

    return btn;
}

// Muestra un estado de carga temporal en la tabla.
function setEstadoCargaGitlab(texto) {
    document.getElementById("tabla-gitlab").innerHTML =
        `<tr><td colspan="6" class="empty-state"><div class="spinner-border spinner-border-sm me-2"></div>${texto}</td></tr>`;
}

// Muestra errores de carga en la tabla principal.
function mostrarErrorGitlab(mensaje) {
    document.getElementById("tabla-gitlab").innerHTML =
        `<tr><td colspan="6" class="empty-state text-danger">${escaparHtml(mensaje)}</td></tr>`;
    document.getElementById("pag-info").innerText = "Sin resultados";
    document.getElementById("pag-btns").innerHTML = "";
    actualizarEstadoFiltroGitlab(mensaje);
}

// Abre el modal para editar el titulo local de una issue.
function editarNombreIssue(issueId) {
    const tarea = tareasGitlab.find(item => String(item.issueId) === String(issueId));
    const overlay = document.getElementById("gitlab-edit-modal-overlay");
    const input = document.getElementById("gitlab-edit-title");
    const botonGuardar = document.getElementById("gitlab-edit-save-btn");

    if (!tarea || !overlay || !input || !botonGuardar) {
        alert("No se pudo abrir el editor de la issue.");
        return;
    }

    issueEditandoId = tarea.issueId;
    input.value = tarea.titulo || "";
    botonGuardar.disabled = false;
    botonGuardar.textContent = "Guardar";
    overlay.classList.add("show");

    setTimeout(() => {
        input.focus();
        input.select();
    }, 0);
}

// Cierra el modal de edicion y limpia el estado temporal.
function cerrarModalEdicionIssue(event) {
    if (event && event.target && event.target.id !== "gitlab-edit-modal-overlay") {
        return;
    }

    const overlay = document.getElementById("gitlab-edit-modal-overlay");
    const input = document.getElementById("gitlab-edit-title");
    const botonGuardar = document.getElementById("gitlab-edit-save-btn");

    if (overlay) {
        overlay.classList.remove("show");
    }

    if (input) {
        input.value = "";
    }

    if (botonGuardar) {
        botonGuardar.disabled = false;
        botonGuardar.textContent = "Guardar";
    }

    issueEditandoId = null;
}

// Guarda el nuevo titulo de la issue en backend y actualiza la fila en pantalla.
async function guardarNombreIssue() {
    if (!issueEditandoId) {
        return;
    }

    const input = document.getElementById("gitlab-edit-title");
    const botonGuardar = document.getElementById("gitlab-edit-save-btn");
    const nuevoTitulo = input ? input.value.trim() : "";

    if (!nuevoTitulo) {
        alert("El nombre de la issue no puede estar vacio.");
        input?.focus();
        return;
    }

    if (botonGuardar) {
        botonGuardar.disabled = true;
        botonGuardar.textContent = "Guardando...";
    }

    const result = await peticionSegura(`/gitlab/issue/${encodeURIComponent(issueEditandoId)}/titulo`, {
        method: "PUT",
        body: JSON.stringify({ titulo: nuevoTitulo })
    });

    if (result && result.success) {
        const tarea = tareasGitlab.find(item => String(item.issueId) === String(issueEditandoId));
        if (tarea) {
            tarea.titulo = nuevoTitulo;
        }

        renderPaginaGitlab();
        cerrarModalEdicionIssue();
        actualizarEstadoFiltroGitlab("Titulo de issue actualizado correctamente.");
        return;
    }

    if (botonGuardar) {
        botonGuardar.disabled = false;
        botonGuardar.textContent = "Guardar";
    }

    alert((result && result.mensaje) || "No se pudo actualizar el titulo de la issue.");
}

// Gestiona Enter y Escape cuando el modal de edicion esta abierto.
function manejarTeclasModalIssue(event) {
    const overlay = document.getElementById("gitlab-edit-modal-overlay");
    if (!overlay || !overlay.classList.contains("show")) {
        return;
    }

    if (event.key === "Escape") {
        cerrarModalEdicionIssue();
    }

    if (event.key === "Enter") {
        guardarNombreIssue();
    }
}

// Actualiza el texto informativo bajo las acciones de la vista.
function actualizarEstadoFiltroGitlab(mensaje) {
    const estado = document.getElementById("estado-filtro");
    const resumenEstado = document.getElementById("resumen-estado-gitlab");

    if (estado) {
        estado.innerText = mensaje;
    }

    if (resumenEstado) {
        resumenEstado.innerText = mensaje;
    }
}

// Traduce el estado tecnico de GitLab a una clase visual.
function obtenerClaseEstadoGitlab(estado) {
    const normalizado = String(estado || "").trim().toLowerCase();

    if (esEstadoAbierto(normalizado)) {
        return "gitlab-state-opened";
    }

    if (esEstadoCerrado(normalizado)) {
        return "gitlab-state-closed";
    }

    return "gitlab-state-other";
}

// Formatea el estado de GitLab para mostrarlo en la tabla.
function formatearEstadoGitlab(estado) {
    const normalizado = String(estado || "").trim().toLowerCase();

    if (esEstadoAbierto(normalizado)) {
        return "Abierta";
    }

    if (esEstadoCerrado(normalizado)) {
        return "Cerrada";
    }

    return normalizado ? normalizado.replaceAll("_", " ") : "Sin estado";
}

// Comprueba si GitLab marca la issue como abierta.
function esEstadoAbierto(estado) {
    const normalizado = String(estado || "").trim().toLowerCase();
    return normalizado === "opened" || normalizado === "open";
}

// Comprueba si GitLab marca la issue como cerrada.
function esEstadoCerrado(estado) {
    const normalizado = String(estado || "").trim().toLowerCase();
    return normalizado === "closed" || normalizado === "close";
}

// Escapa texto para insertarlo de forma segura dentro de HTML.
function escaparHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

// Escapa texto para insertarlo de forma segura en codigo JavaScript inline.
function escaparParaJs(valor) {
    return String(valor || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
