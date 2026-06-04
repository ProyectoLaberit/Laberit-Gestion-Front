let vinculacionesGitlabActuales = [];
let detallesTareaActuales = [];
let issuesGitlabInvalidas = [];
let detallesSeleccionados = new Set();
let detallesPendientesEliminacion = [];
let puedeGestionarEstimacionesActual = false;
let modoEliminacion = false;
let issuesGitlabModal = [];
let filtroGitlabModalActual = "invalidas";
let paginaGitlabModalActual = 1;
let contextoGitlabModalActual = null;
let issueGitlabSeleccionadaModal = null;
let issueGitlabEditandoModal = null;
const gitlabModalPorPagina = 8;

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
    const detallesPrevios = Array.isArray(detallesTareaActuales)
        ? detallesTareaActuales.slice()
        : [];
    const issuesPrevias = Array.isArray(issuesGitlabInvalidas)
        ? issuesGitlabInvalidas.slice()
        : [];
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
    const { faseBreadcrumb, subfaseBreadcrumb } = obtenerNivelesBreadcrumbTarea(nombreTar);
    document.getElementById("bc-proyecto").innerText = proyectoActual ? proyectoActual.nombre : "Proyecto";
    document.getElementById("bc-fase").innerText = `Fase: ${faseBreadcrumb}`;
    document.getElementById("bc-subfase").innerText = `Subfase: ${subfaseBreadcrumb}`;
    ocultarBreadcrumbDuplicado("bc-tarea");

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
        const [result, gitlabResult] = await Promise.all([
            peticionSegura(`/estimaciones/proyecto/${proyectoId}/especifica`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: parametros
            }),
            cargarIssuesGitlabInvalidas(proyectoId)
        ]);

        if (result && result.success && Array.isArray(result.data)) {
            detallesTareaActuales = result.data;
            console.log("Detalles cargados:", result.data);
        } else {
            detallesTareaActuales = detallesPrevios.length > 0 ? detallesPrevios : [];
            console.warn("Aviso:", result ? result.message : "Sin respuesta");
        }

        issuesGitlabInvalidas = Array.isArray(gitlabResult) ? gitlabResult : issuesPrevias;
        sincronizarSeleccionConDatos();
        renderizarTablaEspecifica();
        actualizarModoEliminacionUI();
    } catch (error) {
        detallesTareaActuales = detallesPrevios.length > 0 ? detallesPrevios : [];
        issuesGitlabInvalidas = issuesPrevias;
        renderizarTablaEspecifica();
        console.error("Error en la llamada:", error);
    }
}

// Resuelve los nombres reales que se muestran en la ruta superior de esta vista.
function obtenerNivelesBreadcrumbTarea(nombreTar) {
    const faseGuardada = localStorage.getItem("faseSeleccionada") || "";
    const subfaseGuardada = localStorage.getItem("subfaseSeleccionada") || "";
    const faseBreadcrumb = faseGuardada && faseGuardada !== "Fase"
        ? faseGuardada
        : subfaseGuardada || "Fase";
    const subfaseBreadcrumb = nombreTar || localStorage.getItem("nombreTarea") || "Subfase";

    return { faseBreadcrumb, subfaseBreadcrumb };
}

// Oculta el ultimo nivel cuando el nombre ya aparece como "Subfase: ...".
function ocultarBreadcrumbDuplicado(idElemento) {
    const elemento = document.getElementById(idElemento);
    if (elemento) {
        elemento.textContent = "";
        elemento.style.display = "none";
    }
}

// Recupera las issues de GitLab pendientes para mostrarlas en el desplegable de vinculacion.
async function cargarIssuesGitlabInvalidas(proyectoId) {
    if (!proyectoId) {
        return [];
    }

    try {
        const result = await peticionSegura(`/gitlab/vinculadas/todas/${proyectoId}`);

        if (!result || !result.success || !Array.isArray(result.data)) {
            return [];
        }

        return result.data
            .map(normalizarIssueGitlab)
            .filter(issue => issue.issueId && !issue.valida);
    } catch (error) {
        console.error("No se pudieron cargar las issues invalidas de GitLab:", error);
        return [];
    }
}

// Normaliza los nombres de campos que devuelve el backend para GitLab.
function normalizarIssueGitlab(issue) {
    return {
        issueId: String(issue.issueId || issue.id || "").trim(),
        numeroGitLab: issue.numeroGitLab ?? issue.numeroGitlab ?? issue.numeroGit ?? "",
        titulo: String(issue.titulo || issue.title || "Sin titulo").trim(),
        estado: String(issue.estado || "Sin estado").trim(),
        valida: issue.valida === true || issue.vinculada === true,
        tareaProyecto: issue.tareaProyecto ?? issue.idTareaProyecto ?? issue.idTarea ?? null
    };
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

    const puedeVisualizarTareas = true;

    const colDeptos = detallesTareaActuales.map((p, index) => {
        const clave = obtenerClaveDetalle(p, index);
        const seleccionada = detallesSeleccionados.has(clave);
        const claseItem = seleccionada
            ? "item item-selected d-flex align-items-center justify-content-between gap-2"
            : "item d-flex align-items-center justify-content-between gap-2";
        const nombreDepartamento = escaparHtml(p.nombreDep || "Departamento");
        const nombreDepartamentoEscapado = escaparParaJs(p.nombreDep || "");
        const idDepartamento = Number(p.idDepartamento ?? p.idSubFase);

        if (modoEliminacion) {
            return `
                <div class="${claseItem}" onclick="toggleSeleccionDetalle('${clave}')">
                    <div class="item-name">${nombreDepartamento}</div>
                </div>
            `;
        }

        const claseNormal = puedeVisualizarTareas
            ? "item item-clickable item-department-card"
            : "item item-solo-texto";
        const atributosClick = puedeVisualizarTareas
            ? `role="button" tabindex="0"
                onclick="irAVisualizarTareas(${Number(p.idTarea)}, ${Number(p.idTarea)}, ${idDepartamento}, '${nombreDepartamentoEscapado}')"
                onkeydown="irAVisualizarTareasConTeclado(event, ${Number(p.idTarea)}, ${Number(p.idTarea)}, ${idDepartamento}, '${nombreDepartamentoEscapado}')"`
            : "";

        return `
            <div class="${claseNormal}" ${atributosClick}>
                <div class="item-name">${nombreDepartamento}</div>
                ${puedeVisualizarTareas ? `<div class="item-card-hint">Visualizar imputaciones de Clockify</div>` : ""}
            </div>
        `;
    }).join("");

    const colGitlab = detallesTareaActuales.map((p, index) => {
        const idTareaProyecto = p && p.idTarea != null ? String(p.idTarea) : "";
        const numeroGitActual = p && p.numeroGit != null ? String(p.numeroGit) : "";
        const nombreIssueActual = p ? (p.nombreTareaGit || "") : "";
        const nombreDepartamento = p ? (p.nombreDep || p.nombreDepartamento || "") : "";
        const idDepartamento = p && p.idDepartamento != null ? String(p.idDepartamento) : "";
        const claseGitlab = detallesSeleccionados.has(obtenerClaveDetalle(p, index))
            ? "gitlab-item gitlab-item-selected"
            : "gitlab-item";
        const claseClickable = modoEliminacion ? claseGitlab : `${claseGitlab} gitlab-item-clickable`;
        const atributosClick = modoEliminacion
            ? ""
            : `role="button" tabindex="0"
                onclick="abrirModalIssuesGitlab('${escaparParaJs(idTareaProyecto)}', '${escaparParaJs(numeroGitActual)}', '${escaparParaJs(nombreDepartamento)}', '${escaparParaJs(nombreIssueActual)}', '${escaparParaJs(idDepartamento)}')"
                onkeydown="abrirModalIssuesGitlabConTeclado(event, '${escaparParaJs(idTareaProyecto)}', '${escaparParaJs(numeroGitActual)}', '${escaparParaJs(nombreDepartamento)}', '${escaparParaJs(nombreIssueActual)}', '${escaparParaJs(idDepartamento)}')"`;

        return `
            <div class="${claseClickable}" ${atributosClick}>
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
    if (!p || !p.numeroGit) {
        return `
            <div class="gitlab-title gitlab-empty"></div>
            <div class="gitlab-meta">
                <span class="gitlab-empty">No hay una vinculación válida en GitLab</span>
            </div>
            <div class="gitlab-card-hint">Haz clic para elegir una tarea del departamento</div>
        `;
    }

    const numero = p.numeroGit ? `#${p.numeroGit}` : "#-";
    const titulo = p.nombreTareaGit || "Tarea sin título";

    return `
        <div class="gitlab-linked-row">
            <div class="gitlab-title">${escaparHtml(numero)} - ${escaparHtml(titulo)}</div>
        </div>
        <div class="gitlab-card-hint">Visualizar las tareas de Gitlab</div>
    `;
}

// Ejecuta la vinculacion contra el backend y centraliza la validacion de respuesta.
async function vincularIssueGitlab(issueId, idTareaProyecto) {
    const result = await peticionSegura(
        `/gitlab/vincular/${encodeURIComponent(issueId)}?nuevoIdTareaProyecto=${encodeURIComponent(idTareaProyecto)}`,
        { method: "PUT" }
    );

    if (!result || !result.success) {
        throw new Error((result && result.mensaje) || "No se pudo vincular la issue.");
    }

    return result;
}

// Refleja la nueva vinculacion al instante para que la tabla no se vacie si la recarga tarda o falla.
function actualizarVinculacionGitlabLocal(issueId, idTareaProyecto, listaOrigen = []) {
    const listas = [listaOrigen, issuesGitlabModal, issuesGitlabInvalidas].filter(Array.isArray);
    const issue = listas
        .flat()
        .find(item => String(item.issueId) === String(issueId));

    if (!issue) {
        return;
    }

    detallesTareaActuales = detallesTareaActuales.map(detalle => {
        if (String(detalle.idTarea) !== String(idTareaProyecto)) {
            return detalle;
        }

        return {
            ...detalle,
            numeroGit: issue.numeroGitLab,
            nombreTareaGit: issue.titulo
        };
    });

    issuesGitlabInvalidas = issuesGitlabInvalidas.filter(item => String(item.issueId) !== String(issueId));
    renderizarTablaEspecifica();
}

// Permite abrir el modal de GitLab con teclado cuando el recuadro tiene el foco.
function abrirModalIssuesGitlabConTeclado(event, idTareaProyecto, numeroGit, nombreDepartamento, nombreIssueActual = "", idDepartamento = "") {
    if (event.key !== "Enter" && event.key !== " ") {
        return;
    }

    event.preventDefault();
    abrirModalIssuesGitlab(idTareaProyecto, numeroGit, nombreDepartamento, nombreIssueActual, idDepartamento);
}

// Abre la vista rapida de issues de GitLab sin salir de paginatareas.
async function abrirModalIssuesGitlab(idTareaProyecto, numeroGit, nombreDepartamento, nombreIssueActual = "", idDepartamento = "") {
    if (modoEliminacion) {
        return;
    }

    const modalElemento = document.getElementById("modalIssuesGitlab");
    if (!modalElemento) {
        return;
    }

    contextoGitlabModalActual = {
        idTareaProyecto: idTareaProyecto || "",
        numeroGit: numeroGit || "",
        nombreDepartamento: nombreDepartamento || "",
        idDepartamento: idDepartamento || "",
        nombreIssueActual: nombreIssueActual || ""
    };
    issuesGitlabModal = [];
    issueGitlabSeleccionadaModal = null;
    filtroGitlabModalActual = "invalidas";
    paginaGitlabModalActual = 1;

    actualizarCabeceraModalGitlab();
    actualizarIssueActualModalGitlab();
    actualizarSeleccionIssueGitlabModal();
    limpiarBusquedaModalGitlab();
    setEstadoCargaGitlabModal("Cargando issues de GitLab...");
    actualizarTabsGitlabModal();

    const modal = bootstrap.Modal.getInstance(modalElemento) || new bootstrap.Modal(modalElemento);
    modal.show();

    await cargarIssuesGitlabModal();
}

// Actualiza la cabecera del modal segun el departamento pulsado.
function actualizarCabeceraModalGitlab() {
    const departamentoTexto = document.getElementById("gitlab-modal-departamento");
    const departamento = contextoGitlabModalActual?.nombreDepartamento || "Departamento";

    if (departamentoTexto) {
        departamentoTexto.textContent = departamento;
    }
}

// Muestra la issue vinculada actualmente a la fila desde la que se abrio el modal.
function actualizarIssueActualModalGitlab() {
    const contenedor = document.getElementById("gitlab-modal-current-issue");

    if (!contenedor) {
        return;
    }

    const numeroActual = contextoGitlabModalActual?.numeroGit || "";
    let tituloActual = contextoGitlabModalActual?.nombreIssueActual || "";

    if (numeroActual && Array.isArray(issuesGitlabModal) && issuesGitlabModal.length > 0) {
        const encontrada = issuesGitlabModal.find(issue => String(issue.numeroGitLab) === String(numeroActual));
        if (encontrada) {
            tituloActual = encontrada.titulo || tituloActual;
            contextoGitlabModalActual.nombreIssueActual = tituloActual;
        }
    }

    if (!numeroActual) {
        contenedor.innerHTML = `
            <div>
                <div class="gitlab-modal-current-label">Tarea actual</div>
                <div class="gitlab-modal-current-empty">Sin tarea vinculada</div>
            </div>
            <div class="gitlab-modal-current-help">Selecciona una tarea de la lista para vincularla.</div>
        `;
        return;
    }

    contenedor.innerHTML = `
        <div>
            <div class="gitlab-modal-current-label">Tarea actual</div>
            <div class="gitlab-modal-current-title">
                <span>#${escaparHtml(numeroActual)}</span>
                ${escaparHtml(tituloActual || "Tarea sin titulo")}
            </div>
        </div>
        <div class="gitlab-modal-current-help">Selecciona la tarea para reemplazarla.</div>
    `;
}

// Limpia el buscador cada vez que se abre una tarjeta GitLab.
function limpiarBusquedaModalGitlab() {
    const input = document.getElementById("gitlab-modal-busqueda");
    if (input) {
        input.value = "";
    }
}

// Carga las issues visibles en el modal usando el mismo backend que visualizartareasgitlab.
async function cargarIssuesGitlabModal() {
    const proyectoId = localStorage.getItem("proyectoId");
    const idDepartamento = contextoGitlabModalActual?.idDepartamento || "";

    if (!proyectoId) {
        mostrarErrorGitlabModal("Falta el proyecto actual.");
        return;
    }

    const endpoint = idDepartamento
        ? `/gitlab/vinculadas/departamento/${encodeURIComponent(proyectoId)}/${encodeURIComponent(idDepartamento)}`
        : `/gitlab/vinculadas/todas/${encodeURIComponent(proyectoId)}`;

    try {
        const result = await peticionSegura(endpoint);
        const listaIssues = extraerListaIssuesGitlabModal(result);

        if (!Array.isArray(listaIssues)) {
            mostrarErrorGitlabModal((result && result.mensaje) || "No se pudieron cargar las issues de GitLab.");
            return;
        }

        issuesGitlabModal = listaIssues.map(normalizarIssueGitlab);
        paginaGitlabModalActual = 1;
        actualizarIssueActualModalGitlab();
        actualizarEstadisticasGitlabModal();
        renderPaginaGitlabModal();
    } catch (error) {
        console.error("Error al cargar issues de GitLab:", error);
        mostrarErrorGitlabModal("No se pudieron cargar las issues de GitLab.");
    }
}

// Soporta tanto ApiResponse como la lista directa del endpoint por departamento.
function extraerListaIssuesGitlabModal(result) {
    if (Array.isArray(result)) {
        return result;
    }

    if (result && result.success && Array.isArray(result.data)) {
        return result.data;
    }

    return null;
}

// Cambia el filtro activo del modal.
function setFiltroGitlabModal(filtro) {
    filtroGitlabModalActual = filtro;
    paginaGitlabModalActual = 1;
    actualizarTabsGitlabModal();
    renderPaginaGitlabModal();
}

// Actualiza el estado visual de los filtros del modal.
function actualizarTabsGitlabModal() {
    ["validas", "invalidas", "todas"].forEach(filtro => {
        const boton = document.getElementById(`gitlab-modal-tab-${filtro}`);
        if (boton) {
            boton.classList.toggle("active", filtro === filtroGitlabModalActual);
        }
    });
}

// Recalcula los contadores superiores del modal.
function actualizarEstadisticasGitlabModal() {
    const total = issuesGitlabModal.length;
    const validas = issuesGitlabModal.filter(issue => issue.valida).length;
    const invalidas = total - validas;

    setTextoSeguro("gitlab-modal-cnt-validas", validas);
    setTextoSeguro("gitlab-modal-cnt-invalidas", invalidas);
    setTextoSeguro("gitlab-modal-cnt-todas", total);
}

// Pinta la pagina actual del modal aplicando busqueda y filtro.
function renderPaginaGitlabModal() {
    actualizarEstadisticasGitlabModal();
    actualizarTabsGitlabModal();

    const busqueda = (document.getElementById("gitlab-modal-busqueda")?.value || "").toLowerCase().trim();
    const filtradas = issuesGitlabModal.filter(issue => {
        if (filtroGitlabModalActual === "validas" && !issue.valida) {
            return false;
        }

        if (filtroGitlabModalActual === "invalidas" && issue.valida) {
            return false;
        }

        if (busqueda) {
            const texto = `${issue.issueId} ${issue.numeroGitLab} ${issue.titulo} ${issue.estado}`.toLowerCase();
            return texto.includes(busqueda);
        }

        return true;
    });

    const total = filtradas.length;
    const totalPaginas = Math.max(1, Math.ceil(total / gitlabModalPorPagina));

    if (paginaGitlabModalActual > totalPaginas) {
        paginaGitlabModalActual = totalPaginas;
    }

    const inicio = (paginaGitlabModalActual - 1) * gitlabModalPorPagina;
    const pagina = filtradas.slice(inicio, inicio + gitlabModalPorPagina);

    renderTablaGitlabModal(pagina, inicio, total);
    renderPaginacionGitlabModal(total, totalPaginas);
}

// Renderiza las filas de issues del modal. La vinculacion se decide seleccionando una fila.
function renderTablaGitlabModal(filas, inicio, total) {
    const tbody = document.getElementById("gitlab-modal-tabla");

    if (!tbody) {
        return;
    }

    if (!filas.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="gitlab-modal-empty">No hay issues de GitLab que coincidan.</td></tr>`;
        setTextoSeguro("gitlab-modal-pag-info", "Sin resultados");
        return;
    }

    tbody.innerHTML = filas.map(issue => {
        const esActual = esIssueActualGitlabModal(issue);
        const esSeleccionada = issueGitlabSeleccionadaModal && String(issueGitlabSeleccionadaModal.issueId) === String(issue.issueId);
        const puedeSeleccionar = puedeGestionarEstimacionesActual && contextoGitlabModalActual?.idTareaProyecto && issue.issueId;
        const estadoDot = issue.valida ? renderEstadoDotGitlabModal(true) : renderEstadoDotGitlabModal(false);
        const numeroIssue = issue.numeroGitLab ? `#${escaparHtml(issue.numeroGitLab)}` : escaparHtml(issue.issueId || "-");
        const claseEstado = obtenerClaseEstadoGitlab(issue.estado);
        const textoEstado = formatearEstadoGitlab(issue.estado);
        const vinculacion = esActual ? "Actual" : issue.valida ? "Valida" : "Pendiente";
        const claseVinculacion = esActual ? "text-primary fw-semibold" : issue.valida ? "text-success fw-semibold" : "text-danger fw-semibold";
        const clasesFila = [
            puedeSeleccionar ? "gitlab-modal-row-selectable" : "",
            esActual ? "gitlab-modal-row-current" : "",
            esSeleccionada ? "gitlab-modal-row-selected" : ""
        ].filter(Boolean).join(" ");
        const atributosSeleccion = puedeSeleccionar
            ? `role="button" tabindex="0"
                onclick="seleccionarIssueGitlabModal('${escaparParaJs(issue.issueId)}')"
                onkeydown="seleccionarIssueGitlabModalConTeclado(event, '${escaparParaJs(issue.issueId)}')"`
            : "";

        return `
            <tr class="${clasesFila}" ${atributosSeleccion}>
                <td>${estadoDot}</td>
                <td class="fw-semibold">${numeroIssue}</td>
                <td class="gitlab-modal-issue-title">${escaparHtml(issue.titulo)}</td>
                <td><span class="gitlab-modal-state-badge ${claseEstado}">${escaparHtml(textoEstado)}</span></td>
                <td class="${claseVinculacion}">${vinculacion}</td>
            </tr>
        `;
    }).join("");

    setTextoSeguro(
        "gitlab-modal-pag-info",
        `Mostrando ${inicio + 1} a ${Math.min(inicio + filas.length, total)} de ${total} issues`
    );
}

// Comprueba si una fila del modal representa la issue vinculada actualmente.
function esIssueActualGitlabModal(issue) {
    const numeroActual = contextoGitlabModalActual?.numeroGit || "";
    return Boolean(numeroActual && issue?.numeroGitLab && String(issue.numeroGitLab) === String(numeroActual));
}

// Selecciona una issue candidata para vincularla o reemplazar la actual.
function seleccionarIssueGitlabModal(issueId) {
    const issue = issuesGitlabModal.find(item => String(item.issueId) === String(issueId));

    if (!issue || !puedeGestionarEstimacionesActual) {
        return;
    }

    if (issueGitlabSeleccionadaModal && String(issueGitlabSeleccionadaModal.issueId) === String(issue.issueId)) {
        limpiarSeleccionIssueGitlabModal();
        return;
    }

    issueGitlabSeleccionadaModal = issue;
    actualizarSeleccionIssueGitlabModal();
    renderPaginaGitlabModal();
}

// Permite seleccionar una issue con Enter o espacio.
function seleccionarIssueGitlabModalConTeclado(event, issueId) {
    if (event.key !== "Enter" && event.key !== " ") {
        return;
    }

    event.preventDefault();
    seleccionarIssueGitlabModal(issueId);
}

// Limpia la issue seleccionada en el modal.
function limpiarSeleccionIssueGitlabModal() {
    issueGitlabSeleccionadaModal = null;
    actualizarSeleccionIssueGitlabModal();
    renderPaginaGitlabModal();
}

// Actualiza la banda inferior que confirma la vinculacion/reemplazo.
function actualizarSeleccionIssueGitlabModal() {
    const contenedor = document.getElementById("gitlab-modal-selection");
    const titulo = document.getElementById("gitlab-modal-selection-title");
    const btnEditar = document.getElementById("gitlab-modal-selection-edit");
    const btnBorrar = document.getElementById("gitlab-modal-selection-delete");
    const btnDesvincular = document.getElementById("gitlab-modal-selection-unlink");
    const btnVincular = document.getElementById("gitlab-modal-selection-link");

    if (!contenedor) {
        return;
    }

    if (!issueGitlabSeleccionadaModal) {
        contenedor.classList.add("d-none");
        [btnEditar, btnBorrar, btnDesvincular, btnVincular].forEach(restaurarBotonAccionGitlabModal);
        return;
    }

    const esActual = esIssueActualGitlabModal(issueGitlabSeleccionadaModal);
    const numero = issueGitlabSeleccionadaModal.numeroGitLab
        ? `#${issueGitlabSeleccionadaModal.numeroGitLab}`
        : issueGitlabSeleccionadaModal.issueId;
    const accion = esActual
        ? "Issue actual"
        : contextoGitlabModalActual?.numeroGit
            ? "Seleccionada para reemplazar"
            : "Seleccionada para vincular";

    contenedor.classList.remove("d-none");

    if (titulo) {
        titulo.textContent = `${accion}: ${numero} - ${issueGitlabSeleccionadaModal.titulo}`;
    }

    [btnEditar, btnBorrar, btnDesvincular, btnVincular].forEach(restaurarBotonAccionGitlabModal);

    if (btnDesvincular) {
        btnDesvincular.classList.toggle("d-none", !issueGitlabSeleccionadaModal.valida);
    }

    if (btnVincular) {
        btnVincular.classList.toggle("d-none", esActual);
        btnVincular.textContent = contextoGitlabModalActual?.numeroGit ? "Reemplazar actual" : "Vincular";
    }
}

// Restaura el estado visual de un boton de accion del modal.
function restaurarBotonAccionGitlabModal(boton) {
    if (!boton) {
        return;
    }

    boton.disabled = false;
    if (boton.dataset.textoOriginal) {
        boton.textContent = boton.dataset.textoOriginal;
    }
    delete boton.dataset.confirmarBorrado;
}

// Vincula o reemplaza la issue seleccionada con la tarea actual.
async function vincularIssueSeleccionadaGitlabModal(boton) {
    if (!issueGitlabSeleccionadaModal) {
        return;
    }

    await reemplazarIssueGitlabDesdeModal(issueGitlabSeleccionadaModal.issueId, boton);
}

// Reemplaza la issue vinculada a la tarea actual desde el modal.
async function reemplazarIssueGitlabDesdeModal(issueId, boton) {
    const idTareaProyecto = contextoGitlabModalActual?.idTareaProyecto || "";
    const issue = issuesGitlabModal.find(item => String(item.issueId) === String(issueId));

    if (!issue || !idTareaProyecto || esIssueActualGitlabModal(issue)) {
        return;
    }

    await ejecutarAccionIssueGitlabModal({
        boton,
        textoCargando: contextoGitlabModalActual?.numeroGit ? "Reemplazando..." : "Vinculando...",
        accion: () => vincularIssueGitlab(issueId, idTareaProyecto),
        despues: () => {
            actualizarVinculacionGitlabLocal(issueId, idTareaProyecto, issuesGitlabModal);
            contextoGitlabModalActual.numeroGit = issue.numeroGitLab ? String(issue.numeroGitLab) : "";
            contextoGitlabModalActual.nombreIssueActual = issue.titulo || "";
        }
    });
}

// Desvincula la issue seleccionada sin borrarla de la base local.
async function desvincularIssueSeleccionadaGitlabModal(boton) {
    if (!issueGitlabSeleccionadaModal) {
        return;
    }

    await ejecutarAccionIssueGitlabModal({
        boton,
        textoCargando: "Desvinculando...",
        accion: () => peticionSegura(`/gitlab/desvincular/${encodeURIComponent(issueGitlabSeleccionadaModal.issueId)}`, {
            method: "PUT"
        }),
        despues: () => {
            if (esIssueActualGitlabModal(issueGitlabSeleccionadaModal)) {
                contextoGitlabModalActual.numeroGit = "";
                contextoGitlabModalActual.nombreIssueActual = "";
            }
        }
    });
}

// Borra definitivamente la issue seleccionada de la base local.
async function borrarIssueSeleccionadaGitlabModal(boton) {
    if (!issueGitlabSeleccionadaModal) {
        return;
    }

    if (boton && boton.dataset.confirmarBorrado !== "true") {
        boton.dataset.textoOriginal = boton.textContent;
        boton.dataset.confirmarBorrado = "true";
        boton.textContent = "Confirmar borrado";
        return;
    }

    await ejecutarAccionIssueGitlabModal({
        boton,
        textoCargando: "Borrando...",
        accion: () => peticionSegura(`/gitlab/borrar/${encodeURIComponent(issueGitlabSeleccionadaModal.issueId)}`, {
            method: "DELETE"
        }),
        despues: () => {
            if (esIssueActualGitlabModal(issueGitlabSeleccionadaModal)) {
                contextoGitlabModalActual.numeroGit = "";
                contextoGitlabModalActual.nombreIssueActual = "";
            }
        }
    });
}

// Abre una ventana propia para editar el titulo local de una issue GitLab.
function editarIssueSeleccionadaGitlabModal() {
    if (!issueGitlabSeleccionadaModal) {
        return;
    }

    issueGitlabEditandoModal = issueGitlabSeleccionadaModal;

    const modal = document.getElementById("gitlab-edit-issue-modal");
    const inputIssue = document.getElementById("gitlab-edit-issue-number");
    const inputTitulo = document.getElementById("gitlab-edit-issue-title-input");

    if (!modal || !inputTitulo) {
        return;
    }

    const numero = issueGitlabEditandoModal.numeroGitLab
        ? `#${issueGitlabEditandoModal.numeroGitLab}`
        : issueGitlabEditandoModal.issueId;

    if (inputIssue) {
        inputIssue.value = numero || "";
    }

    inputTitulo.value = issueGitlabEditandoModal.titulo || "";
    modal.classList.remove("d-none");

    setTimeout(() => {
        inputTitulo.focus();
        inputTitulo.select();
    }, 0);
}

// Cierra la ventana de edicion de issue y limpia su estado temporal.
function cerrarModalEdicionIssueGitlab() {
    const modal = document.getElementById("gitlab-edit-issue-modal");
    const guardar = document.getElementById("gitlab-edit-issue-save");

    if (modal) {
        modal.classList.add("d-none");
    }

    if (guardar) {
        guardar.disabled = false;
        guardar.textContent = "Guardar";
    }

    issueGitlabEditandoModal = null;
}

// Guarda el titulo editado usando el endpoint de GitLab.
async function guardarEdicionIssueGitlabModal(boton) {
    const inputTitulo = document.getElementById("gitlab-edit-issue-title-input");

    if (!issueGitlabEditandoModal || !inputTitulo) {
        return;
    }

    const tituloActual = issueGitlabEditandoModal.titulo || "";
    const nuevoTitulo = inputTitulo.value.trim();

    if (!nuevoTitulo) {
        alert("El titulo de la issue no puede estar vacio.");
        inputTitulo.focus();
        return;
    }

    if (nuevoTitulo === tituloActual) {
        cerrarModalEdicionIssueGitlab();
        return;
    }

    const textoOriginal = boton ? boton.textContent : "";
    if (boton) {
        boton.disabled = true;
        boton.textContent = "Guardando...";
    }

    try {
        const issueEditada = issueGitlabEditandoModal;
        const result = await peticionSegura(`/gitlab/issue/${encodeURIComponent(issueEditada.issueId)}/titulo`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ titulo: nuevoTitulo.trim() })
        });

        if (!result || result.success === false) {
            throw new Error((result && (result.mensaje || result.message)) || "No se pudo actualizar el titulo.");
        }

        issueEditada.titulo = nuevoTitulo;
        if (issueGitlabSeleccionadaModal && String(issueGitlabSeleccionadaModal.issueId) === String(issueEditada.issueId)) {
            issueGitlabSeleccionadaModal.titulo = nuevoTitulo;
        }

        if (esIssueActualGitlabModal(issueEditada)) {
            contextoGitlabModalActual.nombreIssueActual = nuevoTitulo;
        }

        cerrarModalEdicionIssueGitlab();
        actualizarIssueActualModalGitlab();
        actualizarSeleccionIssueGitlabModal();
        await cargarDetallesTar();
        await cargarIssuesGitlabModal();
    } catch (error) {
        console.error("Error al editar titulo de issue GitLab:", error);
        alert(error.message || "No se pudo actualizar el titulo de la issue.");

        if (boton) {
            boton.disabled = false;
            boton.textContent = textoOriginal || "Guardar";
        }
    }
}

// Ejecuta una accion contra GitLab y refresca tabla, modal y contexto.
async function ejecutarAccionIssueGitlabModal({ boton, textoCargando, accion, despues }) {
    const textoOriginal = boton ? boton.textContent : "";

    if (boton) {
        boton.dataset.textoOriginal = textoOriginal;
        boton.disabled = true;
        boton.textContent = textoCargando;
    }

    try {
        const result = await accion();

        if (!result || result.success === false) {
            throw new Error((result && (result.mensaje || result.message)) || "No se pudo completar la accion.");
        }

        if (typeof despues === "function") {
            despues(result);
        }

        issueGitlabSeleccionadaModal = null;
        actualizarIssueActualModalGitlab();
        actualizarSeleccionIssueGitlabModal();
        await cargarDetallesTar();
        await cargarIssuesGitlabModal();
    } catch (error) {
        console.error("Error en accion de GitLab:", error);
        alert(error.message || "No se pudo completar la accion de GitLab.");
        restaurarBotonAccionGitlabModal(boton);
    }
}

// Dibuja el icono de estado usado en la tabla GitLab.
function renderEstadoDotGitlabModal(esValida) {
    return esValida
        ? `
            <div class="gitlab-modal-status-dot gitlab-modal-status-ok">
                <svg width="13" height="13" fill="none" stroke="#16a34a" stroke-width="2.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="9 12 11 14 15 10"></polyline>
                </svg>
            </div>
        `
        : `
            <div class="gitlab-modal-status-dot gitlab-modal-status-err">
                <svg width="13" height="13" fill="none" stroke="#dc2626" stroke-width="2.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            </div>
        `;
}

// Genera la paginacion del modal.
function renderPaginacionGitlabModal(total, totalPaginas) {
    const contenedor = document.getElementById("gitlab-modal-pag-btns");
    if (!contenedor) {
        return;
    }

    contenedor.innerHTML = "";

    const prev = crearPagBtnGitlabModal("<", paginaGitlabModalActual === 1, () => {
        paginaGitlabModalActual--;
        renderPaginaGitlabModal();
    });
    contenedor.appendChild(prev);

    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        const btn = crearPagBtnGitlabModal(pagina, false, () => {
            paginaGitlabModalActual = pagina;
            renderPaginaGitlabModal();
        });

        if (pagina === paginaGitlabModalActual) {
            btn.classList.add("active");
        }

        contenedor.appendChild(btn);
    }

    const next = crearPagBtnGitlabModal(">", paginaGitlabModalActual === totalPaginas || total === 0, () => {
        paginaGitlabModalActual++;
        renderPaginaGitlabModal();
    });
    contenedor.appendChild(next);
}

// Crea un boton de paginacion para el modal GitLab.
function crearPagBtnGitlabModal(label, disabled, onClick) {
    const btn = document.createElement("button");
    btn.className = "gitlab-modal-pag-btn";
    btn.textContent = label;
    btn.disabled = disabled;

    if (!disabled) {
        btn.addEventListener("click", onClick);
    }

    return btn;
}

// Muestra un estado temporal de carga en la tabla del modal.
function setEstadoCargaGitlabModal(texto) {
    const tbody = document.getElementById("gitlab-modal-tabla");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="gitlab-modal-empty">
                    <div class="spinner-border spinner-border-sm me-2"></div>${escaparHtml(texto)}
                </td>
            </tr>
        `;
    }

    setTextoSeguro("gitlab-modal-pag-info", "Cargando...");
    renderPaginacionGitlabModal(0, 1);
}

// Muestra un error de carga en el modal.
function mostrarErrorGitlabModal(mensaje) {
    issuesGitlabModal = [];
    actualizarEstadisticasGitlabModal();

    const tbody = document.getElementById("gitlab-modal-tabla");
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" class="gitlab-modal-empty text-danger">${escaparHtml(mensaje)}</td></tr>`;
    }

    setTextoSeguro("gitlab-modal-pag-info", "Sin resultados");
    renderPaginacionGitlabModal(0, 1);
}

// Asigna texto si el elemento existe.
function setTextoSeguro(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = valor;
    }
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
    localStorage.setItem("idTareaProyectoVis", idTareaProyecto);
    localStorage.setItem("idDetalleEstimacionVis", idDetalleEstimacion);
    localStorage.setItem("idDepartamentoVis", idDepartamento);
    localStorage.setItem("nombreDepartamentoVis", nombreDepartamento);
    window.location.href = "visualizartareas.html";
}

// Permite abrir visualizartareas.html con Enter o espacio desde la tarjeta del departamento.
function irAVisualizarTareasConTeclado(event, idDetalleEstimacion, idTareaProyecto, idDepartamento, nombreDepartamento) {
    if (event.key !== "Enter" && event.key !== " ") {
        return;
    }

    event.preventDefault();
    irAVisualizarTareas(idDetalleEstimacion, idTareaProyecto, idDepartamento, nombreDepartamento);
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
