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
let idExcelSeleccionadoActual = null;

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

    await cargarHistorialExcels(proyectoId);

    document.getElementById("input-busqueda").addEventListener("input", (e) => {
        renderizarTodo(e.target.value, estructuraActual, idsActuales);
    });
}

async function descargarExcelActual() {
    const token = localStorage.getItem("token");
    const btn = document.getElementById("btn-descargar-excel");
    const selectExcel = document.getElementById("select-historial-excel");
    const idExcel = idExcelSeleccionadoActual || selectExcel?.value;

    if (!idExcel) {
        mostrarToast("No hay ningun Excel seleccionado para descargar.", "error");
        return;
    }

    const textoOriginal = btn ? btn.innerHTML : "";

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
            Descargando...
        `;
    }

    try {
        const response = await fetch(`${URL_BASE}/excel/exportar/${encodeURIComponent(idExcel)}`, {
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
        const url = window.URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `Estimacion_Proyecto_${idExcel}.xlsx`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        window.URL.revokeObjectURL(url);

        mostrarToast("Excel descargado correctamente.", "success");
    } catch (error) {
        console.error("Error al descargar el Excel:", error);
        mostrarToast("No se pudo descargar el Excel.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    }
}

async function sincronizar() {
    const proyectoId = localStorage.getItem("proyectoId");
    const btn = document.getElementById("btn-sincronizar");
    const icon = document.getElementById("icon-sync");
    const texto = document.getElementById("texto-sincronizar");

    btn.disabled = true;
    texto.textContent = "Sincronizando...";
    icon.style.animation = "spin 1s linear infinite";
    icon.style.transformOrigin = "center";

    const result = await peticionSegura(`/clockify/sincronizar/${proyectoId}`, {
        method: "POST"
    });

    btn.disabled = false;
    texto.textContent = "Sincronizar";
    icon.style.animation = "";

    if (result && result.success) {
        const ahora = new Date().toISOString();
        localStorage.setItem(`ultima-sync-${proyectoId}`, ahora);
        mostrarUltimaSync(ahora);
        mostrarToast("Sincronizacion completada correctamente.", "success");

        if (typeof auditService !== "undefined" && auditService && auditService.registrar) {
            auditService.registrar("SINCRONIZACION", `Proyecto ${proyectoId} sincronizado.`, parseInt(proyectoId, 10));
        }
    } else {
        mostrarToast((result && result.mensaje) || "Error al sincronizar.", "error");
    }
}

function mostrarUltimaSync(isoString) {
    const fecha = new Date(isoString);
    const formateada = fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
        + " "
        + fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    document.getElementById("fecha-ultima-sync").textContent = formateada;
    document.getElementById("ultima-sincronizacion").style.display = "inline";
}

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

async function cargarHistorialExcels(proyectoId) {
    const select = document.getElementById("select-historial-excel");
    select.innerHTML = '<option value="">Cargando historial...</option>';

    const result = await peticionSegura(`/fases/historial/${proyectoId}`);

    if (!result || !result.success || !result.data || result.data.length === 0) {
        select.innerHTML = '<option value="">Sin historial</option>';
        idExcelSeleccionadoActual = null;
        return;
    }

    const excels = result.data;
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
    await cargarSubfases(proyectoId, idExcelSeleccionadoActual);
}

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
    renderizarTodo("", estructura, ids);
}

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
            const tiempos = resumenSubfases[idSub] || { tiempoRealTotal: 0, tiempoEstimadoMedia: 0 };
            const displayReal = formatoHoras(parseFloat(tiempos.tiempoRealTotal));
            const displayMedia = formatoHoras(parseFloat(tiempos.tiempoEstimadoMedia));

            htmlContent += `
                <div class="col-12 col-md-6 col-lg-3">
                    <div class="card subfase-card p-3 shadow-sm h-100" onclick="irASubfase('${sub}, ${idSub}')">
                        <div class="fw-bold text-dark">${sub}</div>
                        <div class="text-primary mt-2 fw-bold" style="font-size: 0.95rem;">
                            ${displayReal} / ${displayMedia}
                        </div>
                        <div class="text-muted small mt-2">Haga clic para ver tareas</div>
                    </div>
                </div>
            `;
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

function irASubfase(nombreSubfase) {
    const partes = nombreSubfase.split(",");
    const proyectoId = localStorage.getItem("proyectoId");

    localStorage.setItem("idSubfase", partes[1]);
    localStorage.setItem("subfaseSeleccionada", partes[0]);

    if (idExcelSeleccionadoActual) {
        localStorage.setItem(obtenerClaveExcelSeleccionado(proyectoId), idExcelSeleccionadoActual);
    }

    window.location.href = "subfase.html";
}

function obtenerClaveExcelSeleccionado(proyectoId) {
    return `idExcelHistorialSeleccionado-${proyectoId}`;
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}

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
