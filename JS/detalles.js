// Inicializa la pantalla, valida la sesion activa y carga el contexto
// principal necesario antes de que el usuario empiece a interactuar.
window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    cargarPaginaDetalles();
};

let estructuraActual = {};
let idsActuales = {};
let resumenSubfases = {};
let tareasSubfasesCompletadas = new Map();
let idExcelSeleccionadoActual = null;

// Inicializa la pantalla de detalles del proyecto y engancha sus eventos principales.
async function cargarPaginaDetalles() {
    const proyectoId = localStorage.getItem("proyectoId");

    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoActual = proyectos.find((p) => String(p.id) === String(proyectoId));
    document.getElementById("proyecto-nombre-display").innerText =
        proyectoActual ? proyectoActual.nombre : "Proyecto " + proyectoId;

    const keySync = `ultima-sync-${proyectoId}`;
    const ultimaSync = localStorage.getItem(keySync);
    if (ultimaSync) {
        mostrarUltimaSync(ultimaSync);
    }

    if (esAdmin()) {
        document.getElementById("botones-admin").style.display = "flex";
    }

    const btnDescargarExcel = document.getElementById("btn-descargar-excel");
    if (btnDescargarExcel) {
        btnDescargarExcel.addEventListener("click", descargarExcelActual);
    }

    const btnDescargarReporteAnalitico = document.getElementById("btn-descargar-reporte-analitico");
    if (btnDescargarReporteAnalitico) {
        btnDescargarReporteAnalitico.addEventListener("click", descargarReporteAnaliticoActual);
    }

    await cargarHistorialExcels(proyectoId);

    document.getElementById("input-busqueda").addEventListener("input", (e) => {
        renderizarTodo(e.target.value, estructuraActual, idsActuales);
    });
}

// Descarga el Excel actualmente seleccionado en el historial del proyecto.
async function descargarExcelActual() {
    const btn = document.getElementById("btn-descargar-excel");
    const selectExcel = document.getElementById("select-historial-excel");
    const idExcel = idExcelSeleccionadoActual || selectExcel?.value;

    if (!idExcel) {
        mostrarToast("No hay ningun Excel seleccionado para descargar.", "error");
        return;
    }

    await descargarArchivoExcel({
        boton: btn,
        endpoint: `/excel/exportar/${encodeURIComponent(idExcel)}`,
        nombreFallback: `Estimacion_Proyecto_${idExcel}.xlsx`,
        mensajeOk: "Excel descargado correctamente.",
        mensajeError: "No se pudo descargar el Excel."
    });
}

// Descarga el reporte analitico del proyecto usando el Excel seleccionado en el historial.
async function descargarReporteAnaliticoActual() {
    const proyectoId = localStorage.getItem("proyectoId");
    const btn = document.getElementById("btn-descargar-reporte-analitico");
    const selectExcel = document.getElementById("select-historial-excel");
    const idExcel = idExcelSeleccionadoActual || selectExcel?.value;

    if (!proyectoId) {
        mostrarToast("No se encontro el proyecto actual.", "error");
        return;
    }

    if (!idExcel) {
        mostrarToast("No hay ningun Excel seleccionado para generar el reporte.", "error");
        return;
    }

    await descargarArchivoExcel({
        boton: btn,
        endpoint: `/excel/exportar-analitico/${encodeURIComponent(proyectoId)}/${encodeURIComponent(idExcel)}`,
        nombreFallback: `Reporte_Analitico_Proyecto_${proyectoId}.xlsx`,
        mensajeOk: "Reporte analitico descargado correctamente.",
        mensajeError: "No se pudo descargar el reporte analitico."
    });
}

// Ejecuta una descarga binaria autenticada y restaura el estado visual del boton al terminar.
async function descargarArchivoExcel({ boton, endpoint, nombreFallback, mensajeOk, mensajeError }) {
    const token = localStorage.getItem("token");
    const textoOriginal = boton ? boton.innerHTML : "";

    if (boton) {
        boton.disabled = true;
        boton.innerHTML = `
            <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
            Descargando...
        `;
    }

    try {
        const response = await fetch(`${URL_BASE}${endpoint}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(`Error ${response.status} al descargar el Excel.`);
        }

        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") || response.headers.get("content-disposition") || "";
        const nombreArchivo = obtenerNombreArchivoDesdeCabecera(disposition) || nombreFallback;
        const url = window.URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        window.URL.revokeObjectURL(url);

        mostrarToast(mensajeOk, "success");
    } catch (error) {
        console.error("Error al descargar el Excel:", error);
        mostrarToast(mensajeError, "error");
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.innerHTML = textoOriginal;
        }
    }
}

// Recupera el nombre del fichero sugerido por el backend para reutilizarlo en la descarga.
function obtenerNombreArchivoDesdeCabecera(contentDisposition) {
    if (!contentDisposition) {
        return "";
    }

    const matchUtf = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (matchUtf && matchUtf[1]) {
        return decodeURIComponent(matchUtf[1]).replace(/["']/g, "").trim();
    }

    const matchNormal = contentDisposition.match(/filename\s*=\s*"?(.*?)"?($|;)/i);
    return matchNormal && matchNormal[1] ? matchNormal[1].trim() : "";
}

// Sincroniza primero GitLab y despues Clockify para que las imputaciones puedan
// aprovechar las vinculaciones por numero de issue antes de refrescar la vista.
async function sincronizar() {
    const proyectoId = localStorage.getItem("proyectoId");
    const btn = document.getElementById("btn-sincronizar");
    const icon = document.getElementById("icon-sync");
    const texto = document.getElementById("texto-sincronizar");

    if (!proyectoId) {
        mostrarToast("No se encontro el proyecto actual.", "error");
        return;
    }

    try {
        btn.disabled = true;
        texto.textContent = "Sincronizando GitLab...";
        icon.style.animation = "spin 1s linear infinite";
        icon.style.transformOrigin = "center";

        const resultadoGitLab = await peticionSegura(`/gitlab/sincronizar/${proyectoId}`, {
            method: "GET"
        });

        if (!resultadoGitLab || !resultadoGitLab.success) {
            mostrarToast((resultadoGitLab && resultadoGitLab.mensaje) || "Error al sincronizar GitLab.", "error");
            return;
        }

        texto.textContent = "Sincronizando Clockify...";

        const resultadoClockify = await peticionSegura(`/clockify/sincronizar/${proyectoId}`, {
            method: "POST"
        });

        if (!resultadoClockify || !resultadoClockify.success) {
            mostrarToast((resultadoClockify && resultadoClockify.mensaje) || "Error al sincronizar Clockify.", "error");
            return;
        }

        texto.textContent = "Actualizando...";
        const ahora = new Date().toISOString();
        localStorage.setItem(`ultima-sync-${proyectoId}`, ahora);
        await refrescarDetallesActuales(true);
        mostrarUltimaSync(ahora);
        mostrarToast(
            `${resultadoGitLab.mensaje || "GitLab sincronizado."} ${resultadoClockify.mensaje || "Clockify sincronizado."}`,
            "success"
        );

        if (typeof auditService !== "undefined" && auditService && auditService.registrar) {
            auditService.registrar("SINCRONIZACION", `Proyecto ${proyectoId} sincronizado con GitLab y Clockify.`, parseInt(proyectoId, 10));
        }
    } catch (error) {
        console.error("Error al sincronizar el proyecto:", error);
        mostrarToast("No se pudo completar la sincronizacion.", "error");
    } finally {
        btn.disabled = false;
        texto.textContent = "Sincronizar";
        icon.style.animation = "";
    }
}

// Recarga las subfases y mantiene, si procede, el filtro que ya tenia el usuario.
async function refrescarDetallesActuales(mantenerFiltro = false) {
    const proyectoId = localStorage.getItem("proyectoId");
    const inputBusqueda = document.getElementById("input-busqueda");
    const contenedor = document.getElementById("contenedor-fases");
    const filtroActual = mantenerFiltro && inputBusqueda ? inputBusqueda.value : "";

    if (contenedor) {
        contenedor.innerHTML = `
            <div class="text-center py-5 text-muted">
                <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                Actualizando horas...
            </div>`;
    }

    await cargarSubfases(proyectoId, idExcelSeleccionadoActual);

    if (mantenerFiltro && inputBusqueda) {
        inputBusqueda.value = filtroActual;
        renderizarTodo(filtroActual, estructuraActual, idsActuales);
    }
}

// Muestra en pantalla la fecha y hora de la ultima sincronizacion realizada.
function mostrarUltimaSync(isoString) {
    const fecha = new Date(isoString);
    const formateada = fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
        + " "
        + fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    document.getElementById("fecha-ultima-sync").textContent = formateada;
    document.getElementById("ultima-sincronizacion").style.display = "inline";
}

// Muestra una notificacion flotante temporal con el resultado de una accion.
function mostrarToast(mensaje, tipo) {
    const anterior = document.getElementById("toast-sync");
    if (anterior) {
        anterior.remove();
    }

    const color = tipo === "success" ? "#166534" : "#991b1b";
    const bg = tipo === "success" ? "#f0fdf4" : "#fef2f2";
    const borde = tipo === "success" ? "#bbf7d0" : "#fecaca";
    const icono = tipo === "success"
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

// Carga el historial de Excels del proyecto y selecciona el que debe mostrarse.
async function cargarHistorialExcels(proyectoId) {
    const select = document.getElementById("select-historial-excel");
    select.innerHTML = '<option value="">Cargando historial...</option>';

    const result = await peticionSegura(`/fases/historial/${proyectoId}`);

    if (!result || !result.success || !result.data || result.data.length === 0) {
        select.innerHTML = '<option value="">Sin historial</option>';
        idExcelSeleccionadoActual = null;
        if (typeof refrescarSelect2 === "function") {
            refrescarSelect2(select);
        }
        return;
    }

    const excels = result.data;
    // Ordenar los excels para que el vigente salga obligatoriamente el primero
    excels.sort((a, b) => {
        if (a.vigente && !b.vigente) return -1;
        if (!a.vigente && b.vigente) return 1;
        return 0;
    });

    const claveSeleccion = obtenerClaveExcelSeleccionado(proyectoId);
    const idPersistido = localStorage.getItem(claveSeleccion);
    const excelVigente = excels.find((excel) => excel.vigente) || null;
    const idInicial = idPersistido && excels.some((excel) => String(excel.idExcel) === String(idPersistido))
        ? String(idPersistido)
        : (excelVigente ? String(excelVigente.idExcel) : String(excels[0].idExcel));

    select.innerHTML = "";

    excels.forEach((excel) => {
        const fecha = excel.fechaSubida
            ? new Date(excel.fechaSubida).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
            : "Fecha desconocida";

        const opt = document.createElement("option");
        opt.value = excel.idExcel;
        opt.textContent = `${fecha} - ${excel.usuarioNombre || "Usuario"}`;

        if (String(excel.idExcel) === idInicial) {
            opt.selected = true;
        }

        if (excel.vigente) {
            opt.style.fontWeight = "bold";
        }

        select.appendChild(opt);
    });

    idExcelSeleccionadoActual = idInicial;
    localStorage.setItem(claveSeleccion, idExcelSeleccionadoActual);
    if (typeof refrescarSelect2 === "function") {
        refrescarSelect2(select);
    }
    await cargarSubfases(proyectoId, idExcelSeleccionadoActual);
}

// Reacciona al cambio de Excel en el historial y recarga las fases correspondientes.
async function onCambioExcel(select) {
    const idExcel = select.value;
    if (!idExcel) {
        return;
    }

    const proyectoId = localStorage.getItem("proyectoId");
    idExcelSeleccionadoActual = String(idExcel);
    localStorage.setItem(obtenerClaveExcelSeleccionado(proyectoId), idExcelSeleccionadoActual);

    const contenedor = document.getElementById("contenedor-fases");
    contenedor.innerHTML = `
        <div class="text-center py-5 text-muted">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Cargando fases...
        </div>`;

    await cargarSubfases(proyectoId, idExcelSeleccionadoActual);
}

// Carga las fases o subfases correspondientes al proyecto o al Excel seleccionado.
async function cargarSubfases(proyectoId, idExcelSeleccionado = null) {
    const endpoint = idExcelSeleccionado
        ? `/fases/por-excel/${idExcelSeleccionado}`
        : `/fases/${proyectoId}`;

    const result = await peticionSegura(endpoint);

    if (!result || !result.success) {
        console.error("No se pudieron cargar las fases.");
        return;
    }

    await procesarYRenderizar(result.data);
}

// Reordena las fases cargadas, obtiene sus resumenes y lanza el render principal.
async function procesarYRenderizar(fases) {
    const estructura = {};
    const ids = {};
    const proyectoId = localStorage.getItem("proyectoId");

    fases.forEach((fase) => {
        estructura[fase.nombre] = fase.subfases.map((subfase) => subfase.nombre);
        fase.subfases.forEach((subfase) => {
            ids[subfase.nombre] = subfase.id;
        });
    });

    estructuraActual = estructura;
    idsActuales = ids;

    try {
        const queryResumen = idExcelSeleccionadoActual
            ? `?idExcelElegido=${encodeURIComponent(idExcelSeleccionadoActual)}`
            : "";

        const resultTiempos = await peticionSegura(`/estimaciones/resumen/subfases/${proyectoId}${queryResumen}`);
        if (resultTiempos && resultTiempos.success && resultTiempos.data) {
            resumenSubfases = resultTiempos.data;
        } else {
            resumenSubfases = {};
        }
    } catch (e) {
        console.error("Error al cargar los tiempos masivos:", e);
        resumenSubfases = {};
    }

    document.getElementById("input-busqueda").value = "";
    await cargarEstadosSubfasesCompletadas();
    renderizarTodo("", estructura, ids);
}

// Recorre la estructura de fases y subfases para pintar solo las que cumplen el filtro.
async function cargarEstadosSubfasesCompletadas() {
    tareasSubfasesCompletadas.clear();
    const proyectoId = localStorage.getItem("proyectoId");
    if (!proyectoId || !idsActuales || Object.keys(idsActuales).length === 0) {
        return;
    }

    const promesas = Object.entries(idsActuales).map(([subfaseNombre, idSubfase]) => {
        return subfaseCompletada(idSubfase)
            .then((res) => {
                const completada = Boolean(res && res.success);
                const datos = Array.isArray(res && res.data) ? res.data : null;
                return { idSubfase, completada, datos };
            })
            .catch(() => ({ idSubfase, completada: false, datos: null }));
    });

    const resultados = await Promise.all(promesas);
    resultados.forEach(({ idSubfase, completada, datos }) => {
        tareasSubfasesCompletadas.set(String(idSubfase), { completada, datos });
    });
}

// Recorre la estructura de fases y subfases para pintar solo las que cumplen el filtro.
function renderizarTodo(filtro = "", estr, ids) {
    const contenedor = document.getElementById("contenedor-fases");
    contenedor.innerHTML = "";

    const filtroNormalizado = filtro.toLowerCase().trim();
    let hayResultados = false;

    for (const fase in estr) {
        const subfases = estr[fase];
        const subfasesFiltradas = subfases.filter((sub) =>
            sub.toLowerCase().includes(filtroNormalizado)
        );

        if (subfasesFiltradas.length === 0) {
            continue;
        }

        hayResultados = true;

        const seccion = document.createElement("section");
        seccion.className = "phase-section";

        let htmlContent = `<h3 class="phase-header h5">${fase}</h3>`;
        htmlContent += '<div class="row g-3">';

        subfasesFiltradas.forEach((sub) => {
            const idSub = ids[sub];
            const tiempos = resumenSubfases[idSub] || { tiempoRealTotal: 0, tiempoEstimadoMin: 0, tiempoEstimadoMax: 0 };
            const displayReal = formatoHoras(parseFloat(tiempos.tiempoRealTotal));
            const displayMin = formatoHoras(parseFloat(tiempos.tiempoEstimadoMin));
            const displayMax = formatoHoras(parseFloat(tiempos.tiempoEstimadoMax));
            const estado = tareasSubfasesCompletadas.get(String(idSub)) || { completada: false, datos: null };
            const completada = estado.completada === true;
            const datos = estado.datos;
            const conteoTexto = Array.isArray(datos) && datos.length >= 2 ? `${datos[0]}/${datos[1]}` : "";

            if (completada) {
                htmlContent += `
                <div class="col-12 col-md-6 col-lg-3">
                    <div class="card subfase-card-completada p-3 shadow-sm h-100" onclick="irASubfase('${sub}, ${idSub}', '${fase}')">
                        <div class="fw-bold text-dark">${sub}</div>
                        <div class="text-primary mt-2 fw-bold" style="font-size: 0.95rem;">
                            ${displayReal} / ${displayMin} - ${displayMax}
                        </div>
                        <div class="text-secondary small mt-1 fw-bold">TAREAS COMPLETADAS: ${conteoTexto}</div>
                        <div class="text-muted small mt-2">Haga clic para ver tareas</div>
                    </div>
                </div>
            `;
            } else {
                htmlContent += `
                <div class="col-12 col-md-6 col-lg-3">
                    <div class="card subfase-card p-3 shadow-sm h-100" onclick="irASubfase('${sub}, ${idSub}', '${fase}')">
                        <div class="fw-bold text-dark">${sub}</div>
                        <div class="text-primary mt-2 fw-bold" style="font-size: 0.95rem;">
                            ${displayReal} / ${displayMin} - ${displayMax}
                        </div>
                        <div class="text-secondary small mt-1 fw-bold">TAREAS COMPLETADAS: ${conteoTexto}</div>
                        <div class="text-muted small mt-2">Haga clic para ver tareas</div>
                    </div>
                </div>
            `;
            }
            
        });

        htmlContent += "</div>";
        seccion.innerHTML = htmlContent;
        contenedor.appendChild(seccion);
    }

    if (!hayResultados) {
        contenedor.innerHTML = `
            <div class="text-center py-5 text-muted">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="mb-3 opacity-50">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <p class="mb-0">No se encontraron subfases${filtroNormalizado ? ` para "<strong>${filtroNormalizado}</strong>"` : ""}.</p>
            </div>`;
    }
}

// Guarda la subfase elegida y navega a la pantalla de sus tareas.
function irASubfase(nombreSubfase, nombreFase) {
    const partes = nombreSubfase.split(",");
    const proyectoId = localStorage.getItem("proyectoId");
    const fasePermitida = obtenerFasePermitida(nombreFase);

    localStorage.setItem("idSubfase", partes[1]);
    localStorage.setItem("subfaseSeleccionada", partes[0]);
    if (fasePermitida) {
        localStorage.setItem("faseSeleccionada", fasePermitida);
    } else {
        localStorage.removeItem("faseSeleccionada");
    }

    if (idExcelSeleccionadoActual) {
        localStorage.setItem(obtenerClaveExcelSeleccionado(proyectoId), idExcelSeleccionadoActual);
    }

    window.location.href = "subfase.html";
}

// Construye la clave usada en localStorage para recordar el Excel elegido.
function obtenerClaveExcelSeleccionado(proyectoId) {
    return `idExcelHistorialSeleccionado-${proyectoId}`;
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}

// Convierte horas decimales a un formato mas legible para mostrarlo en pantalla.
function formatoHoras(decimal) {
    if (!decimal || isNaN(decimal)) {
        return "0h";
    }

    const horas = Math.floor(decimal);
    const minutos = Math.floor((decimal - horas) * 60);

    if (minutos <= 0) {
        return `${horas}h`;
    }

    return `${horas}h ${minutos}min`;
}

async function subfaseCompletada(idSubfase) {
    const proyectoId = localStorage.getItem("proyectoId");
    try {
        const resultCompletada = await peticionSegura(`/fases/completa/${proyectoId}/${idSubfase}`);
        return resultCompletada || { success: false, data: null };
    } catch (e) {
        console.error("Error comprobando subfase completada:", e);
        return { success: false, data: null };
    }
}
