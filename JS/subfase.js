let tareasSubfaseActuales = [];
let tareasSeleccionadas = new Set();
let puedeGestionarTareasActual = false;
let modoEliminacion = false;
let tareasPendientesEliminacion = [];

window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    puedeGestionarTareasActual = typeof esAdmin === "function" && esAdmin();
    configurarControlesGestion();
    cargarDatosSubfase();
};

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

async function cargarDatosSubfase() {
    const proyectoId = localStorage.getItem("proyectoId");
    const idSub = localStorage.getItem("idSubfase");
    const idExcelElegido = localStorage.getItem(`idExcelHistorialSeleccionado-${proyectoId}`);

    const nombreSub = localStorage.getItem("subfaseSeleccionada");
    const displayNombre = document.getElementById("subfase-nombre-display");
    if (displayNombre) {
        displayNombre.innerText = nombreSub ? nombreSub : "Subfase " + idSub;
    }

    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoActual = proyectos.find((p) => String(p.id) === String(proyectoId));
    const nombreProyecto = proyectoActual ? proyectoActual.nombre : "Proyecto";
    const nombreFase = localStorage.getItem("faseSeleccionada") || "Fase";

    document.getElementById("bc-proyecto").innerText = nombreProyecto;
    document.getElementById("bc-fase").innerText = nombreFase;

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
        sincronizarSeleccionConDatos();
        renderizarTablaTareas();
        actualizarModoEliminacionUI();
    } catch (error) {
        console.error("Error en la llamada:", error);
    }
}

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

        const accionNombre = modoEliminacion
            ? `onclick="toggleSeleccionTarea('${clave}')"`
            : `onclick="detalleTarea('${nombreTareaEscapado}')"`; 

        return `
            <div class="b-col">
                <div class="${claseItem}" ${accionNombre}>
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

function activarModoEliminacion() {
    if (!puedeGestionarTareasActual) {
        return;
    }

    modoEliminacion = true;
    tareasSeleccionadas.clear();
    renderizarTablaTareas();
    actualizarModoEliminacionUI();
}

function cancelarModoEliminacion() {
    modoEliminacion = false;
    tareasSeleccionadas.clear();
    renderizarTablaTareas();
    actualizarModoEliminacionUI();
}

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

function sincronizarSeleccionConDatos() {
    const clavesDisponibles = new Set(
        tareasSubfaseActuales.map((tarea, index) => obtenerClaveTarea(tarea, index))
    );

    tareasSeleccionadas = new Set(
        Array.from(tareasSeleccionadas).filter((clave) => clavesDisponibles.has(clave))
    );
}

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

function detalleTarea(nombreTarea) {
    localStorage.setItem("nombreTarea", nombreTarea);
    window.location.href = "paginatareas.html";
}

function abrirAnadirManual() {
    window.location.href = "creartarea.html";
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}

function obtenerClaveTarea(tarea, index) {
    const idBase = tarea && tarea.idTarea != null ? String(tarea.idTarea) : `fila-${index}`;
    const nombreBase = normalizarNombreTarea(tarea && tarea.nombreTarea ? tarea.nombreTarea : "");
    return `${idBase}-${nombreBase}`;
}

function normalizarNombreTarea(texto) {
    return String(texto || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
}

function escaparParaJs(valor) {
    return String(valor || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}

function escaparHtml(valor) {
    return String(valor || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

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
