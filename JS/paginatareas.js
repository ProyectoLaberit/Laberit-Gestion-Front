let vinculacionesGitlabActuales = [];
let detallesTareaActuales = [];
let detallesSeleccionados = new Set();
let detallesPendientesEliminacion = [];
let puedeGestionarEstimacionesActual = false;
let modoEliminacion = false;

function setVinculacionesActuales(data){
    vinculacionesGitlabActuales = data;
}
function getVinculacionesActuales(){
    return vinculacionesGitlabActuales;
}

// Función de debug para verificar el estado de las vinculaciones
function debugVinculacionesGitlab() {
    console.log("===== DEBUG: Vinculaciones GitLab Actuales =====");
    console.log("Total de vinculaciones:", getVinculacionesActuales().length);
    console.log("Datos completos:", getVinculacionesActuales());
    return getVinculacionesActuales();
}

// Inicializa la pantalla, valida la sesion activa y carga el contexto
// principal necesario antes de que el usuario empiece a interactuar.
window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    puedeGestionarEstimacionesActual = typeof esAdmin === "function" && esAdmin();
    configurarControlesGestion();
    cargarDetallesTar();
};

// Muestra u oculta acciones de gestion segun los permisos del usuario actual.
function configurarControlesGestion() {
    const btnEditar = document.getElementById("btn-editar-estimaciones");
    const btnActivarEliminacion = document.getElementById("btn-activar-eliminacion");
    const accionesModoEliminacion = document.getElementById("acciones-modo-eliminacion");
    const toolbarSeleccion = document.getElementById("selection-toolbar");

    if (!puedeGestionarEstimacionesActual) {
        if (btnEditar) {
            btnEditar.style.display = "none";
        }
        if (btnActivarEliminacion) {
            btnActivarEliminacion.style.display = "none";
        }
        if (accionesModoEliminacion) {
            accionesModoEliminacion.style.display = "none";
        }
        if (toolbarSeleccion) {
            toolbarSeleccion.style.display = "none";
        }
        return;
    }

    actualizarModoEliminacionUI();
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}

// Carga las estimaciones de la tarea actual y actualiza toda la vista de detalle.
async function cargarDetallesTar() {
    const proyectoId = localStorage.getItem("proyectoId");
    const idSub = localStorage.getItem("idSubfase");
    const nombreTar = localStorage.getItem("nombreTarea");
    const idExcelElegido = localStorage.getItem(`idExcelHistorialSeleccionado-${proyectoId}`);

    const displayNombre = document.getElementById("tarea-nombre-display");
    if (displayNombre) {
        displayNombre.innerText = nombreTar ? nombreTar : "Detalle de Tarea";
    }

    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoActual = proyectos.find((p) => String(p.id) === String(proyectoId));
    document.getElementById("bc-proyecto").innerText = proyectoActual ? proyectoActual.nombre : "Proyecto";
    document.getElementById("bc-fase").innerText = localStorage.getItem("faseSeleccionada") || "Fase";
    document.getElementById("bc-subfase").innerText = localStorage.getItem("subfaseSeleccionada") || "Subfase";
    document.getElementById("bc-tarea").innerText = nombreTar || "Tarea";

    if (!proyectoId || !idSub) {
        console.error("Error: Falta el ID del proyecto o la subfase en el localStorage");
        return;
    }

    const parametros = new URLSearchParams();
    parametros.append("idSubfase", idSub);
    parametros.append("tarea", nombreTar);
    if (idExcelElegido) {
        parametros.append("idExcelElegido", idExcelElegido);
    }

    try {
        const [result] = await Promise.all([
            peticionSegura(`/estimaciones/proyecto/${proyectoId}/especifica`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: parametros
            })
        ]);

        if (result && result.success && Array.isArray(result.data)) {
            detallesTareaActuales = result.data;
            console.log("Detalles cargados:", result.data);
        } else {
            detallesTareaActuales = [];
            console.warn("Aviso:", result ? result.message : "Sin respuesta");
        }

        sincronizarSeleccionConDatos();
        renderizarTablaEspecifica();
        actualizarModoEliminacionUI();
    } catch (error) {
        detallesTareaActuales = [];
        renderizarTablaEspecifica();
        console.error("Error en la llamada:", error);
    }
}

// Pinta la vista detallada de estimaciones agrupadas por departamento.
function renderizarTablaEspecifica() {
    const tabla = document.getElementById("tablaEspec");
    if (!tabla) {
        return;
    }

    if (!Array.isArray(detallesTareaActuales) || detallesTareaActuales.length === 0) {
        tabla.innerHTML = `
            <div class="b-col">
                <div class="item item-solo-texto">
                    <div class="item-name text-muted">No hay estimaciones para esta tarea.</div>
                </div>
            </div>
            <div class="b-col">
                <div class="gitlab-item">
                    <div class="gitlab-meta">
                        <span class="gitlab-empty">-</span>
                    </div>
                </div>
            </div>
            <div class="b-col">
                <div class="time-item">
                    <div class="time-val">-</div>
                    <div class="time-lbl">&nbsp;</div>
                </div>
            </div>
            <div class="b-col">
                <div class="time-item">
                    <div class="time-val time-min">-</div>
                    <div class="time-lbl">&nbsp;</div>
                </div>
            </div>
            <div class="b-col">
                <div class="time-item">
                    <div class="time-val time-max">-</div>
                    <div class="time-lbl">&nbsp;</div>
                </div>
            </div>
        `;
        return;
    }

    const puedeVisualizarTareas = typeof esEmpleado === "function" ? !esEmpleado() : true;

    const colDeptos = detallesTareaActuales.map((p, index) => {
        const clave = obtenerClaveDetalle(p, index);
        const seleccionada = detallesSeleccionados.has(clave);
        const claseItem = seleccionada
            ? "item item-selected d-flex align-items-center justify-content-between gap-2"
            : "item d-flex align-items-center justify-content-between gap-2";
        const nombreDepartamento = escaparHtml(p.nombreDep || "Departamento");
        const nombreDepartamentoEscapado = escaparParaJs(p.nombreDep || "");

        if (modoEliminacion) {
            return `
                <div class="${claseItem}" onclick="toggleSeleccionDetalle('${clave}')">
                    <div class="item-name">${nombreDepartamento}</div>
                </div>
            `;
        }

        const claseNormal = puedeVisualizarTareas
            ? "item d-flex align-items-center justify-content-between gap-2"
            : "item item-solo-texto";

        return `
            <div class="${claseNormal}">
                <div class="item-name">${nombreDepartamento}</div>
                ${puedeVisualizarTareas ? `
                <button class="btn btn-sm btn-outline-secondary" style="font-size:0.72rem;white-space:nowrap;"
                    onclick="irAVisualizarTareas(${Number(p.idTarea)}, ${Number(p.idTarea)}, ${Number(p.idSubFase)}, '${nombreDepartamentoEscapado}')">  
                    Visualizar tareas
                </button>
                ` : ""}
            </div>
        `;
    }).join("");

    const colGitlab = detallesTareaActuales.map((p, index) => {
        const claseGitlab = detallesSeleccionados.has(obtenerClaveDetalle(p, index))
            ? "gitlab-item gitlab-item-selected"
            : "gitlab-item";

        return `
            <div class="${claseGitlab}">
                ${renderizarContenidoGitlab(p)}
            </div>`;
    }).join("");

    const colReal = detallesTareaActuales.map((p, index) => {
        const claseTiempo = detallesSeleccionados.has(obtenerClaveDetalle(p, index))
            ? "time-item time-item-selected"
            : "time-item";
        const tiempoRealValor = p.tiempoClockify;
        let tiempoRealDisplay = "-";

        if (tiempoRealValor !== undefined && tiempoRealValor !== null) {
            const numeroHoras = parseFloat(tiempoRealValor);
            if (!isNaN(numeroHoras)) {
                tiempoRealDisplay = formatoHoras(numeroHoras) + "h";
            }
        }

        const displayGit = p.numeroGit ? `#${escaparHtml(p.numeroGit)}` : "-";

        return `
            <div class="${claseTiempo}">
                <div class="time-val text-primary fw-bold" style="font-size: 1.1rem;">${tiempoRealDisplay}</div>
                <div class="time-lbl">${displayGit} - gitlab</div>
            </div>`;
    }).join("");

    const colMin = detallesTareaActuales.map((p, index) => {
        const claseTiempo = detallesSeleccionados.has(obtenerClaveDetalle(p, index))
            ? "time-item time-item-selected"
            : "time-item";
        const displayGit = p.numeroGit ? `#${escaparHtml(p.numeroGit)}` : "-";

        return `
            <div class="${claseTiempo}">
                <div class="time-val time-min">${escaparHtml(p.tiempoMin)}h</div>
                <div class="time-lbl" style="color: #6c757d; font-weight: 600;">${displayGit} - gitlab</div>
            </div>`;
    }).join("");

    const colMax = detallesTareaActuales.map((p, index) => {
        const claseTiempo = detallesSeleccionados.has(obtenerClaveDetalle(p, index))
            ? "time-item time-item-selected"
            : "time-item";
        const displayGit = p.numeroGit ? `#${escaparHtml(p.numeroGit)}` : "-";

        return `
            <div class="${claseTiempo}">
                <div class="time-val time-max">${escaparHtml(p.tiempoMax)}h</div>
                <div class="time-lbl" style="color: #6c757d; font-weight: 600;">${displayGit} - gitlab</div>
            </div>`;
    }).join("");

    tabla.innerHTML = `
        <div class="b-col">${colDeptos}</div>
        <div class="b-col">${colGitlab}</div>
        <div class="b-col">${colReal}</div>
        <div class="b-col">${colMin}</div>
        <div class="b-col">${colMax}</div>
    `;
}

// Activa el modo de seleccion multiple para poder borrar varios elementos.
function activarModoEliminacion() {
    if (!puedeGestionarEstimacionesActual) {
        return;
    }

    modoEliminacion = true;
    detallesSeleccionados.clear();
    renderizarTablaEspecifica();
    actualizarModoEliminacionUI();
}

// Sale del modo de eliminacion y limpia la seleccion actual.
function cancelarModoEliminacion() {
    modoEliminacion = false;
    detallesSeleccionados.clear();
    cerrarConfirmacionEliminacion();
    renderizarTablaEspecifica();
    actualizarModoEliminacionUI();
}

// Anade o quita una estimacion de la seleccion actual en modo eliminacion.
function toggleSeleccionDetalle(claveDetalle) {
    if (!modoEliminacion) {
        return;
    }

    if (detallesSeleccionados.has(claveDetalle)) {
        detallesSeleccionados.delete(claveDetalle);
    } else {
        detallesSeleccionados.add(claveDetalle);
    }

    renderizarTablaEspecifica();
    actualizarModoEliminacionUI();
}

// Sincroniza la interfaz con el estado actual del modo de eliminacion.
function actualizarModoEliminacionUI() {
    const toolbarSeleccion = document.getElementById("selection-toolbar");
    const btnEditar = document.getElementById("btn-editar-estimaciones");
    const btnActivarEliminacion = document.getElementById("btn-activar-eliminacion");
    const accionesModoEliminacion = document.getElementById("acciones-modo-eliminacion");
    const btnConfirmar = document.getElementById("btn-confirmar-eliminacion");
    const textoSeleccion = document.getElementById("texto-seleccion-estimaciones");

    if (!puedeGestionarEstimacionesActual) {
        return;
    }

    if (toolbarSeleccion) {
        toolbarSeleccion.classList.toggle("d-none", !modoEliminacion);
    }

    if (btnEditar) {
        btnEditar.classList.toggle("d-none", modoEliminacion);
    }

    if (btnActivarEliminacion) {
        btnActivarEliminacion.classList.toggle("d-none", modoEliminacion);
    }

    if (accionesModoEliminacion) {
        accionesModoEliminacion.classList.toggle("d-none", !modoEliminacion);
    }

    if (btnConfirmar) {
        btnConfirmar.disabled = detallesSeleccionados.size === 0;
        btnConfirmar.textContent = detallesSeleccionados.size > 0
            ? `Eliminar seleccionadas (${detallesSeleccionados.size})`
            : "Eliminar seleccionadas";
    }

    if (textoSeleccion) {
        if (!modoEliminacion) {
            textoSeleccion.textContent = "Haz clic en los departamentos que quieras borrar y confirma la eliminacion.";
        } else if (detallesSeleccionados.size === 0) {
            textoSeleccion.textContent = "Selecciona uno o varios departamentos para borrarlos.";
        } else {
            textoSeleccion.textContent = `${detallesSeleccionados.size} estimacion${detallesSeleccionados.size !== 1 ? "es" : ""} seleccionada${detallesSeleccionados.size !== 1 ? "s" : ""}.`;
        }
    }
}

// Conserva solo las selecciones que siguen existiendo tras recargar los datos.
function sincronizarSeleccionConDatos() {
    const clavesDisponibles = new Set(
        detallesTareaActuales.map((detalle, index) => obtenerClaveDetalle(detalle, index))
    );

    detallesSeleccionados = new Set(
        Array.from(detallesSeleccionados).filter((clave) => clavesDisponibles.has(clave))
    );
}

// Prepara el borrado de las estimaciones seleccionadas y abre la confirmacion.
function eliminarEstimacionesSeleccionadas() {
    if (!modoEliminacion || detallesSeleccionados.size === 0) {
        return;
    }

    const detallesAEliminar = detallesTareaActuales.filter((detalle, index) =>
        detallesSeleccionados.has(obtenerClaveDetalle(detalle, index))
    );

    if (detallesAEliminar.length === 0) {
        return;
    }

    abrirConfirmacionEliminacion(detallesAEliminar);
}

// Abre el dialogo de confirmacion y prepara los elementos pendientes de borrar.
function abrirConfirmacionEliminacion(detallesAEliminar) {
    const overlay = document.getElementById("delete-confirm-overlay");
    const texto = document.getElementById("delete-confirm-text");
    if (!overlay || !texto) {
        return;
    }

    detallesPendientesEliminacion = Array.isArray(detallesAEliminar) ? detallesAEliminar.slice() : [];
    if (detallesPendientesEliminacion.length === 0) {
        return;
    }

    texto.textContent = detallesPendientesEliminacion.length === 1
        ? `Seguro que quieres eliminar la estimacion del departamento "${detallesPendientesEliminacion[0].nombreDepartamento}"?`
        : `Seguro que quieres eliminar estas ${detallesPendientesEliminacion.length} estimaciones?`;

    overlay.classList.remove("d-none");
}

// Cierra el dialogo de confirmacion y limpia el estado temporal de borrado.
function cerrarConfirmacionEliminacion() {
    const overlay = document.getElementById("delete-confirm-overlay");
    const btnModalConfirmar = document.getElementById("btn-modal-confirmar-eliminacion");

    detallesPendientesEliminacion = [];

    if (overlay) {
        overlay.classList.add("d-none");
    }

    if (btnModalConfirmar) {
        btnModalConfirmar.disabled = false;
        btnModalConfirmar.textContent = "Eliminar";
    }
}

// Ejecuta el borrado de las estimaciones pendientes y recarga la vista al terminar.
async function confirmarEliminacionEstimaciones() {
    if (!Array.isArray(detallesPendientesEliminacion) || detallesPendientesEliminacion.length === 0) {
        cerrarConfirmacionEliminacion();
        return;
    }

    const btnConfirmar = document.getElementById("btn-confirmar-eliminacion");
    const btnModalConfirmar = document.getElementById("btn-modal-confirmar-eliminacion");
    const textoOriginal = btnConfirmar ? btnConfirmar.textContent : "";
    const textoModalOriginal = btnModalConfirmar ? btnModalConfirmar.textContent : "";

    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = "Eliminando...";
    }
    if (btnModalConfirmar) {
        btnModalConfirmar.disabled = true;
        btnModalConfirmar.textContent = "Eliminando...";
    }

    const errores = [];
    for (const detalle of detallesPendientesEliminacion) {
        const resultado = await eliminarUnaEstimacion(detalle.id);
        if (!resultado.success) {
            errores.push(detalle.nombreDepartamento || `ID ${detalle.id}`);
        }
    }

    if (btnConfirmar) {
        btnConfirmar.textContent = textoOriginal;
    }
    if (btnModalConfirmar) {
        btnModalConfirmar.textContent = textoModalOriginal;
    }

    if (errores.length > 0) {
        alert(`No se pudieron eliminar estas estimaciones: ${errores.join(", ")}`);
    }

    cerrarConfirmacionEliminacion();
    cancelarModoEliminacion();
    await cargarDetallesTar();
}

// Elimina una estimacion concreta y devuelve un resumen del resultado.
async function eliminarUnaEstimacion(idDetalleEstimacion) {
    if (!idDetalleEstimacion) {
        return { success: false };
    }

    const result = await peticionSegura(`/estimaciones/${idDetalleEstimacion}`, {
        method: "DELETE"
    });

    return {
        success: Boolean(result && result.success),
        result
    };
}

// Funciones auxiliares para renderización y utilidades


// Recupera la vinculacion de GitLab asociada a una tarea del proyecto.
function obtenerVinculacionGitlab(idTareaProyecto) {
    // Esta función ya no se usa, los datos vienen directamente en el objeto
    return null;
}

function renderizarContenidoGitlab(p) {
    const idTareaProyecto = p && p.idTarea != null ? String(p.idTarea) : "";
    const numeroGitActual = p && p.numeroGit != null ? String(p.numeroGit) : "";
    const botonVisualizar = `
        <button class="btn btn-sm btn-gitlab-view"
            onclick="irAVisualizarTareasGitlab('${escaparParaJs(idTareaProyecto)}', '${escaparParaJs(numeroGitActual)}')">
            Ver GitLab
        </button>
    `;
    if (!p || !p.numeroGit) {
        return `
            <div class="gitlab-title gitlab-empty"></div>
            <div class="gitlab-meta">
                <span class="gitlab-empty">No hay una vinculación válida en GitLab</span>
                ${botonVisualizar}
            </div>
        `;
    }

    const numero = p.numeroGit ? `#${p.numeroGit}` : "#-";
    const titulo = p.nombreTareaGit || "Tarea sin título";

    return `
        <div class="gitlab-linked-row">
            <div class="gitlab-title">${escaparHtml(numero)} - ${escaparHtml(titulo)}</div>
            ${botonVisualizar}
        </div>
    `;
}

// Traduce el estado de GitLab a una clase CSS usada para colorear el badge.
function obtenerClaseEstadoGitlab(estado) {
    const normalizado = String(estado || "").trim().toLowerCase();

    if (normalizado === "opened" || normalizado === "open") {
        return "gitlab-state-opened";
    }

    if (normalizado === "closed" || normalizado === "close") {
        return "gitlab-state-closed";
    }

    return "gitlab-state-other";
}

// Convierte el estado tecnico de GitLab a un texto mas legible para el usuario.
function formatearEstadoGitlab(estado) {
    const normalizado = String(estado || "").trim().toLowerCase();

    if (normalizado === "opened" || normalizado === "open") {
        return "Abierta";
    }

    if (normalizado === "closed" || normalizado === "close") {
        return "Cerrada";
    }

    if (!normalizado) {
        return "Sin estado";
    }

    return normalizado.replaceAll("_", " ");
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

// Genera una clave estable para identificar una estimacion dentro de la tabla.
function obtenerClaveDetalle(detalle, index) {
    if (detalle && detalle.idTarea != null) {
        return `detalle-${detalle.idTarea}-${detalle.nombreDep || "sin-dep"}`;
    }

    return `detalle-sin-id-${index}`;
}

// Guarda el contexto del departamento actual y abre la pantalla de visualizacion de imputaciones.
function irAVisualizarTareas(idDetalleEstimacion, idTareaProyecto, idDepartamento, nombreDepartamento) {
    if (typeof esEmpleado === "function" && esEmpleado()) {
        alert("No tienes permisos para acceder a esta seccion.");
        return;
    }

    localStorage.setItem("idTareaProyectoVis", idTareaProyecto);
    localStorage.setItem("idDetalleEstimacionVis", idDetalleEstimacion);
    localStorage.setItem("idDepartamentoVis", idDepartamento);
    localStorage.setItem("nombreDepartamentoVis", nombreDepartamento);
    window.location.href = "visualizartareas.html";
}

// Guarda el contexto de GitLab y abre la pantalla de control de issues del proyecto.
function irAVisualizarTareasGitlab(idTareaProyecto, numeroGit) {
    if (typeof esEmpleado === "function" && esEmpleado()) {
        alert("No tienes permisos para acceder a esta seccion.");
        return;
    }

    localStorage.setItem("idTareaProyectoGitlabVis", idTareaProyecto || "");
    localStorage.setItem("numeroGitlabVis", numeroGit || "");
    window.location.href = "visualizartareasgitlab.html";
}

// Convierte horas decimales a un formato mas legible para mostrarlo en pantalla.
function formatoHoras(decimal) {
    if (!decimal || isNaN(decimal)) {
        return "0";
    }

    const horas = Math.floor(decimal);
    const minutos = Math.round((decimal - horas) * 60);

    if (minutos === 0) {
        return horas.toString();
    }

    return `${horas}:${minutos.toString().padStart(2, "0")}`;
}
