let vinculacionesGitlabActuales = [];

window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
    } else {
        const btnEditarTiempos = document.querySelector('a[href="editarestimaciones.html"]');
        if (btnEditarTiempos && !esAdmin()) {
            btnEditarTiempos.style.display = "none";
        }

        cargarDetallesTar();
    }
};

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}

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
            }),
            cargarVinculacionesGitlab(proyectoId)
        ]);

        if (result && result.success) {
            const espec = result.data;
            const tabla = document.getElementById("tablaEspec");
            const puedeVisualizarTareas = typeof esEmpleado === "function" ? !esEmpleado() : true;
            const claseItemDepto = puedeVisualizarTareas
                ? "item d-flex align-items-center justify-content-between gap-2"
                : "item item-solo-texto";

            const colDeptos = espec.map((p) => `
                <div class="${claseItemDepto}">
                    <div class="item-name">${p.nombreDepartamento}</div>
                    ${puedeVisualizarTareas ? `
                    <button class="btn btn-sm btn-outline-secondary" style="font-size:0.72rem;white-space:nowrap;"
                        onclick="irAVisualizarTareas(${p.id}, ${p.idDepartamento}, '${(p.nombreDepartamento || "").replace(/'/g, "\\'")}')">
                        Visualizar tareas
                    </button>
                    ` : ""}
                </div>
            `).join("");

            const colGitlab = espec.map((p) => {
                const vinculacion = obtenerVinculacionGitlab(p.idTareaProyecto);
                return `
                <div class="gitlab-item">
                    ${renderizarContenidoGitlab(vinculacion, p.numeroGitlab)}
                </div>`;
            }).join("");

            const colReal = espec.map((p) => {
                const tiempoRealValor = p.tiempoReal;
                let tiempoRealDisplay = "-";

                if (tiempoRealValor !== undefined && tiempoRealValor !== null) {
                    const numeroHoras = parseFloat(tiempoRealValor);
                    if (!isNaN(numeroHoras)) {
                        tiempoRealDisplay = formatoHoras(numeroHoras) + "h";
                    }
                }

                const displayGit = p.numeroGitlab ? `#${p.numeroGitlab}` : "-";

                return `
                <div class="time-item">
                    <div class="time-val text-primary fw-bold" style="font-size: 1.1rem;">${tiempoRealDisplay}</div>
                    <div class="time-lbl">${displayGit} - gitlab</div>
                </div>`;
            }).join("");

            const colMin = espec.map((p) => {
                const displayGit = p.numeroGitlab ? `#${p.numeroGitlab}` : "-";

                return `
                <div class="time-item">
                    <div class="time-val time-min">${p.tiempoMin}h</div>
                    <div class="time-lbl" style="color: #6c757d; font-weight: 600;">${displayGit} - gitlab</div>
                </div>`;
            }).join("");

            const colMax = espec.map((p) => {
                const displayGit = p.numeroGitlab ? `#${p.numeroGitlab}` : "-";

                return `
                <div class="time-item">
                    <div class="time-val time-max">${p.tiempoMax}h</div>
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
        } else {
            console.warn("Aviso:", result ? result.message : "Sin respuesta");
        }
    } catch (error) {
        console.error("Error en la llamada:", error);
    }
}

async function cargarVinculacionesGitlab(proyectoId) {
    if (!proyectoId) {
        vinculacionesGitlabActuales = [];
        return;
    }

    try {
        const result = await peticionSegura("/gitlab/vinculadas");

        if (!result || !result.success || !Array.isArray(result.data)) {
            vinculacionesGitlabActuales = [];
            return;
        }

        vinculacionesGitlabActuales = result.data
            .map(normalizarVinculacionGitlab)
            .filter((vinc) => vinc && String(vinc.idProyecto || "") === String(proyectoId));
    } catch (error) {
        vinculacionesGitlabActuales = [];
        console.error("No se pudieron cargar las vinculaciones de GitLab:", error);
    }
}

function normalizarVinculacionGitlab(vinc) {
    if (!vinc || typeof vinc !== "object") {
        return null;
    }

    const tareaProyecto = vinc.tareaProyecto && typeof vinc.tareaProyecto === "object"
        ? vinc.tareaProyecto
        : {};

    return {
        issueId: String(vinc.issueId || "").trim(),
        iidGitlab: vinc.iidGitlab != null ? Number(vinc.iidGitlab) : null,
        titulo: String(vinc.titulo || "").trim(),
        estado: String(vinc.estado || "").trim(),
        idTareaProyecto: tareaProyecto.idTareaProyecto != null ? Number(tareaProyecto.idTareaProyecto) : null,
        idProyecto: tareaProyecto.idProyecto != null ? Number(tareaProyecto.idProyecto) : null
    };
}

function obtenerVinculacionGitlab(idTareaProyecto) {
    return vinculacionesGitlabActuales.find(
        (vinc) => String(vinc.idTareaProyecto || "") === String(idTareaProyecto || "")
    ) || null;
}

function renderizarContenidoGitlab(vinculacion, numeroGitlab) {
    if (!vinculacion) {
        if (numeroGitlab) {
            return `
                <div class="gitlab-title">#${escaparHtml(numeroGitlab)}</div>
                <div class="gitlab-meta">
                    <span class="gitlab-empty">Pendiente de validar</span>
                </div>
            `;
        }

        return `
            <div class="gitlab-title gitlab-empty"></div>
            <div class="gitlab-meta">
                <span class="gitlab-empty">No hay una vinculacion valida en GitLab</span>
            </div>
        `;
    }

    const numero = vinculacion.iidGitlab != null ? `#${vinculacion.iidGitlab}` : (numeroGitlab ? `#${numeroGitlab}` : "#-");
    const titulo = vinculacion.titulo || "Tarea sin titulo";
    const estadoTexto = formatearEstadoGitlab(vinculacion.estado);
    const estadoClase = obtenerClaseEstadoGitlab(vinculacion.estado);

    return `
        <div class="gitlab-title">${escaparHtml(numero)} - ${escaparHtml(titulo)}</div>
        <div class="gitlab-meta">
            <span>${escaparHtml(vinculacion.issueId || "Issue registrada")}</span>
            <span class="gitlab-state ${estadoClase}">${escaparHtml(estadoTexto)}</span>
        </div>
    `;
}

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

function escaparHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

function irAVisualizarTareas(idDetalleEstimacion, idDepartamento, nombreDepartamento) {
    if (typeof esEmpleado === "function" && esEmpleado()) {
        alert("No tienes permisos para acceder a esta seccion.");
        return;
    }

    localStorage.setItem("idDetalleEstimacionVis", idDetalleEstimacion);
    localStorage.setItem("idDepartamentoVis", idDepartamento);
    localStorage.setItem("nombreDepartamentoVis", nombreDepartamento);
    window.location.href = "visualizartareas.html";
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
