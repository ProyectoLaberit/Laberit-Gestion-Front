let tareasSubfaseActuales = [];
let tareasCompletadas = new Map();
let tareasSeleccionadas = new Set();
let puedeGestionarTareasActual = false;
let modoEliminacion = false;
let tareasPendientesEliminacion = [];

// Inicializa la pantalla, valida la sesion activa y carga el contexto
// principal necesario antes de que el usuario empiece a interactuar.
window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    puedeGestionarTareasActual = typeof esAdmin === "function" && esAdmin();
    configurarControlesGestion();
    cargarDatosSubfase();
};

// Muestra u oculta acciones de gestion segun los permisos del usuario actual.
function configurarControlesGestion() {
    const btnAnadir = document.getElementById("btn-anadir-tarea");
    const btnActivarEliminacion = document.getElementById("btn-activar-eliminacion");
    const accionesModoEliminacion = document.getElementById("acciones-modo-eliminacion");
    const toolbarSeleccion = document.getElementById("selection-toolbar");

    if (!puedeGestionarTareasActual) {
        if (btnAnadir) {
            btnAnadir.style.display = "none";
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

// Carga las tareas de la subfase actual y actualiza la tabla principal.
async function cargarDatosSubfase() {
    const proyectoId = localStorage.getItem("proyectoId");
    const idSub = localStorage.getItem("idSubfase");
    const idExcelElegido = localStorage.getItem(`idExcelHistorialSeleccionado-${proyectoId}`);

    const nombreSub = localStorage.getItem("subfaseSeleccionada");
    const displayNombre = document.getElementById("subfase-nombre-display");
    if (displayNombre) {
        displayNombre.innerText = `Subfase: ${nombreSub || "Subfase " + idSub}`;
    }

    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoActual = proyectos.find((p) => String(p.id) === String(proyectoId));
    const nombreProyecto = proyectoActual ? proyectoActual.nombre : "Proyecto";
    const faseGuardada = localStorage.getItem("faseSeleccionada") || "";
    const nombreFase = resolverFaseBreadcrumb(faseGuardada, nombreSub);

    document.getElementById("bc-proyecto").innerText = nombreProyecto;
    document.getElementById("bc-fase").innerText = `Fase: ${nombreFase}`;

    if (!proyectoId || !idSub) {
        console.error("Error: Falta el ID del proyecto o la subfase en el localStorage");
        return;
    }

    const parametros = new URLSearchParams();
    parametros.append("idProyecto", proyectoId);
    parametros.append("idSubfase", idSub);
    if (idExcelElegido) {
        parametros.append("idExcelElegido", idExcelElegido);
    }

    try {
        const result = await peticionSegura("/estimaciones/subfase/tareas", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: parametros
        });

        if (!result || !result.success) {
            console.warn("Aviso del backend:", result ? result.message : "Sin respuesta");
            return;
        }

        tareasSubfaseActuales = Array.isArray(result.data) ? result.data : [];
        await cargarEstadosCompletado();
        sincronizarSeleccionConDatos();
        renderizarTablaTareas();
        actualizarModoEliminacionUI();
    } catch (error) {
        console.error("Error en la llamada:", error);
    }
}

// Pinta la tabla de tareas de la subfase respetando el modo normal o de eliminacion.
function renderizarTablaTareas() {
    const tabla = document.getElementById("tablaTar");
    if (!tabla) {
        return;
    }

    if (!tareasSubfaseActuales || tareasSubfaseActuales.length === 0) {
        tabla.innerHTML = `
            <div class="b-col">
                <div class="item">
                    <div class="item-name text-muted">No hay tareas en esta subfase.</div>
                </div>
            </div>
            <div class="b-col">
                <div class="est-item">
                    <div class="est-val">-</div>
                </div>
            </div>
            <div class="b-col">
                <div class="est-item">
                    <div class="est-val">-</div>
                </div>
            </div>`;
        return;
    }

    tabla.innerHTML = tareasSubfaseActuales.map((tarea, index) => {
        const clave = obtenerClaveTarea(tarea, index);
        const completada = tareasCompletadas.get(clave) === true;
        const nombreTarea = tarea.nombreTarea || "Sin nombre";
        const nombreTareaEscapado = escaparParaJs(nombreTarea);
        const seleccionada = tareasSeleccionadas.has(clave);
        const claseItem = seleccionada ? "item item-selected" : "item";
        const claseEst = seleccionada ? "est-item task-linked-selected" : "est-item";
        const tiempoEstimado = `${tarea.tiempoTotalMin} - ${tarea.tiempoTotalMax}`;

        let displayTiempo = "-";
        if (tarea.tiempoTotalReal !== undefined && tarea.tiempoTotalReal !== null) {
            const numeroHoras = parseFloat(tarea.tiempoTotalReal);
            if (!isNaN(numeroHoras)) {
                displayTiempo = formatoHoras(numeroHoras) + "h";
            }
        }

        let textoCompleta = " incompleta";
        if(completada){
            textoCompleta = " completa";
        }


        const accionNombre = modoEliminacion
            ? `onclick="toggleSeleccionTarea('${clave}')"`
            : `onclick="detalleTarea('${nombreTareaEscapado}')"`; 

        return `
            <div class="b-col">
                <div class="${claseItem}${textoCompleta}" ${accionNombre}>
                    <div class="item-name">${escaparHtml(nombreTarea)}</div>
                </div>
            </div>

            <div class="b-col">
                <div class="${claseEst}">
                    <div class="est-val">${escaparHtml(displayTiempo)}</div>
                </div>
            </div>

            <div class="b-col">
                <div class="${claseEst}">
                    <div class="est-val">${escaparHtml(tiempoEstimado)}</div>
                </div>
            </div>`;
    }).join("");
}

// Activa el modo de seleccion multiple para poder borrar varios elementos.
function activarModoEliminacion() {
    if (!puedeGestionarTareasActual) {
        return;
    }

    modoEliminacion = true;
    tareasSeleccionadas.clear();
    renderizarTablaTareas();
    actualizarModoEliminacionUI();
}

// Sale del modo de eliminacion y limpia la seleccion actual.
function cancelarModoEliminacion() {
    modoEliminacion = false;
    tareasSeleccionadas.clear();
    renderizarTablaTareas();
    actualizarModoEliminacionUI();
}

// Anade o quita una tarea de la seleccion actual en modo eliminacion.
function toggleSeleccionTarea(claveTarea) {
    if (!modoEliminacion) {
        return;
    }

    if (tareasSeleccionadas.has(claveTarea)) {
        tareasSeleccionadas.delete(claveTarea);
    } else {
        tareasSeleccionadas.add(claveTarea);
    }

    renderizarTablaTareas();
    actualizarModoEliminacionUI();
}

// Carga los estados de completado de las tareas actuales en un mapa sincronizable.
async function cargarEstadosCompletado() {
    tareasCompletadas.clear();
    if (!Array.isArray(tareasSubfaseActuales) || tareasSubfaseActuales.length === 0) {
        return;
    }

    const promesas = tareasSubfaseActuales.map((tarea, index) => {
        const clave = obtenerClaveTarea(tarea, index);
        return tareaCompleta(tarea.nombreTarea)
            .then((completada) => ({ clave, completada: Boolean(completada) }))
            .catch(() => ({ clave, completada: false }));
    });

    const resultados = await Promise.all(promesas);
    resultados.forEach(({ clave, completada }) => {
        tareasCompletadas.set(clave, completada);
    });
}

// Sincroniza la interfaz con el estado actual del modo de eliminacion.
function actualizarModoEliminacionUI() {
    const board = document.getElementById("board-tareas");
    const toolbarSeleccion = document.getElementById("selection-toolbar");
    const btnActivarEliminacion = document.getElementById("btn-activar-eliminacion");
    const accionesModoEliminacion = document.getElementById("acciones-modo-eliminacion");
    const btnConfirmar = document.getElementById("btn-confirmar-eliminacion");
    const textoSeleccion = document.getElementById("texto-seleccion-tareas");

    if (!puedeGestionarTareasActual) {
        return;
    }

    if (board) {
        board.classList.toggle("board-delete-mode", modoEliminacion);
    }

    if (toolbarSeleccion) {
        toolbarSeleccion.classList.toggle("d-none", !modoEliminacion);
    }

    if (btnActivarEliminacion) {
        btnActivarEliminacion.classList.toggle("d-none", modoEliminacion);
    }

    if (accionesModoEliminacion) {
        accionesModoEliminacion.classList.toggle("d-none", !modoEliminacion);
    }

    if (btnConfirmar) {
        btnConfirmar.disabled = tareasSeleccionadas.size === 0;
        btnConfirmar.textContent = tareasSeleccionadas.size > 0
            ? `Eliminar seleccionadas (${tareasSeleccionadas.size})`
            : "Eliminar seleccionadas";
    }

    if (textoSeleccion) {
        if (!modoEliminacion) {
            textoSeleccion.textContent = "Haz clic en las tareas que quieras borrar y confirma la eliminacion.";
        } else if (tareasSeleccionadas.size === 0) {
            textoSeleccion.textContent = "Selecciona una o varias tareas para borrarlas.";
        } else {
            textoSeleccion.textContent = `${tareasSeleccionadas.size} tarea${tareasSeleccionadas.size !== 1 ? "s" : ""} seleccionada${tareasSeleccionadas.size !== 1 ? "s" : ""}.`;
        }
    }
}

// Conserva solo las selecciones que siguen existiendo tras recargar los datos.
function sincronizarSeleccionConDatos() {
    const clavesDisponibles = new Set(
        tareasSubfaseActuales.map((tarea, index) => obtenerClaveTarea(tarea, index))
    );

    tareasSeleccionadas = new Set(
        Array.from(tareasSeleccionadas).filter((clave) => clavesDisponibles.has(clave))
    );
}

// Prepara el borrado de las tareas seleccionadas y abre la confirmacion.
async function eliminarTareasSeleccionadas() {
    if (!modoEliminacion || tareasSeleccionadas.size === 0) {
        return;
    }

    const tareasAEliminar = tareasSubfaseActuales.filter((tarea, index) =>
        tareasSeleccionadas.has(obtenerClaveTarea(tarea, index))
    );

    if (tareasAEliminar.length === 0) {
        return;
    }

    abrirConfirmacionEliminacion(tareasAEliminar);
}

// Abre el dialogo de confirmacion y prepara los elementos pendientes de borrar.
function abrirConfirmacionEliminacion(tareasAEliminar) {
    const overlay = document.getElementById("delete-confirm-overlay");
    const texto = document.getElementById("delete-confirm-text");
    if (!overlay || !texto) {
        return;
    }

    tareasPendientesEliminacion = Array.isArray(tareasAEliminar) ? tareasAEliminar.slice() : [];
    if (tareasPendientesEliminacion.length === 0) {
        return;
    }

    texto.textContent = tareasPendientesEliminacion.length === 1
        ? `Seguro que quieres eliminar la tarea "${tareasPendientesEliminacion[0].nombreTarea}"?`
        : `Seguro que quieres eliminar estas ${tareasPendientesEliminacion.length} tareas?`;

    overlay.classList.remove("d-none");
}

// Cierra el dialogo de confirmacion y limpia el estado temporal de borrado.
function cerrarConfirmacionEliminacion() {
    const overlay = document.getElementById("delete-confirm-overlay");
    const btnModalConfirmar = document.getElementById("btn-modal-confirmar-eliminacion");

    tareasPendientesEliminacion = [];

    if (overlay) {
        overlay.classList.add("d-none");
    }

    if (btnModalConfirmar) {
        btnModalConfirmar.disabled = false;
        btnModalConfirmar.textContent = "Eliminar";
    }
}

// Ejecuta el borrado de las tareas pendientes y refresca la subfase al finalizar.
async function confirmarEliminacionTareas() {
    if (!Array.isArray(tareasPendientesEliminacion) || tareasPendientesEliminacion.length === 0) {
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
    for (const tarea of tareasPendientesEliminacion) {
        const resultado = await eliminarUnaTarea(tarea.nombreTarea);
        if (!resultado.success) {
            errores.push(tarea.nombreTarea);
        }
    }

    if (btnConfirmar) {
        btnConfirmar.textContent = textoOriginal;
    }
    if (btnModalConfirmar) {
        btnModalConfirmar.textContent = textoModalOriginal;
    }

    if (errores.length > 0) {
        alert(`No se pudieron eliminar estas tareas: ${errores.join(", ")}`);
    }

    cerrarConfirmacionEliminacion();
    cancelarModoEliminacion();
    await cargarDatosSubfase();
}

// Elimina una tarea concreta de la subfase y devuelve el resultado de la operacion.
async function eliminarUnaTarea(nombreTarea) {
    const proyectoId = localStorage.getItem("proyectoId");
    const idSubfase = localStorage.getItem("idSubfase");
    const idExcelElegido = localStorage.getItem(`idExcelHistorialSeleccionado-${proyectoId}`);

    if (!proyectoId || !idSubfase || !nombreTarea) {
        return { success: false };
    }

    const query = new URLSearchParams({ nombreTarea });
    if (idExcelElegido) {
        query.append("idExcelElegido", idExcelElegido);
    }

    const result = await peticionSegura(
        `/estimaciones/proyecto/${proyectoId}/subfase/${idSubfase}/tarea?${query.toString()}`,
        { method: "DELETE" }
    );

    return {
        success: Boolean(result && result.success),
        result
    };
}

// Guarda la tarea seleccionada y abre la pantalla de detalle de estimaciones.
function detalleTarea(nombreTarea) {
    localStorage.setItem("nombreTarea", nombreTarea);
    window.location.href = "paginatareas.html";
}

// Navega a la pantalla donde se puede crear una tarea manualmente.
function abrirAnadirManual() {
    window.location.href = "creartarea.html";
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}

// Genera una clave estable para identificar una tarea dentro de la subfase.
function obtenerClaveTarea(tarea, index) {
    const idBase = tarea && tarea.idTarea != null ? String(tarea.idTarea) : `fila-${index}`;
    const nombreBase = normalizarNombreTarea(tarea && tarea.nombreTarea ? tarea.nombreTarea : "");
    return `${idBase}-${nombreBase}`;
}

// Normaliza normalizar nombre tarea para compararlo o reutilizarlo de forma consistente.
function normalizarNombreTarea(texto) {
    return String(texto || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
}

// Escapa texto para insertarlo de forma segura en codigo JavaScript inline.
function escaparParaJs(valor) {
    return String(valor || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}

// Escapa texto para insertarlo de forma segura dentro de HTML.
function escaparHtml(valor) {
    return String(valor || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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

async function tareaCompleta(nombreTarea) {

    const proyectoId = localStorage.getItem("proyectoId");
    const idSub = localStorage.getItem("idSubfase").trim();

    const resultCompletada = await peticionSegura(`/estimaciones/tarea/completa/${nombreTarea}/${proyectoId}/${idSub}`);
    if(resultCompletada.success){
        return true;
    }else{
        return false;
    }    
}
