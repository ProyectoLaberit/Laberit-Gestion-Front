// ── Estado global ─────────────────────────────────────────────────────────────
let todasLasImputaciones = [];
let filtroActual  = "todas";
let paginaActual  = 1;
let porPagina     = 10;

window.onload = async function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    cargarBreadcrumb();
    await cargarImputaciones();
};

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function cargarBreadcrumb() {
    const proyectos    = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoId   = localStorage.getItem("proyectoId");
    const proyecto     = proyectos.find(p => String(p.id) === String(proyectoId));
    const nombreDept   = localStorage.getItem("nombreDepartamentoVis") || "Departamento";

    document.getElementById("bc-proyecto").innerText = proyecto ? proyecto.nombre : "Proyecto";
    document.getElementById("bc-fase").innerText     = localStorage.getItem("faseSeleccionada")    || "Fase";
    document.getElementById("bc-subfase").innerText  = localStorage.getItem("subfaseSeleccionada") || "Subfase";
    document.getElementById("bc-tarea").innerText    = localStorage.getItem("nombreTarea")         || "Tarea";
    document.getElementById("bc-dept").innerText     = nombreDept;
    document.getElementById("dept-nombre").innerText = nombreDept;
}

// ── Carga de datos ────────────────────────────────────────────────────────────
async function cargarImputaciones() {
    const proyectoId         = localStorage.getItem("proyectoId");
    const idDetalleEstimacion = localStorage.getItem("idDetalleEstimacionVis");
    const idDepartamento      = localStorage.getItem("idDepartamentoVis");

    if (!proyectoId || !idDetalleEstimacion || !idDepartamento) {
        document.getElementById("tabla-tareas").innerHTML =
            `<tr><td colspan="8" class="empty-state text-danger">Faltan datos de navegación. Vuelve atrás.</td></tr>`;
        return;
    }

    // Endpoint real: GET /api/imputaciones/departamento/{idProyecto}/{idDetalleEstimacion}/{idDepartamento}
    const result = await peticionSegura(
        `/imputaciones/departamento/${proyectoId}/${idDetalleEstimacion}/${idDepartamento}`
    );

    if (!result || !result.success) {
        document.getElementById("tabla-tareas").innerHTML =
            `<tr><td colspan="8" class="empty-state text-danger">Error al cargar las tareas.</td></tr>`;
        return;
    }

    todasLasImputaciones = result.data || [];
    actualizarEstadisticas();
    renderPagina();
}

// ── Estadísticas + aro ────────────────────────────────────────────────────────
function actualizarEstadisticas() {
    const total      = todasLasImputaciones.length;
    const correctas  = todasLasImputaciones.filter(i => i.valida).length;
    const incorrectas = total - correctas;
    const pct        = total > 0 ? Math.round((correctas / total) * 100) : 0;

    const tiempoTotal   = todasLasImputaciones.reduce((s, i) => s + (i.horasTrabajadas || 0), 0);
    const sinAsociar    = todasLasImputaciones.filter(i => !i.valida).reduce((s, i) => s + (i.horasTrabajadas || 0), 0);

    document.getElementById("stat-correctas").innerText   = correctas;
    document.getElementById("stat-incorrectas").innerText = incorrectas;
    document.getElementById("stat-pct-ok").innerText      = pct + "%";
    document.getElementById("stat-pct-err").innerText     = (100 - pct) + "%";
    document.getElementById("stat-tiempo-total").innerText = redondearH(tiempoTotal);
    document.getElementById("stat-sin-asociar").innerText  = redondearH(sinAsociar);
    document.getElementById("resumen-tareas").innerText    = `${correctas} / ${total} tareas correctas`;
    document.getElementById("resumen-sin-asociar").innerText = `${redondearH(sinAsociar)} tiempo sin asociar`;
    document.getElementById("pct-text").innerText          = pct + "%";

    // Actualizar contadores de tabs
    document.getElementById("cnt-todas").innerText       = total;
    document.getElementById("cnt-correctas").innerText   = correctas;
    document.getElementById("cnt-incorrectas").innerText = incorrectas;

    // Aro SVG
    const circunferencia = 2 * Math.PI * 30; // r=30 → 188.5
    const offset = circunferencia - (pct / 100) * circunferencia;
    document.getElementById("ring-fill").style.strokeDashoffset = offset;
}

function redondearH(h) {
    if (!h || h === 0) return "0h";
    const horas   = Math.floor(h);
    const minutos = Math.round((h - horas) * 60);
    return minutos > 0 ? `${horas}h ${minutos}m` : `${horas}h`;
}

// ── Filtro de tabs ────────────────────────────────────────────────────────────
function setFiltro(filtro) {
    filtroActual = filtro;
    paginaActual = 1;

    document.querySelectorAll(".filter-tab").forEach(b => {
        b.classList.remove("active", "active-correctas", "active-incorrectas");
    });

    if (filtro === "todas")        document.getElementById("tab-todas").classList.add("active");
    if (filtro === "correctas")    document.getElementById("tab-correctas").classList.add("active", "active-correctas");
    if (filtro === "incorrectas")  document.getElementById("tab-incorrectas").classList.add("active", "active-incorrectas");

    renderPagina();
}

// ── Render principal ──────────────────────────────────────────────────────────
function renderPagina() {
    const busqueda = (document.getElementById("input-busqueda")?.value || "").toLowerCase().trim();

    let filtradas = todasLasImputaciones.filter(i => {
        if (filtroActual === "correctas"   && !i.valida) return false;
        if (filtroActual === "incorrectas" &&  i.valida) return false;
        if (busqueda) {
            const texto = `${i.nombreTarea || ""} ${i.descripcionOriginal || ""} ${i.subfaseExtraida || ""}`.toLowerCase();
            if (!texto.includes(busqueda)) return false;
        }
        return true;
    });

    const total    = filtradas.length;
    const totalPag = Math.max(1, Math.ceil(total / porPagina));
    if (paginaActual > totalPag) paginaActual = totalPag;

    const inicio = (paginaActual - 1) * porPagina;
    const pagina = filtradas.slice(inicio, inicio + porPagina);

    renderTabla(pagina, inicio, total);
    renderPaginacion(total, totalPag);
}

function renderTabla(filas, inicio, total) {
    const tbody = document.getElementById("tabla-tareas");

    if (filas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay tareas que coincidan.</td></tr>`;
        return;
    }

    tbody.innerHTML = filas.map(i => {
        const esValida = i.valida === true;
        const estadoDot = esValida
            ? `<div class="estado-dot estado-ok">
                <svg width="13" height="13" fill="none" stroke="#16a34a" stroke-width="2.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
                </svg></div>`
            : `<div class="estado-dot estado-err">
                <svg width="13" height="13" fill="none" stroke="#dc2626" stroke-width="2.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg></div>`;

        const fecha   = i.fecha ? new Date(i.fecha).toLocaleDateString("es-ES") : "—";
        const hIni    = i.horaInicio  ? i.horaInicio  : "—";
        const hFin    = i.horaFin     ? i.horaFin     : "—";
        const hTotal  = redondearH(i.horasTrabajadas);
        const nombre  = i.nombreTarea || i.descripcionOriginal || "—";
        const subfase = i.subfaseExtraida || "—";

        // Botones de acción
        let acciones;
        if (esValida) {
            acciones = `
                <button class="btn btn-sm btn-danger" onclick="eliminarImputacion(${i.idImputacionClockify}, this)">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="me-1">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                    Eliminar
                </button>`;
        } else {
            acciones = `
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-secondary" onclick="editarImputacion(${i.idImputacionClockify})">Editar</button>
                    <button class="btn btn-sm btn-outline-success" onclick="marcarValida(${i.idImputacionClockify}, this)">Marcar válida</button>
                </div>`;
        }

        return `
        <tr id="row-${i.idImputacionClockify}">
            <td>${estadoDot}</td>
            <td class="fw-semibold">${nombre}</td>
            <td class="text-muted">${subfase}</td>
            <td class="text-muted">${fecha}</td>
            <td>${hIni}</td>
            <td>${hFin}</td>
            <td class="fw-semibold">${hTotal}</td>
            <td>${acciones}</td>
        </tr>`;
    }).join("");

    document.getElementById("pag-info").innerText =
        `Mostrando ${inicio + 1} a ${Math.min(inicio + filas.length, total)} de ${total} tareas`;
}

function renderPaginacion(total, totalPag) {
    const cont = document.getElementById("pag-btns");
    cont.innerHTML = "";

    // Anterior
    const prev = crearPagBtn("‹", paginaActual === 1, () => { paginaActual--; renderPagina(); });
    cont.appendChild(prev);

    // Páginas
    for (let p = 1; p <= totalPag; p++) {
        if (totalPag > 7 && p > 3 && p < totalPag - 1 && Math.abs(p - paginaActual) > 1) {
            if (p === 4) cont.appendChild(crearPagSpan("…"));
            continue;
        }
        const btn = crearPagBtn(p, false, () => { paginaActual = p; renderPagina(); });
        if (p === paginaActual) btn.classList.add("active");
        cont.appendChild(btn);
    }

    // Siguiente
    const next = crearPagBtn("›", paginaActual === totalPag, () => { paginaActual++; renderPagina(); });
    cont.appendChild(next);
}

function crearPagBtn(label, disabled, onClick) {
    const btn = document.createElement("button");
    btn.className = "pag-btn";
    btn.textContent = label;
    btn.disabled = disabled;
    if (!disabled) btn.addEventListener("click", onClick);
    return btn;
}

function crearPagSpan(txt) {
    const s = document.createElement("span");
    s.className = "pag-btn";
    s.style.cursor = "default";
    s.textContent = txt;
    return s;
}

function perPageChange() {
    porPagina = parseInt(document.getElementById("per-page").value);
    paginaActual = 1;
    renderPagina();
}

// ── Acciones ──────────────────────────────────────────────────────────────────
async function marcarValida(id, btn) {
    btn.disabled = true;
    btn.textContent = "Guardando...";

    // PUT /api/imputaciones/vincular/{idImputacion}/{idDetalleEstimacion}
    const idDetalleEstimacion = localStorage.getItem("idDetalleEstimacionVis");
    const result = await peticionSegura(
        `/imputaciones/vincular/${id}/${idDetalleEstimacion}`,
        { method: "PUT" }
    );

    if (result && result.success) {
        const imp = todasLasImputaciones.find(i => i.idImputacionClockify === id);
        if (imp) imp.valida = true;
        actualizarEstadisticas();
        renderPagina();
    } else {
        btn.disabled = false;
        btn.textContent = "Marcar válida";
        alert((result && result.mensaje) || "Error al marcar como válida.");
    }
}

async function eliminarImputacion(id, btn) {
    if (!confirm("¿Seguro que quieres eliminar esta imputación? Esta acción no se puede deshacer.")) return;

    btn.disabled = true;
    btn.textContent = "Eliminando...";

    // No hay endpoint DELETE en ImputacionClockifyController, usamos el de clockify
    const result = await peticionSegura(`/clockify/imputaciones/${id}`, { method: "DELETE" });

    if (result && result.success) {
        todasLasImputaciones = todasLasImputaciones.filter(i => i.idImputacionClockify !== id);
        actualizarEstadisticas();
        renderPagina();
    } else {
        btn.disabled = false;
        btn.textContent = "Eliminar";
        alert((result && result.mensaje) || "Error al eliminar.");
    }
}

function editarImputacion(id) {
    localStorage.setItem("idImputacionEditar", id);
    // Aquí puedes navegar a una página de edición si la tienes
    alert("Edición de imputación #" + id + " (pendiente de implementar)");
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
