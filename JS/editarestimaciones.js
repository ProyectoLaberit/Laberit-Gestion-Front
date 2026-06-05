let tareasGitlabDisponibles = [];
let vinculacionesGitlab = [];

// Inicializa la pantalla, valida la sesion activa y carga el contexto
// principal necesario antes de que el usuario empiece a interactuar.
window.onload = async function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    try {
        await Promise.all([cargarTareasGitlab(), cargarVinculacionesGitlab()]);
        await cargarDatosActuales();
    } catch (error) {
        console.error("Error al inicializar la pantalla:", error);
        mostrarFeedback("No se pudieron cargar los datos de la tarea.", "danger");
    }
};

// Carga las tareas de GitLab del proyecto actual y las normaliza para el front.
async function cargarTareasGitlab() {
    const proyectoId = localStorage.getItem("proyectoId");

    if (!proyectoId) {
        tareasGitlabDisponibles = [];
        return;
    }

    try {
        const result = await peticionSegura(`/gitlab/tareas/${proyectoId}`);

        if (!result || !result.success || !Array.isArray(result.data)) {
            tareasGitlabDisponibles = [];
            return;
        }

        tareasGitlabDisponibles = result.data
            .map(tarea => ({
                id: String(tarea.id || "").trim(),
                iid: tarea.iid != null ? Number(tarea.iid) : null,
                title: String(tarea.title || "").trim(),
                estado: String(tarea.estado || "").trim()
            }))
            .filter(tarea => tarea.id && tarea.title);
    } catch (error) {
        tareasGitlabDisponibles = [];
        console.error("No se pudieron cargar las tareas de GitLab:", error);
    }
}

// Carga las vinculaciones actuales de GitLab y se queda solo con las del proyecto abierto.
async function cargarVinculacionesGitlab() {
    const proyectoId = localStorage.getItem("proyectoId");

    if (!proyectoId) {
        vinculacionesGitlab = [];
        return;
    }

    try {
        const result = await peticionSegura("/gitlab/vinculadas");

        if (!result || !result.success || !Array.isArray(result.data)) {
            vinculacionesGitlab = [];
            return;
        }

        vinculacionesGitlab = result.data
            .map(vinc => normalizarVinculacionGitlab(vinc))
            .filter(vinc => vinc && String(vinc.idProyecto || "") === String(proyectoId));
    } catch (error) {
        vinculacionesGitlab = [];
        console.error("No se pudieron cargar las vinculaciones de GitLab:", error);
    }
}

// Normaliza la estructura de una vinculacion de GitLab para usarla con seguridad en el front.
function normalizarVinculacionGitlab(vinc) {
    if (!vinc || typeof vinc !== "object") {
        return null;
    }

    const tareaProyecto = vinc.tareaProyecto && typeof vinc.tareaProyecto === "object"
        ? vinc.tareaProyecto
        : {};

    return {
        idTareaGitlab: vinc.idTareaGitlab != null ? Number(vinc.idTareaGitlab) : null,
        issueId: String(vinc.issueId || "").trim(),
        iidGitlab: vinc.iidGitlab != null ? Number(vinc.iidGitlab) : null,
        titulo: String(vinc.titulo || "").trim(),
        estado: String(vinc.estado || "").trim(),
        url: String(vinc.url || "").trim(),
        idTareaProyecto: tareaProyecto.idTareaProyecto != null ? Number(tareaProyecto.idTareaProyecto) : null,
        idProyecto: tareaProyecto.idProyecto != null ? Number(tareaProyecto.idProyecto) : null
    };
}

// Carga del backend las estimaciones de la tarea actual y prepara su formulario de edicion.
async function cargarDatosActuales() {
    const proyectoId = localStorage.getItem("proyectoId");
    const idSubfase = localStorage.getItem("idSubfase");
    const nombreTarea = localStorage.getItem("nombreTarea") || "";

    actualizarTitulo(nombreTarea);

    if (!proyectoId || !idSubfase || !nombreTarea) {
        document.getElementById("contenedor-inputs").innerHTML = `
            <div class="alert alert-warning mb-0">Faltan datos para editar esta tarea.</div>
        `;
        return;
    }

    const parametros = new URLSearchParams();
    parametros.append("idSubfase", idSubfase);
    parametros.append("tarea", nombreTarea);

    try {
        const result = await peticionSegura(`/estimaciones/proyecto/${proyectoId}/especifica`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: parametros
        });

        if (!result || !result.success || !Array.isArray(result.data) || result.data.length === 0) {
            document.getElementById("contenedor-inputs").innerHTML = `
                <div class="alert alert-warning mb-0">No se encontraron estimaciones para esta tarea.</div>
            `;
            return;
        }

        pintarFormulario(result.data);
    } catch (error) {
        console.error("Error al cargar datos:", error);
        document.getElementById("contenedor-inputs").innerHTML = `
            <div class="alert alert-danger mb-0">Error al cargar los datos.</div>
        `;
    }
}

// Genera el formulario de edicion para cada departamento asociado a la tarea.
function pintarFormulario(estimaciones) {
    const contenedor = document.getElementById("contenedor-inputs");

    contenedor.innerHTML = estimaciones.map((est, index) => {
        const nombreDepartamento = est.nombreDep || "Departamento";
        const vinculacionActual = obtenerVinculacionActual(est.idTareaProyecto);
        const opcionesNoAsociadas = obtenerOpcionesNoAsociadas(vinculacionActual ? vinculacionActual.issueId : "");
        const selectDeshabilitado = opcionesNoAsociadas.length === 0 ? "disabled" : "";

        return `
            <div class="department-edit-row mb-4 p-3 border rounded bg-light">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <h5 class="fw-bold text-dark mb-0">${escaparHtml(nombreDepartamento)}</h5>
                    <span class="badge text-bg-secondary">${escaparHtml(est.tarea || "Tarea")}</span>
                </div>

                <input type="hidden" name="id-${index}" value="${est.idTarea}">
                <input type="hidden" name="idSubFase-${index}" value="${est.idSubFase || localStorage.getItem("idSubfase") || ""}">
                <input type="hidden" name="tareaActual-${index}" value="${escaparHtml(est.tarea || "")}">
                <input type="hidden" name="issueActual-${index}" value="${escaparHtml(vinculacionActual ? vinculacionActual.issueId : "")}">

                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label small">Tiempo minimo</label>
                        <input type="text" class="form-control" id="min-${index}" value="${est.tiempoMin ?? ""}">
                        <div class="invalid-feedback">Introduce un tiempo minimo valido.</div>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label small">Tiempo maximo</label>
                        <input type="text" class="form-control" id="max-${index}" value="${est.tiempoMax ?? ""}">
                        <div class="invalid-feedback">Introduce un tiempo maximo valido.</div>
                    </div>
                    <div class="col-md-6 d-flex align-items-end">
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="checkbox" id="tareaCompletada${index}" ${est.completada ? "checked" : ""}>
                            <label class="form-check-label fw-medium" for="tareaCompletada">
                                Tarea completada
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    if (typeof inicializarSelect2 === "function") {
        inicializarSelect2(contenedor);
    }
}

// Busca la vinculacion de GitLab que corresponde a la estimacion actual.
function obtenerVinculacionActual(idTareaProyecto) {
    return vinculacionesGitlab.find(vinc => String(vinc.idTareaProyecto || "") === String(idTareaProyecto || "")) || null;
}

// Devuelve solo las tareas de GitLab que todavia no estan ocupadas por otra vinculacion.
function obtenerOpcionesNoAsociadas(issueActualId) {
    const issuesOcupadas = new Set(
        vinculacionesGitlab
            .map(vinc => vinc.issueId)
            .filter(issueId => issueId && issueId !== issueActualId)
    );

    return tareasGitlabDisponibles.filter(tarea => !issuesOcupadas.has(tarea.id));
}

// Construye el texto visible de una tarea de GitLab usando numero y titulo.
function formatearTareaGitlab(tarea) {
    const iid = tarea.iid != null ? tarea.iid : tarea.iidGitlab;
    const titulo = tarea.title || tarea.titulo || "";
    return iid != null ? `#${iid} - ${titulo}` : titulo;
}

// Actualiza actualizar titulo segun el estado actual de la pantalla.
function actualizarTitulo(nombreTarea) {
    const titulo = document.getElementById("titulo-tarea");
    const nombreVisible = nombreTarea && nombreTarea.trim() ? nombreTarea.trim() : "Editar Estimaciones";
    titulo.innerText = nombreVisible === "Editar Estimaciones"
        ? nombreVisible
        : `Editando: ${nombreVisible}`;
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

// Convierte un valor de texto a numero aceptando comas como separador decimal.
function parsearNumero(valor) {
    if (typeof valor !== "string") {
        return Number.NaN;
    }

    return parseFloat(valor.replace(",", ".").trim());
}

// Limpia el estado visual de error del campo indicado.
function limpiarEstadoCampo(campo) {
    if (!campo) {
        return;
    }

    campo.classList.remove("is-invalid");
}

// Marca un campo como invalido para mostrar feedback inmediato al usuario.
function marcarCampoInvalido(campo) {
    if (!campo) {
        return;
    }

    campo.classList.add("is-invalid");
}

// Valida validar formulario antes de continuar con la accion actual.
function validarFormulario() {
    let formularioValido = true;

    document.querySelectorAll(".department-edit-row").forEach((row, index) => {
        const inputMin = document.getElementById(`min-${index}`);
        const inputMax = document.getElementById(`max-${index}`);

        limpiarEstadoCampo(inputMin);
        limpiarEstadoCampo(inputMax);

        const tiempoMin = parsearNumero(inputMin.value);
        const tiempoMax = parsearNumero(inputMax.value);

        if (Number.isNaN(tiempoMin) || tiempoMin < 0) {
            marcarCampoInvalido(inputMin);
            formularioValido = false;
        }

        if (Number.isNaN(tiempoMax) || tiempoMax < 0) {
            marcarCampoInvalido(inputMax);
            formularioValido = false;
        }

        if (!Number.isNaN(tiempoMin) && !Number.isNaN(tiempoMax) && tiempoMin > tiempoMax) {
            marcarCampoInvalido(inputMin);
            marcarCampoInvalido(inputMax);
            formularioValido = false;
        }
    });

    return formularioValido;
}

// Guarda los cambios de todas las estimaciones y sincroniza sus vinculaciones de GitLab.
async function actualizarEstimaciones() {
    if (!validarFormulario()) {
        mostrarFeedback("Revisa los tiempos antes de guardar.", "danger");
        return;
    }

    mostrarFeedback("Guardando...", "muted");
    const compl = document.getElementById("tareaCompletada");


    const filas = document.querySelectorAll(".department-edit-row");
    const datosActualizados = Array.from(filas).map((row, index) => ({
        id: Number(document.querySelector(`input[name="id-${index}"]`).value),
        tiempoMin: parsearNumero(document.getElementById(`min-${index}`).value),
        tiempoMax: parsearNumero(document.getElementById(`max-${index}`).value),
        completada: document.getElementById(`tareaCompletada${index}`).checked
    }));

    try {
        const peticionesEstimaciones = datosActualizados.map(dato => {
            return peticionSegura(`/estimaciones/${dato.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    tiempoMin: dato.tiempoMin,
                    tiempoMax: dato.tiempoMax,
                    completada: dato.completada
                })
            });
        });

        const resultadosEstimaciones = await Promise.all(peticionesEstimaciones);

        if (!resultadosEstimaciones.every(res => res && res.success)) {
            const primerErrorEstimacion = resultadosEstimaciones.find(res => !res || !res.success);
            const mensajeEstimacion = primerErrorEstimacion && (primerErrorEstimacion.mensaje || primerErrorEstimacion.message)
                ? (primerErrorEstimacion.mensaje || primerErrorEstimacion.message)
                : "Alguna fila fallo al guardar.";

            mostrarFeedback(mensajeEstimacion, "danger");
            return;
        }

        await sincronizarVinculacionesGitlab(datosActualizados);

        localStorage.setItem("nombreTarea", datosActualizados[0]?.tarea || localStorage.getItem("nombreTarea") || "");
        mostrarFeedback("Cambios guardados correctamente.", "success");
        setTimeout(() => {
            window.location.href = "paginatareas.html";
        }, 1500);
    } catch (error) {
        console.error("Error al guardar estimaciones:", error);
        mostrarFeedback("Error de conexion al guardar los cambios.", "danger");
    }
}

// Sincroniza en GitLab los cambios de asociacion elegidos en el formulario.
async function sincronizarVinculacionesGitlab(datosActualizados) {
    const cambios = datosActualizados.filter(dato => dato.issueNuevaId && dato.issueNuevaId !== dato.issueActualId);

    for (const cambio of cambios) {
        if (cambio.issueActualId) {
            const deleteResult = await peticionSegura(`/gitlab/vincular/${encodeURIComponent(cambio.issueActualId)}`, {
                method: "DELETE"
            });

            if (!deleteResult || !deleteResult.success) {
                throw new Error((deleteResult && deleteResult.mensaje) || "No se pudo eliminar la vinculacion anterior de GitLab.");
            }
        }

        const tareaSeleccionada = tareasGitlabDisponibles.find(tarea => tarea.id === cambio.issueNuevaId);
        if (!tareaSeleccionada) {
            throw new Error("No se encontro la tarea de GitLab seleccionada.");
        }

        const postResult = await peticionSegura(`/gitlab/vincular?idTareaProyecto=${encodeURIComponent(cambio.idTareaProyecto)}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: tareaSeleccionada.id,
                iid: tareaSeleccionada.iid,
                title: tareaSeleccionada.title,
                estado: tareaSeleccionada.estado,
                labels: []
            })
        });

        if (!postResult || !postResult.success) {
            throw new Error((postResult && postResult.mensaje) || "No se pudo crear la nueva vinculacion de GitLab.");
        }
    }
}

// Decide el nombre final de la tarea, priorizando el nombre editado si existe.
function obtenerNombreFinal(index) {
    const inputNuevoNombre = document.getElementById(`nuevo-nombre-${index}`);
    const nombreActual = document.querySelector(`input[name="tareaActual-${index}"]`).value || "";

    if (!inputNuevoNombre || inputNuevoNombre.disabled) {
        return nombreActual;
    }

    const nuevoNombre = inputNuevoNombre.value.trim();
    return nuevoNombre || nombreActual;
}

// Muestra un mensaje breve de estado asociado al formulario actual.
function mostrarFeedback(mensaje, tipo) {
    const feedback = document.getElementById("msg-feedback");
    feedback.className = `mt-3 text-center text-${tipo}`;
    feedback.innerText = mensaje;
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
