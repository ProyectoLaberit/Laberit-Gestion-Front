let todasLasImputaciones = [];
let filtroActual = "todas";
let paginaActual = 1;
let porPagina = 10;
let idImputacionEditando = null;
let subfasesPorFaseEdit = {};
let nombresFaseEdit = {};

// Centraliza el permiso de escritura sobre imputaciones para mantener empleados en solo lectura.
function puedeGestionarImputaciones() {
    return typeof esAdmin === "function" && esAdmin();
}

// Inicializa la pantalla, valida la sesion activa y carga el contexto
// principal necesario antes de que el usuario empiece a interactuar.
window.onload = async function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    cargarBreadcrumb();
    inicializarRangoFechas();
    configurarFiltrosAutomaticos();
    await cargarFasesYSubfasesEdit();
    await cargarImputaciones();
    setFiltro('todas');

    document.addEventListener("keydown", manejarTeclasModalEdicion);
};

// Recupera del almacenamiento local el contexto necesario para esta vista.
function obtenerContextoVista() {
    return {
        proyectoId: localStorage.getItem("proyectoId"),
        idTareaProyecto: localStorage.getItem("idTareaProyectoVis") || localStorage.getItem("idDetalleEstimacionVis"),
        idDepartamento: localStorage.getItem("idDepartamentoVis")
    };
}

// Rellena la ruta de navegacion con el contexto guardado en localStorage.
function cargarBreadcrumb() {
    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoId = localStorage.getItem("proyectoId");
    const proyecto = proyectos.find(p => String(p.id) === String(proyectoId));

    const nombreDept = localStorage.getItem("nombreDepartamentoVis") || "Departamento";

    document.getElementById("bc-proyecto").innerText = proyecto ? proyecto.nombre : "Proyecto";
    document.getElementById("bc-fase").innerText = localStorage.getItem("faseSeleccionada") || "Fase";
    document.getElementById("bc-subfase").innerText = localStorage.getItem("subfaseSeleccionada") || "Subfase";
    document.getElementById("bc-tarea").innerText = localStorage.getItem("nombreTarea") || "Tarea";
    document.getElementById("bc-dept").innerText = nombreDept;
    document.getElementById("dept-nombre").innerText = nombreDept;
}

// Inicializa el filtro de fechas con un rango por defecto de los ultimos 30 dias.
function inicializarRangoFechas() {
    const hoy = new Date();
    const hace30Dias = new Date();
    hace30Dias.setDate(hoy.getDate() - 30);

    const inputDesde = document.getElementById("fecha-desde");
    const inputHasta = document.getElementById("fecha-hasta");

    if (!inputDesde || !inputHasta) {
        return;
    }

    inputDesde.value = formatearFechaInput(hace30Dias);
    inputHasta.value = formatearFechaInput(hoy);
}

// Conecta los inputs de fecha para que el filtrado se recalcule automaticamente.
function configurarFiltrosAutomaticos() {
    const inputDesde = document.getElementById("fecha-desde");
    const inputHasta = document.getElementById("fecha-hasta");

    if (!inputDesde || !inputHasta) {
        return;
    }

// Reaplica el filtro por fechas cada vez que cambia alguno de los dos inputs.
    const aplicarFiltroAutomatico = async () => {
        inputDesde.max = inputHasta.value || "";
        inputHasta.min = inputDesde.value || "";

        if (!inputDesde.value || !inputHasta.value) {
            await cargarImputaciones();
            return;
        }

        if (inputDesde.value > inputHasta.value) {
            actualizarEstadoFiltro("La fecha desde no puede ser mayor que la fecha hasta.");
            return;
        }

        await filtrarPorFechas();
    };

    inputDesde.addEventListener("change", aplicarFiltroAutomatico);
    inputHasta.addEventListener("change", aplicarFiltroAutomatico);
}

// Convierte un objeto Date al formato que esperan los inputs de tipo date.
function formatearFechaInput(fecha) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// Carga las imputaciones del contexto actual y actualiza la tabla y sus metricas.
async function cargarImputaciones() {
    const { proyectoId, idTareaProyecto, idDepartamento } = obtenerContextoVista();

    // 1. Capturamos la subfase real directamente
    const subfaseReal = localStorage.getItem("subfaseSeleccionada") || "";

    if (!proyectoId || !idTareaProyecto || !idDepartamento) {
        mostrarErrorTabla("Faltan datos de navegacion. Vuelve atras.");
        return;
    }

    // solo mostramos el botón a los admins
    const btnSincronizar = document.getElementById("btn-sincronizar");
    if (btnSincronizar && !puedeGestionarImputaciones()) {
        btnSincronizar.style.display = "none";
    }

    setEstadoCargaTabla("Cargando tareas...");

    const result = await peticionSegura(`/imputaciones/departamento/${proyectoId}/${idTareaProyecto}/${idDepartamento}?subfase=${encodeURIComponent(subfaseReal)}`);

    if (!result || !result.success) {
        mostrarErrorTabla("Error al cargar las tareas.");
        return;
    }

    aplicarDatosImputaciones(result.data || []);
    actualizarEstadoFiltro("Mostrando todas las imputaciones del departamento.");
}

// Aplica el filtro por fechas sobre las imputaciones del contexto actual.
async function filtrarPorFechas() {
    const { proyectoId, idTareaProyecto, idDepartamento } = obtenerContextoVista();
    const desde = document.getElementById("fecha-desde")?.value;
    const hasta = document.getElementById("fecha-hasta")?.value;
    const subfaseReal = localStorage.getItem("subfaseSeleccionada") || "";

    if (!proyectoId || !idTareaProyecto || !idDepartamento) {
        mostrarErrorTabla("Faltan datos de navegacion. Vuelve atras.");
        return;
    }

    if (!desde || !hasta) {
        await cargarImputaciones();
        return;
    }

    setEstadoCargaTabla("Filtrando tareas...");

    const result = await peticionSegura(`/imputaciones/departamento/${proyectoId}/${idTareaProyecto}/${idDepartamento}/fechas?desde=${desde}&hasta=${hasta}&subfase=${encodeURIComponent(subfaseReal)}`);

    if (!result || !result.success) {
        mostrarErrorTabla((result && result.mensaje) || "Error al filtrar por fechas.");
        return;
    }

    aplicarDatosImputaciones(result.data || []);
    actualizarEstadoFiltro(`Filtrando del ${formatearFechaTexto(desde)} al ${formatearFechaTexto(hasta)}.`);
}

// Restablece el rango de fechas por defecto y vuelve a cargar las imputaciones.
async function limpiarFiltroFechas() {
    inicializarRangoFechas();
    await cargarImputaciones();
}

// Guarda las imputaciones cargadas, recalcula estadisticas y repinta la tabla.
function aplicarDatosImputaciones(imputaciones) {
    todasLasImputaciones = imputaciones;
    paginaActual = 1;
    actualizarEstadisticas();
    renderPagina();
}

// Filtra las imputaciones huerfanas que realmente corresponden al departamento y tarea actuales.
function extraerHuerfanasRelacionadas(huerfanasResult, idDepartamento, desde = null, hasta = null) {
    if (!huerfanasResult || !huerfanasResult.success || !Array.isArray(huerfanasResult.data)) {
        return [];
    }

    return huerfanasResult.data
        .filter(imputacion => String(imputacion.idDepartamento) === String(idDepartamento))
        .filter(imputacion => coincideConTareaActual(imputacion))
        .filter(imputacion => estaEnRango(imputacion.fecha, desde, hasta));
}

// Une dos colecciones de imputaciones sin duplicados y las deja ordenadas.
function combinarImputacionesVista(imputacionesBase, imputacionesExtra) {
    const mapa = new Map();

    [...imputacionesBase, ...imputacionesExtra].forEach(imputacion => {
        mapa.set(imputacion.idImputacionClockify, imputacion);
    });

    return Array.from(mapa.values()).sort((a, b) => {
        const fechaA = a.fecha || "";
        const fechaB = b.fecha || "";

        if (fechaA !== fechaB) {
            return fechaB.localeCompare(fechaA);
        }

        const horaA = a.horaInicio || "";
        const horaB = b.horaInicio || "";
        return horaA.localeCompare(horaB);
    });
}

// Comprueba si una imputacion pertenece a la tarea mostrada en esta pantalla.
function coincideConTareaActual(imputacion) {
    const tareaActual = normalizarTexto(localStorage.getItem("nombreTarea") || document.getElementById("bc-tarea")?.innerText || "");
    const tareaImputacion = normalizarTexto(imputacion.tareaExtraida || imputacion.descripcionOriginal || "");

    if (!tareaActual || !tareaImputacion) {
        return false;
    }

    return tareaImputacion === tareaActual
        || tareaImputacion.includes(tareaActual)
        || tareaActual.includes(tareaImputacion);
}

// Normaliza texto para compararlo sin tildes, mayusculas ni espacios sobrantes.
function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

// Comprueba si una fecha de texto cae dentro del rango indicado.
function estaEnRango(fechaTexto, desde = null, hasta = null) {
    if (!fechaTexto) {
        return false;
    }

    if (!desde && !hasta) {
        return true;
    }

    if (desde && fechaTexto < desde) {
        return false;
    }

    if (hasta && fechaTexto > hasta) {
        return false;
    }

    return true;
}

// Muestra un estado de carga temporal mientras se actualiza la tabla.
function setEstadoCargaTabla(texto) {
    const tbody = document.getElementById("tabla-tareas");
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="spinner-border spinner-border-sm me-2"></div>${texto}</td></tr>`;
}

// Sustituye la tabla por un mensaje de error cuando la carga falla.
function mostrarErrorTabla(mensaje) {
    const tbody = document.getElementById("tabla-tareas");
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state text-danger">${mensaje}</td></tr>`;
    document.getElementById("pag-info").innerText = "Sin resultados";
    document.getElementById("pag-btns").innerHTML = "";
}

// Actualiza el mensaje que explica el filtro activo en esta vista.
function actualizarEstadoFiltro(mensaje) {
    const estado = document.getElementById("estado-filtro");
    if (estado) {
        estado.innerText = mensaje;
    }
}

// Recalcula estadisticas y contadores a partir de las imputaciones visibles.
function actualizarEstadisticas() {
    const total = todasLasImputaciones.length;
    const correctas = todasLasImputaciones.filter(i => i.valida).length;
    const incorrectas = total - correctas;
    const pct = total > 0 ? Math.round((correctas / total) * 100) : 0;

    const tiempoTotal = todasLasImputaciones.reduce((suma, imputacion) => {
        return suma + (imputacion.horasTrabajadas || 0);
    }, 0);

    const sinAsociar = todasLasImputaciones
        .filter(i => !i.valida)
        .reduce((suma, imputacion) => suma + (imputacion.horasTrabajadas || 0), 0);

    document.getElementById("stat-correctas").innerText = correctas;
    document.getElementById("stat-incorrectas").innerText = incorrectas;
    document.getElementById("stat-pct-ok").innerText = `${pct}%`;
    document.getElementById("stat-pct-err").innerText = `${100 - pct}%`;
    document.getElementById("stat-tiempo-total").innerText = redondearH(tiempoTotal);
    document.getElementById("stat-sin-asociar").innerText = redondearH(sinAsociar);
    document.getElementById("resumen-tareas").innerText = `${correctas} / ${total} tareas correctas`;
    document.getElementById("resumen-sin-asociar").innerText = `${redondearH(sinAsociar)} tiempo sin asociar`;
    document.getElementById("pct-text").innerText = `${pct}%`;
    document.getElementById("cnt-todas").innerText = total;
    document.getElementById("cnt-correctas").innerText = correctas;
    document.getElementById("cnt-incorrectas").innerText = incorrectas;

    const circunferencia = 2 * Math.PI * 30;
    const offset = circunferencia - (pct / 100) * circunferencia;
    document.getElementById("ring-fill").style.strokeDashoffset = offset;
}

// Redondea horas decimales a un texto corto con horas y minutos.
function redondearH(horas) {
    if (!horas || horas === 0) {
        return "0h";
    }

    const horasEnteras = Math.floor(horas);
    const minutos = Math.round((horas - horasEnteras) * 60);

    if (minutos > 0) {
        return `${horasEnteras}h ${minutos}m`;
    }

    return `${horasEnteras}h`;
}

// Cambia el filtro activo entre todas, correctas o incorrectas y repinta la tabla.
function setFiltro(filtro) {
    filtroActual = filtro;
    paginaActual = 1;

    document.querySelectorAll(".filter-tab").forEach(boton => {
        boton.classList.remove("active", "active-correctas", "active-incorrectas");
    });

    if (filtro === "todas") {
        document.getElementById("tab-todas").classList.add("active");
    }

    if (filtro === "correctas") {
        document.getElementById("tab-correctas").classList.add("active", "active-correctas");
    }

    if (filtro === "incorrectas") {
        document.getElementById("tab-incorrectas").classList.add("active", "active-incorrectas");
    }

    renderPagina();
}

// Aplica filtros y paginacion antes de pintar la pagina actual de resultados.
function renderPagina() {
    const busqueda = (document.getElementById("input-busqueda")?.value || "").toLowerCase().trim();

    const filtradas = todasLasImputaciones.filter(imputacion => {
        if (filtroActual === "correctas" && !imputacion.valida) {
            return false;
        }

        if (filtroActual === "incorrectas" && imputacion.valida) {
            return false;
        }

        if (busqueda) {
            const texto = `
                ${imputacion.tareaExtraida || ""}
                ${imputacion.descripcionOriginal || ""}
                ${imputacion.subfaseExtraida || ""}
            `.toLowerCase();

            if (!texto.includes(busqueda)) {
                return false;
            }
        }

        return true;
    });

    const total = filtradas.length;
    const totalPag = Math.max(1, Math.ceil(total / porPagina));

    if (paginaActual > totalPag) {
        paginaActual = totalPag;
    }

    const inicio = (paginaActual - 1) * porPagina;
    const pagina = filtradas.slice(inicio, inicio + porPagina);

    renderTabla(pagina, inicio, total);
    renderPaginacion(total, totalPag);
}

// Pinta la tabla principal de esta vista usando los datos ya filtrados.
function renderTabla(filas, inicio, total) {
    const tbody = document.getElementById("tabla-tareas");

    if (filas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay tareas que coincidan.</td></tr>`;
        document.getElementById("pag-info").innerText = "Sin resultados";
        return;
    }

    tbody.innerHTML = filas.map(imputacion => {
        const esValida = imputacion.valida === true;
        const fecha = imputacion.fecha ? new Date(imputacion.fecha).toLocaleDateString("es-ES") : "-";
        const horaInicio = imputacion.horaInicio || "-";
        const horaFin = imputacion.horaFin || "-";
        const horasTotales = redondearH(imputacion.horasTrabajadas);
        const nombre = imputacion.tareaExtraida || imputacion.descripcionOriginal || "-";
        const subfase = imputacion.subfaseExtraida || "-";

        const estadoDot = esValida
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

        const botonValidacion = puedeGestionarImputaciones()
            ? (esValida
                ? `<button class="btn btn-sm btn-outline-warning" onclick="desvincularImputacion(${imputacion.idImputacionClockify}, this)">Desvincular</button>`
                : `<button class="btn btn-sm btn-outline-success" onclick="marcarValida(${imputacion.idImputacionClockify}, this)">Vincular</button>`)
            : "";

        // Comprobación de seguridad individual para cada botón
        const botonEditar = puedeGestionarImputaciones()
            ? `<button class="btn btn-sm btn-outline-secondary" onclick="editarImputacion(${imputacion.idImputacionClockify})">Editar</button>` 
            : '';

        const botonBorrar = typeof esSuperAdmin === "function" && esSuperAdmin()
            ? `<button class="btn btn-sm btn-outline-danger" onclick="eliminarImputacion(${imputacion.idImputacionClockify}, this)">Borrar</button>` 
            : '';

        return `
            <tr id="row-${imputacion.idImputacionClockify}">
                <td>${estadoDot}</td>
                <td class="fw-semibold">${nombre}</td>
                <td class="text-muted">${subfase}</td>
                <td class="text-muted">${fecha}</td>
                <td>${horaInicio}</td>
                <td>${horaFin}</td>
                <td class="fw-semibold">${horasTotales}</td>
                <td> 
                    <div class="d-flex gap-1 flex-wrap">
                        ${botonEditar}
                        ${botonValidacion}
                        ${botonBorrar}
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    document.getElementById("pag-info").innerText =
        `Mostrando ${inicio + 1} a ${Math.min(inicio + filas.length, total)} de ${total} tareas`;
}

// Genera los controles de paginacion segun la pagina actual y el total disponible.
function renderPaginacion(total, totalPag) {
    const contenedor = document.getElementById("pag-btns");
    contenedor.innerHTML = "";

    const prev = crearPagBtn("<", paginaActual === 1, () => {
        paginaActual--;
        renderPagina();
    });
    contenedor.appendChild(prev);

    for (let pagina = 1; pagina <= totalPag; pagina++) {
        if (totalPag > 7 && pagina > 3 && pagina < totalPag - 1 && Math.abs(pagina - paginaActual) > 1) {
            if (pagina === 4) {
                contenedor.appendChild(crearPagSpan("..."));
            }
            continue;
        }

        const btn = crearPagBtn(pagina, false, () => {
            paginaActual = pagina;
            renderPagina();
        });

        if (pagina === paginaActual) {
            btn.classList.add("active");
        }

        contenedor.appendChild(btn);
    }

    const next = crearPagBtn(">", paginaActual === totalPag || total === 0, () => {
        paginaActual++;
        renderPagina();
    });
    contenedor.appendChild(next);
}

// Crea un boton de paginacion reutilizable con su accion asociada.
function crearPagBtn(label, disabled, onClick) {
    const btn = document.createElement("button");
    btn.className = "pag-btn";
    btn.textContent = label;
    btn.disabled = disabled;

    if (!disabled) {
        btn.addEventListener("click", onClick);
    }

    return btn;
}

// Crea un separador visual para la paginacion cuando hay muchas paginas.
function crearPagSpan(texto) {
    const span = document.createElement("span");
    span.className = "pag-btn";
    span.style.cursor = "default";
    span.textContent = texto;
    return span;
}

// Actualiza cuantas filas se muestran por pagina y repinta la tabla.
function perPageChange() {
    porPagina = parseInt(document.getElementById("per-page").value, 10);
    paginaActual = 1;
    renderPagina();
}

// Lanza la sincronizacion de imputaciones desde Clockify y recarga la tabla.
async function sincronizarImputaciones() {
    if (!puedeGestionarImputaciones()) {
        alert("No tienes permisos para sincronizar imputaciones.");
        return;
    }

    const { proyectoId } = obtenerContextoVista();
    const btn = document.getElementById("btn-sincronizar");
    const estado = document.getElementById("estado-filtro");

    if (!proyectoId) {
        alert("No se ha encontrado el proyecto actual.");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Sincronizando...";
    if (estado) {
        estado.innerText = "Importando imputaciones desde Clockify...";
    }

    const result = await peticionSegura(`/clockify/sincronizar/${proyectoId}`, {
        method: "POST"
    });

    btn.disabled = false;
    btn.textContent = "Sincronizar";

    if (!result || !result.success) {
        actualizarEstadoFiltro((result && result.mensaje) || "Error al sincronizar.");
        alert((result && result.mensaje) || "Error al sincronizar.");
        return;
    }

    await cargarImputaciones();
    actualizarEstadoFiltro(result.mensaje || "Sincronizacion completada.");
}

// Marca una imputacion como vinculada a la tarea actual y actualiza la tabla.
async function marcarValida(id, btn) {
    if (!puedeGestionarImputaciones()) {
        alert("No tienes permisos para vincular imputaciones.");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Vinculando...";

    const { idTareaProyecto } = obtenerContextoVista();

    const result = await peticionSegura(`/imputaciones/alternar-validacion/${id}/${idTareaProyecto}`, {
        method: "PUT"
    });

    if (result && result.success) {
        const imputacion = todasLasImputaciones.find(i => i.idImputacionClockify === id);
        if (imputacion) {
            imputacion.valida = true;
            imputacion.idTareaProyecto = Number(idTareaProyecto);
        }

        actualizarEstadisticas();
        renderPagina();
        return;
    }

    btn.disabled = false;
    btn.textContent = "Vincular";
    alert((result && result.mensaje) || "Error al vincular.");
}

// Desvincula una imputacion de la tarea actual tras confirmacion del usuario.
async function desvincularImputacion(id, btn) {
    if (!puedeGestionarImputaciones()) {
        alert("No tienes permisos para desvincular imputaciones.");
        return;
    }

    if (!confirm("Seguro que quieres desvincular esta imputacion?")) {
        return;
    }

    btn.disabled = true;
    btn.textContent = "Desvinculando...";

    const { idTareaProyecto } = obtenerContextoVista();

    const result = await peticionSegura(`/imputaciones/alternar-validacion/${id}/${idTareaProyecto}`, {
        method: "PUT"
    });

    if (result && result.success) {
        const imputacion = todasLasImputaciones.find(i => i.idImputacionClockify === id);
        if (imputacion) {
            imputacion.valida = false;
            imputacion.idTareaProyecto = null;
        }

        actualizarEstadisticas();
        renderPagina();
        return;
    }

    btn.disabled = false;
    btn.textContent = "Desvincular";
    alert((result && result.mensaje) || "Error al desvincular.");
}

// Borra una imputacion concreta y actualiza la vista si la operacion termina bien.
async function eliminarImputacion(id, btn) {
    if (typeof esSuperAdmin !== "function" || !esSuperAdmin()) {
        alert("No tienes permisos para borrar imputaciones.");
        return;
    }

    if (!confirm("Seguro que quieres borrar esta imputacion?")) {
        return;
    }

    btn.disabled = true;
    btn.textContent = "Borrando...";

    const result = await peticionSegura(`/imputaciones/borrar/${id}`, {
        method: "DELETE"
    });

    if (result && result.success) {
        todasLasImputaciones = todasLasImputaciones.filter(i => i.idImputacionClockify !== id);
        actualizarEstadisticas();
        renderPagina();
        return;
    }

    btn.disabled = false;
    btn.textContent = "Borrar";
    alert((result && result.mensaje) || "Error al borrar.");
}

// Abre el modal de edicion cargando la tarea actual de la imputacion elegida.
function editarImputacion(id) {
    if (!puedeGestionarImputaciones()) {
        alert("No tienes permisos para editar imputaciones.");
        return;
    }

    const imputacion = todasLasImputaciones.find(i => i.idImputacionClockify === id);
    if (!imputacion) {
        alert("No se encontro la imputacion.");
        return;
    }

    const valorActual = imputacion.tareaExtraida || imputacion.descripcionOriginal || "";
    idImputacionEditando = id;

    const overlay = document.getElementById("edit-modal-overlay");
    const input = document.getElementById("edit-modal-input");
    const botonGuardar = document.getElementById("edit-modal-save-btn");

    if (!overlay || !input || !botonGuardar) {
        alert("No se pudo abrir el editor.");
        return;
    }

    input.value = valorActual;
    botonGuardar.disabled = false;
    botonGuardar.textContent = "Guardar";
    overlay.classList.add("show");

    setTimeout(() => {
        input.focus();
        input.select();
    }, 0);
}

// Cierra el modal de edicion y limpia su estado temporal.
function cerrarModalEdicion(event) {
    if (event && event.target && event.target.id !== "edit-modal-overlay") {
        return;
    }

    const overlay = document.getElementById("edit-modal-overlay");
    const input = document.getElementById("edit-modal-input");
    const botonGuardar = document.getElementById("edit-modal-save-btn");

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

    idImputacionEditando = null;
}

// Guarda los cambios hechos sobre una imputacion y actualiza la fila en pantalla.
async function guardarEdicionImputacion() {
    if (!puedeGestionarImputaciones()) {
        alert("No tienes permisos para editar imputaciones.");
        cerrarModalEdicion();
        return;
    }

    if (!idImputacionEditando) {
        return;
    }

    const imputacion = todasLasImputaciones.find(i => i.idImputacionClockify === idImputacionEditando);
    const input = document.getElementById("edit-modal-input");
    const selectSub = document.getElementById("edit-select-subfase");
    const botonGuardar = document.getElementById("edit-modal-save-btn");

    if (!imputacion || !input || !botonGuardar) {
        alert("No se pudo guardar la edicion.");
        return;
    }

    const tareaLimpia = input.value.trim();

    let subfaseLimpia = "";
    let idSubfaseLimpia = null;

    // Verificamos que haya seleccionado algo válido (que no sea el placeholder "Selecciona...")
    if (selectSub && selectSub.selectedIndex > 0) { 
        subfaseLimpia = selectSub.options[selectSub.selectedIndex].text; // El texto para visualización
        idSubfaseLimpia = selectSub.options[selectSub.selectedIndex].value; // El ID para la base de datos
    }

    if (!tareaLimpia) {
        alert("El nombre de la tarea no puede estar vacio.");
        input.focus();
        return;
    }

    botonGuardar.disabled = true;
    botonGuardar.textContent = "Guardando...";

    // Preparamos el paquete con los 3 datos
    const payload = { 
        tareaExtraida: tareaLimpia,
        subfaseExtraida: subfaseLimpia,
        idFase: idSubfaseLimpia 
    };

    const result = await peticionSegura(`/imputaciones/editar-tarea/${idImputacionEditando}`, {
        method: "PUT",
        body: JSON.stringify(payload)
    });

    if (result && result.success) {
        imputacion.tareaExtraida = tareaLimpia;

        if (subfaseLimpia) {
            imputacion.subfaseExtraida = subfaseLimpia;
        }

        renderPagina();
        cerrarModalEdicion();
        return;
    }

    botonGuardar.disabled = false;
    botonGuardar.textContent = "Guardar";
    alert((result && result.mensaje) || "Error al editar la tarea.");
}

// Gestiona atajos de teclado del modal de edicion, como Enter y Escape.
function manejarTeclasModalEdicion(event) {
    const overlay = document.getElementById("edit-modal-overlay");
    if (!overlay || !overlay.classList.contains("show")) {
        return;
    }

    if (event.key === "Escape") {
        cerrarModalEdicion();
    }

    if (event.key === "Enter") {
        guardarEdicionImputacion();
    }
}

// Convierte una fecha ISO a un texto breve en formato local.
function formatearFechaTexto(valor) {
    const fecha = new Date(valor);
    return fecha.toLocaleDateString("es-ES");
}

// Carga las fases del proyecto para alimentar los selectores del modal de edicion.
async function cargarFasesYSubfasesEdit() {
    const proyectoId = localStorage.getItem("proyectoId");
    const selectFase = document.getElementById("edit-select-fase");
    const selectSub = document.getElementById("edit-select-subfase");

    if (!proyectoId || !selectFase) return;

    try {
        const result = await peticionSegura(`/fases/${proyectoId}`);
        if (!result || !result.success || !Array.isArray(result.data)) return;

        subfasesPorFaseEdit = {};
        nombresFaseEdit = {};
        
        selectFase.innerHTML = '<option value="" disabled selected>Selecciona una fase...</option>';

        result.data.forEach(fase => {
            const idFase = String(fase.id);
            nombresFaseEdit[idFase] = fase.nombre;
            subfasesPorFaseEdit[idFase] = Array.isArray(fase.subfases) ? fase.subfases : [];

            const opt = document.createElement("option");
            opt.value = idFase;
            opt.textContent = fase.nombre;
            selectFase.appendChild(opt);
        });

        if (typeof refrescarSelect2 === "function") {
            refrescarSelect2(selectFase);
            refrescarSelect2(selectSub);
        }
    } catch (error) {
        console.error("Error al cargar fases para edición:", error);
    }
}

// Recarga las subfases disponibles para el selector de edicion del modal.
function onCambioFaseEdit() {
    const idFase = document.getElementById("edit-select-fase").value;
    const selectSub = document.getElementById("edit-select-subfase");

    if (!idFase) {
        selectSub.innerHTML = '<option value="" disabled selected>Primero selecciona una fase...</option>';
        selectSub.disabled = true;
        if (typeof refrescarSelect2 === "function") {
            refrescarSelect2(selectSub);
        }
        return;
    }

    const subfases = subfasesPorFaseEdit[idFase] || [];
    selectSub.disabled = false;
    selectSub.innerHTML = '<option value="" disabled selected>Selecciona una subfase...</option>';

    subfases.forEach(subfase => {
        const opt = document.createElement("option");
        opt.value = subfase.id;
        opt.textContent = subfase.nombre;
        selectSub.appendChild(opt);
    });

    if (typeof refrescarSelect2 === "function") {
        refrescarSelect2(selectSub);
    }
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
