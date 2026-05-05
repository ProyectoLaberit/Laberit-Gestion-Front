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

    // Cargar historial de excels en el desplegable
    await cargarHistorialExcels(proyectoId);

    // Cargar fases del excel vigente (por defecto)
    await cargarSubfases(proyectoId);

    // Buscador
    document.getElementById('input-busqueda').addEventListener('input', (e) => {
        renderizarTodo(e.target.value, estructuraActual, idsActuales);
    });
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
            const onclickArgs = [
                JSON.stringify(fase),
                JSON.stringify(sub),
                JSON.stringify(String(ids[sub]))
            ].join(", ");

            htmlContent += `
                <div class="col-12 col-md-6 col-lg-3">
                    <div class="card subfase-card p-3 shadow-sm h-100" onclick='irASubfase(${onclickArgs})'>
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
function irASubfase(nombreFase, nombreSubfase, idSubfase) {
    localStorage.setItem("faseSeleccionada", nombreFase);
    localStorage.setItem("idSubfase", idSubfase);
    localStorage.setItem("subfaseSeleccionada", nombreSubfase);
    window.location.href = "subfase.html";
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
