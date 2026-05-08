window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    cargarPaginaDetalles();
};

// ── Estado global ─────────────────────────────────────────────────────────────
let estructuraActual = {};
let idsActuales = {};

// ── Carga inicial ─────────────────────────────────────────────────────────────
async function cargarPaginaDetalles() {
    const proyectoId = localStorage.getItem("proyectoId");

    // Nombre del proyecto
    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoActual = proyectos.find(p => String(p.id) === String(proyectoId));
    document.getElementById('proyecto-nombre-display').innerText =
        proyectoActual ? proyectoActual.nombre : "Proyecto " + proyectoId;

    // Mostrar última sincronización si existe
    const keySync = `ultima-sync-${proyectoId}`;
    const ultimaSync = localStorage.getItem(keySync);
    if (ultimaSync) {
        mostrarUltimaSync(ultimaSync);
    }

    // Mostrar botones solo para SuperAdministrador
    if (esSuperAdmin()) {
        document.getElementById("botones-admin").style.display = "flex";
    }

    // Cargar historial de excels en el desplegable
    await cargarHistorialExcels(proyectoId);

    // Cargar fases del excel vigente (por defecto)
    await cargarSubfases(proyectoId);

    // Buscador
    document.getElementById('input-busqueda').addEventListener('input', (e) => {
        renderizarTodo(e.target.value, estructuraActual, idsActuales);
    });
}

// ── Sincronización ────────────────────────────────────────────────────────────
async function sincronizar() {
    const proyectoId = localStorage.getItem("proyectoId");
    const btn  = document.getElementById("btn-sincronizar");
    const icon = document.getElementById("icon-sync");
    const texto = document.getElementById("texto-sincronizar");

    // Estado cargando
    btn.disabled = true;
    texto.textContent = "Sincronizando...";
    icon.style.animation = "spin 1s linear infinite";
    icon.style.transformOrigin = "center";

    const result = await peticionSegura(`/clockify/sincronizar/${proyectoId}`, {
        method: "POST"
    });

    // Restaurar botón
    btn.disabled = false;
    texto.textContent = "Sincronizar";
    icon.style.animation = "";

    if (result && result.success) {
        const ahora = new Date().toISOString();
        localStorage.setItem(`ultima-sync-${proyectoId}`, ahora);
        mostrarUltimaSync(ahora);
        mostrarToast("Sincronización completada correctamente.", "success");

        // Registrar en auditoría
        auditService && auditService.registrar &&
            auditService.registrar("SINCRONIZACION", `Proyecto ${proyectoId} sincronizado.`, parseInt(proyectoId));
    } else {
        mostrarToast((result && result.mensaje) || "Error al sincronizar.", "error");
    }
}

function mostrarUltimaSync(isoString) {
    const fecha = new Date(isoString);
    const formateada = fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
        + " " + fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    document.getElementById("fecha-ultima-sync").textContent = formateada;
    document.getElementById("ultima-sincronizacion").style.display = "inline";
}

function mostrarToast(mensaje, tipo) {
    // Eliminar toast anterior si existe
    const anterior = document.getElementById("toast-sync");
    if (anterior) anterior.remove();

    const color   = tipo === "success" ? "#166534" : "#991b1b";
    const bg      = tipo === "success" ? "#f0fdf4" : "#fef2f2";
    const borde   = tipo === "success" ? "#bbf7d0" : "#fecaca";
    const icono   = tipo === "success"
        ? `<polyline points="20 6 9 17 4 12"/>`
        : `<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>`;

    const toast = document.createElement("div");
    toast.id = "toast-sync";
    toast.style.cssText = `
        position:fixed; bottom:24px; right:24px; z-index:9999;
        background:${bg}; border:1px solid ${borde}; color:${color};
        padding:12px 18px; border-radius:10px; font-size:0.875rem;
        display:flex; align-items:center; gap:10px;
        box-shadow:0 4px 12px rgba(0,0,0,0.1);
        animation: slideIn .25s ease;
    `;
    toast.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="${color}" stroke-width="2" viewBox="0 0 24 24">${icono}</svg>
        <span>${mensaje}</span>`;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}


// ── Historial de excels ───────────────────────────────────────────────────────
async function cargarHistorialExcels(proyectoId) {
    const select = document.getElementById('select-historial-excel');
    select.innerHTML = '<option value="">Cargando historial...</option>';

    const result = await peticionSegura(`/fases/historial/${proyectoId}`);

    if (!result || !result.success || !result.data || result.data.length === 0) {
        select.innerHTML = '<option value="">Sin historial</option>';
        return;
    }

    const excels = result.data;
    select.innerHTML = '';

    excels.forEach((excel, index) => {
        const fecha = excel.fechaSubida
            ? new Date(excel.fechaSubida).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'Fecha desconocida';

        const label = excel.vigente
            ? ` ${fecha} — ${excel.usuarioNombre}`
            : `${fecha} — ${excel.usuarioNombre}`;

        const opt = document.createElement('option');
        opt.value = excel.idExcel;
        opt.textContent = label;
        if (excel.vigente) {
            opt.selected = true;
            opt.style.fontWeight = 'bold';
        }
        select.appendChild(opt);
    });
}

// ── Cambio de excel en el desplegable ─────────────────────────────────────────
async function onCambioExcel(select) {
    const idExcel = select.value;
    if (!idExcel) return;

    const contenedor = document.getElementById('contenedor-fases');
    contenedor.innerHTML = `
        <div class="text-center py-5 text-muted">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Cargando fases...
        </div>`;

    const result = await peticionSegura(`/fases/por-excel/${idExcel}`);

    if (!result || !result.success) {
        contenedor.innerHTML = `<p class="text-danger text-center py-4">Error al cargar las fases de este excel.</p>`;
        return;
    }

    const fases = result.data;
    procesarYRenderizar(fases);
}

// ── Carga de subfases del excel vigente ───────────────────────────────────────
async function cargarSubfases(proyectoId) {
    const result = await peticionSegura(`/fases/${proyectoId}`);

    if (!result || !result.success) {
        console.error("No se pudieron cargar las fases.");
        return;
    }

    procesarYRenderizar(result.data);
}

// ── Convierte respuesta de la API en estructura y renderiza ───────────────────
function procesarYRenderizar(fases) {
    const estructura = {};
    const ids = {};

    fases.forEach(p => {
        estructura[p.nombre] = p.subfases.map(s => s.nombre);
        p.subfases.forEach(s => { ids[s.nombre] = s.id; });
    });

    estructuraActual = estructura;
    idsActuales = ids;

    // Limpiar buscador al cambiar de excel
    document.getElementById('input-busqueda').value = '';

    renderizarTodo("", estructura, ids);
}

// ── Renderizado ───────────────────────────────────────────────────────────────
function renderizarTodo(filtro = "", estr, ids) {
    const contenedor = document.getElementById('contenedor-fases');
    contenedor.innerHTML = "";

    const filtroNormalizado = filtro.toLowerCase().trim();

    let hayResultados = false;

    for (const fase in estr) {
        const subfases = estr[fase];
        const subfasesFiltradas = subfases.filter(sub =>
            sub.toLowerCase().includes(filtroNormalizado)
        );

        if (subfasesFiltradas.length === 0) continue;
        hayResultados = true;

        const seccion = document.createElement('section');
        seccion.className = "phase-section";

        let htmlContent = `<h3 class="phase-header h5">${fase}</h3>`;
        htmlContent += `<div class="row g-3">`;

        subfasesFiltradas.forEach(sub => {
            htmlContent += `
                <div class="col-12 col-md-6 col-lg-3">
                    <div class="card subfase-card p-3 shadow-sm h-100" onclick="irASubfase('${sub}, ${ids[sub]}')">
                        <div class="fw-bold text-dark">${sub}</div>
                        <div class="text-muted small mt-2">Haga clic para ver tareas</div>
                    </div>
                </div>
            `;
        });

        htmlContent += `</div>`;
        seccion.innerHTML = htmlContent;
        contenedor.appendChild(seccion);
    }

    if (!hayResultados) {
        contenedor.innerHTML = `
            <div class="text-center py-5 text-muted">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="mb-3 opacity-50">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <p class="mb-0">No se encontraron subfases${filtroNormalizado ? ` para "<strong>${filtroNormalizado}</strong>"` : ''}.</p>
            </div>`;
    }
}

// ── Navegación ────────────────────────────────────────────────────────────────
function irASubfase(nombreSubfase) {
    const partes = nombreSubfase.split(',');
    localStorage.setItem("idSubfase", partes[1]);
    localStorage.setItem("subfaseSeleccionada", partes[0]);
    window.location.href = "subfase.html";
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
