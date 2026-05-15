let todasLasImputaciones = [];
let filtroActual = "todas";
let paginaActual = 1;
let porPagina = 10;
let idImputacionEditando = null;

window.onload = async function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    if (typeof esEmpleado === "function" && esEmpleado()) {
        document.body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                        height:100vh;background:#f8f9fa;font-family:sans-serif;">
                <div style="width:80px;height:80px;background:#fee2e2;border-radius:50%;
                            display:flex;align-items:center;justify-content:center;margin-bottom:1.5rem;">
                    <svg width="40" height="40" fill="none" stroke="#dc2626" stroke-width="2.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                </div>
                <h2 style="color:#1f2937;font-weight:800;margin:0 0 0.5rem;">Acceso no permitido</h2>
                <p style="color:#6c757d;margin:0 0 1.5rem;">Los usuarios con rol Empleado no pueden visualizar tareas.</p>
                <a href="proyectos.html" style="background:#C01717;color:white;padding:10px 24px;
                    border-radius:6px;text-decoration:none;font-weight:600;">Volver a Proyectos</a>
            </div>`;
        return;
    }

    cargarBreadcrumb();
    inicializarRangoFechas();
    configurarFiltrosAutomaticos();
    await cargarImputaciones();
    setFiltro('correctas');

    document.addEventListener("keydown", manejarTeclasModalEdicion);
};

function obtenerContextoVista() {
    return {
        proyectoId: localStorage.getItem("proyectoId"),
        idDetalleEstimacion: localStorage.getItem("idDetalleEstimacionVis"),
        idDepartamento: localStorage.getItem("idDepartamentoVis")
    };
}

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

function configurarFiltrosAutomaticos() {
    const inputDesde = document.getElementById("fecha-desde");
    const inputHasta = document.getElementById("fecha-hasta");

    if (!inputDesde || !inputHasta) {
        return;
    }

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

function formatearFechaInput(fecha) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

async function cargarImputaciones() {
    const { proyectoId, idDetalleEstimacion, idDepartamento } = obtenerContextoVista();

    if (!proyectoId || !idDetalleEstimacion || !idDepartamento) {
        mostrarErrorTabla("Faltan datos de navegacion. Vuelve atras.");
        return;
    }

    // solo mostramos el botón a los admins
    const btnSincronizar = document.getElementById("btn-sincronizar");
    if (btnSincronizar && !esAdmin()) {
        btnSincronizar.style.display = "none";
    }

    setEstadoCargaTabla("Cargando tareas...");

    const result = await peticionSegura(`/imputaciones/departamento/${proyectoId}/${idDetalleEstimacion}/${idDepartamento}`);

    if (!result || !result.success) {
        mostrarErrorTabla("Error al cargar las tareas.");
        return;
    }

    aplicarDatosImputaciones(result.data || []);
    actualizarEstadoFiltro("Mostrando todas las imputaciones del departamento.");
}

async function filtrarPorFechas() {
    const { proyectoId, idDetalleEstimacion, idDepartamento } = obtenerContextoVista();
    const desde = document.getElementById("fecha-desde")?.value;
    const hasta = document.getElementById("fecha-hasta")?.value;

    if (!proyectoId || !idDetalleEstimacion || !idDepartamento) {
        mostrarErrorTabla("Faltan datos de navegacion. Vuelve atras.");
        return;
    }

    if (!desde || !hasta) {
        await cargarImputaciones();
        return;
    }

    setEstadoCargaTabla("Filtrando tareas...");

    const result = await peticionSegura(`/imputaciones/departamento/${proyectoId}/${idDetalleEstimacion}/${idDepartamento}/fechas?desde=${desde}&hasta=${hasta}`);

    if (!result || !result.success) {
        mostrarErrorTabla((result && result.mensaje) || "Error al filtrar por fechas.");
        return;
    }

    aplicarDatosImputaciones(result.data || []);
    actualizarEstadoFiltro(`Filtrando del ${formatearFechaTexto(desde)} al ${formatearFechaTexto(hasta)}.`);
}

async function limpiarFiltroFechas() {
    inicializarRangoFechas();
    await cargarImputaciones();
}

function aplicarDatosImputaciones(imputaciones) {
    todasLasImputaciones = imputaciones;
    paginaActual = 1;
    actualizarEstadisticas();
    renderPagina();
}

function extraerHuerfanasRelacionadas(huerfanasResult, idDepartamento, desde = null, hasta = null) {
    if (!huerfanasResult || !huerfanasResult.success || !Array.isArray(huerfanasResult.data)) {
        return [];
    }

    return huerfanasResult.data
        .filter(imputacion => String(imputacion.idDepartamento) === String(idDepartamento))
        .filter(imputacion => coincideConTareaActual(imputacion))
        .filter(imputacion => estaEnRango(imputacion.fecha, desde, hasta));
}

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

function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

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

function setEstadoCargaTabla(texto) {
    const tbody = document.getElementById("tabla-tareas");
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="spinner-border spinner-border-sm me-2"></div>${texto}</td></tr>`;
}

function mostrarErrorTabla(mensaje) {
    const tbody = document.getElementById("tabla-tareas");
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state text-danger">${mensaje}</td></tr>`;
    document.getElementById("pag-info").innerText = "Sin resultados";
    document.getElementById("pag-btns").innerHTML = "";
}

function actualizarEstadoFiltro(mensaje) {
    const estado = document.getElementById("estado-filtro");
    if (estado) {
        estado.innerText = mensaje;
    }
}

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

        const botonValidacion = esValida
            ? `<button class="btn btn-sm btn-outline-warning" onclick="desvincularImputacion(${imputacion.idImputacionClockify}, this)">Desvincular</button>`
            : `<button class="btn btn-sm btn-outline-success" onclick="marcarValida(${imputacion.idImputacionClockify}, this)">Vincular</button>`;

        // Comprobación de seguridad individual para cada botón
        const botonEditar = esAdmin() 
            ? `<button class="btn btn-sm btn-outline-secondary" onclick="editarImputacion(${imputacion.idImputacionClockify})">Editar</button>` 
            : '';

        const botonBorrar = esSuperAdmin() 
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

function crearPagSpan(texto) {
    const span = document.createElement("span");
    span.className = "pag-btn";
    span.style.cursor = "default";
    span.textContent = texto;
    return span;
}

function perPageChange() {
    porPagina = parseInt(document.getElementById("per-page").value, 10);
    paginaActual = 1;
    renderPagina();
}

async function sincronizarImputaciones() {
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

async function marcarValida(id, btn) {
    btn.disabled = true;
    btn.textContent = "Vinculando...";

    const { idDetalleEstimacion } = obtenerContextoVista();

    const result = await peticionSegura(`/imputaciones/alternar-validacion/${id}/${idDetalleEstimacion}`, {
        method: "PUT"
    });

    if (result && result.success) {
        const imputacion = todasLasImputaciones.find(i => i.idImputacionClockify === id);
        if (imputacion) {
            imputacion.valida = true;
            imputacion.idDetalleEstimacion = Number(idDetalleEstimacion);
        }

        actualizarEstadisticas();
        renderPagina();
        return;
    }

    btn.disabled = false;
    btn.textContent = "Vincular";
    alert((result && result.mensaje) || "Error al vincular.");
}

async function desvincularImputacion(id, btn) {
    if (!confirm("Seguro que quieres desvincular esta imputacion?")) {
        return;
    }

    btn.disabled = true;
    btn.textContent = "Desvinculando...";

    const { idDetalleEstimacion } = obtenerContextoVista();

    const result = await peticionSegura(`/imputaciones/alternar-validacion/${id}/${idDetalleEstimacion}`, {
        method: "PUT"
    });

    if (result && result.success) {
        const imputacion = todasLasImputaciones.find(i => i.idImputacionClockify === id);
        if (imputacion) {
            imputacion.valida = false;
            imputacion.idDetalleEstimacion = null;
        }

        actualizarEstadisticas();
        renderPagina();
        return;
    }

    btn.disabled = false;
    btn.textContent = "Desvincular";
    alert((result && result.mensaje) || "Error al desvincular.");
}

async function eliminarImputacion(id, btn) {
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

function editarImputacion(id) {
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

async function guardarEdicionImputacion() {
    if (!idImputacionEditando) {
        return;
    }

    const imputacion = todasLasImputaciones.find(i => i.idImputacionClockify === idImputacionEditando);
    const input = document.getElementById("edit-modal-input");
    const botonGuardar = document.getElementById("edit-modal-save-btn");

    if (!imputacion || !input || !botonGuardar) {
        alert("No se pudo guardar la edicion.");
        return;
    }

    const tareaLimpia = input.value.trim();
    if (!tareaLimpia) {
        alert("El nombre de la tarea no puede estar vacio.");
        input.focus();
        return;
    }

    botonGuardar.disabled = true;
    botonGuardar.textContent = "Guardando...";

    const result = await peticionSegura(`/imputaciones/editar-tarea/${idImputacionEditando}`, {
        method: "PUT",
        body: JSON.stringify({ tareaExtraida: tareaLimpia })
    });

    if (result && result.success) {
        imputacion.tareaExtraida = tareaLimpia;
        renderPagina();
        cerrarModalEdicion();
        return;
    }

    botonGuardar.disabled = false;
    botonGuardar.textContent = "Guardar";
    alert((result && result.mensaje) || "Error al editar la tarea.");
}

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

function formatearFechaTexto(valor) {
    const fecha = new Date(valor);
    return fecha.toLocaleDateString("es-ES");
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
