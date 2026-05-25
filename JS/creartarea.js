let departamentosDisponibles = [];
let departamentosSeleccionados = [];

// Inicializa la pantalla, valida la sesion activa y carga el contexto
// principal necesario antes de que el usuario empiece a interactuar.
window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    document.addEventListener("click", manejarClickFueraDropdown);
    cargarDepartamentos();
    mostrarContexto();
};

// Carga el contexto de proyecto, fase y subfase que se muestra en la cabecera.
async function mostrarContexto() {
    const subfase = localStorage.getItem("subfaseSeleccionada") || "Subfase";
    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoId = localStorage.getItem("proyectoId");
    const proyecto = proyectos.find(p => String(p.id) === String(proyectoId));
    const nombreProyecto = proyecto ? proyecto.nombre : "Proyecto";
    const fase = await obtenerFaseActual(proyectoId);

    const tituloEl = document.getElementById("titulo-proyecto");
    if (tituloEl) {
        tituloEl.innerText = "Proyecto > " + nombreProyecto;
    }

    const faseEl = document.getElementById("contexto-fase");
    const subfaseEl = document.getElementById("contexto-subfase");

    if (faseEl) {
        faseEl.innerText = fase;
    }

    if (subfaseEl) {
        subfaseEl.innerText = subfase;
    }
}

// Resuelve el nombre de la fase actual usando el almacenamiento local o el backend.
async function obtenerFaseActual(proyectoId) {
    const faseGuardada = localStorage.getItem("faseSeleccionada");
    if (faseGuardada) {
        return faseGuardada;
    }

    const idSubfase = localStorage.getItem("idSubfase");
    if (!proyectoId || !idSubfase) {
        return "Fase";
    }

    try {
        const result = await peticionSegura(`/fases/${proyectoId}`);

        if (!result || !result.success || !Array.isArray(result.data)) {
            return "Fase";
        }

        const faseActual = result.data.find(fase =>
            Array.isArray(fase.subfases) &&
            fase.subfases.some(subfase => String(subfase.id) === String(idSubfase))
        );

        if (!faseActual || !faseActual.nombre) {
            return "Fase";
        }

        localStorage.setItem("faseSeleccionada", faseActual.nombre);
        return faseActual.nombre;
    } catch (error) {
        console.error("No se pudo resolver la fase actual:", error);
        return "Fase";
    }
}

// Carga los departamentos disponibles y actualiza los selectores o resumenes relacionados.
async function cargarDepartamentos() {
    const toggle = document.getElementById("select-departamento");
    const placeholder = document.getElementById("departamento-placeholder");

    toggle.disabled = true;
    placeholder.textContent = "Cargando departamentos...";

    const result = await peticionSegura("/departamentos");

    if (!result || !result.success || !result.data || result.data.length === 0) {
        departamentosDisponibles = [];
        departamentosSeleccionados = [];
        renderizarOpcionesDepartamentos();
        actualizarResumenDepartamentos("No hay departamentos disponibles");
        return;
    }

    departamentosDisponibles = result.data.map(dep => ({
        id: Number(dep.id),
        nombre: dep.nombre
    }));
    departamentosSeleccionados = [];

    toggle.disabled = false;
    renderizarOpcionesDepartamentos();
    actualizarResumenDepartamentos();
}

// Abre o cierra el selector multiple de departamentos.
function toggleDropdownDepartamentos(event) {
    event.stopPropagation();

    const toggle = document.getElementById("select-departamento");
    const menu = document.getElementById("departamento-menu");

    if (toggle.disabled) {
        return;
    }

    const abierto = !menu.classList.contains("show");
    menu.classList.toggle("show", abierto);
    toggle.classList.toggle("open", abierto);
}

// Cierra el selector de departamentos cuando el usuario hace clic fuera de el.
function manejarClickFueraDropdown(event) {
    const wrapper = document.getElementById("departamento-wrapper");
    if (!wrapper || wrapper.contains(event.target)) {
        return;
    }

    cerrarDropdownDepartamentos();
}

// Cierra visualmente el desplegable de departamentos.
function cerrarDropdownDepartamentos() {
    const toggle = document.getElementById("select-departamento");
    const menu = document.getElementById("departamento-menu");

    if (toggle) {
        toggle.classList.remove("open");
    }

    if (menu) {
        menu.classList.remove("show");
    }
}

// Pinta las opciones del selector multiple de departamentos segun el estado actual.
function renderizarOpcionesDepartamentos() {
    const menu = document.getElementById("departamento-menu");
    if (!menu) {
        return;
    }

    if (departamentosDisponibles.length === 0) {
        menu.innerHTML = '<div class="multi-select-option empty">No hay departamentos disponibles</div>';
        return;
    }

    menu.innerHTML = departamentosDisponibles.map(dep => `
        <label class="multi-select-option" for="departamento-check-${dep.id}">
            <input
                type="checkbox"
                id="departamento-check-${dep.id}"
                ${departamentosSeleccionados.includes(dep.id) ? "checked" : ""}
                onchange="toggleDepartamento(${dep.id})">
            <span>${dep.nombre}</span>
        </label>
    `).join("");
}

// Anade o quita un departamento de la seleccion actual.
function toggleDepartamento(idDepartamento) {
    const id = Number(idDepartamento);

    if (departamentosSeleccionados.includes(id)) {
        departamentosSeleccionados = departamentosSeleccionados.filter(depId => depId !== id);
    } else {
        departamentosSeleccionados = [...departamentosSeleccionados, id];
    }

    renderizarOpcionesDepartamentos();
    actualizarResumenDepartamentos();
}

// Elimina un departamento ya seleccionado desde la lista de tags visibles.
function quitarDepartamento(idDepartamento, event) {
    if (event) {
        event.stopPropagation();
    }

    departamentosSeleccionados = departamentosSeleccionados.filter(depId => depId !== Number(idDepartamento));
    renderizarOpcionesDepartamentos();
    actualizarResumenDepartamentos();
}

// Actualiza el resumen textual y las etiquetas de los departamentos seleccionados.
function actualizarResumenDepartamentos(textoManual) {
    const placeholder = document.getElementById("departamento-placeholder");
    const tags = document.getElementById("departamento-tags");
    const seleccionados = departamentosDisponibles.filter(dep => departamentosSeleccionados.includes(dep.id));

    if (textoManual) {
        placeholder.textContent = textoManual;
        placeholder.classList.add("multi-select-placeholder");
        tags.innerHTML = "";
        limpiarValidacionDepartamentos();
        return;
    }

    if (seleccionados.length === 0) {
        placeholder.textContent = "Selecciona uno o varios departamentos...";
        placeholder.classList.add("multi-select-placeholder");
        tags.innerHTML = "";
        limpiarValidacionDepartamentos();
        return;
    }

    placeholder.textContent = seleccionados.map(dep => dep.nombre).join(", ");
    placeholder.classList.remove("multi-select-placeholder");
    tags.innerHTML = seleccionados.map(dep => `
        <span class="selected-tag">
            <span>${dep.nombre}</span>
            <button type="button" onclick="quitarDepartamento(${dep.id}, event)" aria-label="Quitar ${dep.nombre}">x</button>
        </span>
    `).join("");

    marcarDepartamentosValidos();
}

// Marca el selector de departamentos como invalido cuando falta seleccion.
function marcarDepartamentosInvalidos() {
    const toggle = document.getElementById("select-departamento");
    const feedback = document.getElementById("departamento-feedback");

    toggle.classList.add("is-invalid");
    toggle.classList.remove("is-valid");
    feedback.classList.add("show");
}

// Marca el selector de departamentos como valido cuando ya hay seleccion.
function marcarDepartamentosValidos() {
    const toggle = document.getElementById("select-departamento");
    const feedback = document.getElementById("departamento-feedback");

    toggle.classList.remove("is-invalid");
    toggle.classList.add("is-valid");
    feedback.classList.remove("show");
}

// Limpia el estado visual de validacion del selector de departamentos.
function limpiarValidacionDepartamentos() {
    const toggle = document.getElementById("select-departamento");
    const feedback = document.getElementById("departamento-feedback");

    toggle.classList.remove("is-invalid", "is-valid");
    feedback.classList.remove("show");
}

// Valida el formulario y crea la tarea en todos los departamentos seleccionados.
async function guardarTarea() {
    ocultarMensajes();

    const nombre = document.getElementById("input-nombre").value.trim();
    const tiempoMin = parseFloat(document.getElementById("input-tiempo-min").value);
    const tiempoMax = parseFloat(document.getElementById("input-tiempo-max").value);
    const idsDepartamentos = [...departamentosSeleccionados];

    let valido = true;

    if (!nombre) {
        document.getElementById("input-nombre").classList.add("is-invalid");
        valido = false;
    } else {
        document.getElementById("input-nombre").classList.remove("is-invalid");
        document.getElementById("input-nombre").classList.add("is-valid");
    }

    if (isNaN(tiempoMin) || tiempoMin < 0) {
        document.getElementById("input-tiempo-min").classList.add("is-invalid");
        valido = false;
    } else {
        document.getElementById("input-tiempo-min").classList.remove("is-invalid");
        document.getElementById("input-tiempo-min").classList.add("is-valid");
    }

    if (isNaN(tiempoMax) || tiempoMax < 0) {
        document.getElementById("input-tiempo-max").classList.add("is-invalid");
        valido = false;
    } else {
        document.getElementById("input-tiempo-max").classList.remove("is-invalid");
        document.getElementById("input-tiempo-max").classList.add("is-valid");
    }

    if (tiempoMin > tiempoMax && !isNaN(tiempoMin) && !isNaN(tiempoMax)) {
        document.getElementById("input-tiempo-min").classList.add("is-invalid");
        document.getElementById("error-tiempos").style.display = "block";
        valido = false;
    } else {
        document.getElementById("error-tiempos").style.display = "none";
    }

    if (idsDepartamentos.length === 0) {
        marcarDepartamentosInvalidos();
        valido = false;
    } else {
        marcarDepartamentosValidos();
    }

    if (!valido) {
        return;
    }

    const proyectoId = localStorage.getItem("proyectoId");
    const idSubfase = parseInt(localStorage.getItem("idSubfase"), 10);

    setBusy(true);
    try {
        const resultados = await Promise.allSettled(idsDepartamentos.map(idDepartamento => {
            const payload = {
                idSubFase: idSubfase,
                idSubfaseFase: idSubfase,
                idDepartamento,
                tarea: nombre,
                tiempoMin,
                tiempoMax
            };

            return peticionSegura(`/estimaciones/proyecto/${proyectoId}/manual`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
        }));

        const creadasCorrectamente = resultados.filter(result =>
            result.status === "fulfilled" && result.value && result.value.success
        ).length;

        if (creadasCorrectamente === idsDepartamentos.length) {
            const sufijo = creadasCorrectamente === 1 ? "" : ` en ${creadasCorrectamente} departamentos`;
            mostrarExito(`Tarea creada correctamente${sufijo}.`);
            setTimeout(() => {
                window.location.href = "subfase.html";
            }, 1500);
            return;
        }

        if (creadasCorrectamente > 0) {
            mostrarError(`La tarea se creo en ${creadasCorrectamente} departamentos, pero hubo errores en el resto.`);
            return;
        }

        const primerError = resultados.find(result =>
            result.status === "rejected" || (result.status === "fulfilled" && (!result.value || !result.value.success))
        );

        if (primerError && primerError.status === "fulfilled" && primerError.value) {
            mostrarError(primerError.value.mensaje || "Error al crear la tarea.");
        } else {
            mostrarError("No se pudo conectar con el servidor.");
        }
    } catch (error) {
        mostrarError("No se pudo conectar con el servidor.");
    } finally {
        setBusy(false);
    }
}

// Activa o desactiva el estado de carga de la accion actual
// para evitar envios duplicados mientras se procesa la peticion.
function setBusy(loading) {
    const btn = document.getElementById("btn-guardar");
    const text = document.getElementById("btn-text");
    const spin = document.getElementById("btn-spinner");
    btn.disabled = loading;
    text.textContent = loading ? "Guardando..." : "Crear Tarea";
    spin.classList.toggle("d-none", !loading);
}

// Muestra un mensaje de exito y lo hace visible en la parte superior de la vista.
function mostrarExito(msg) {
    const el = document.getElementById("msg-success");
    document.getElementById("msg-success-text").textContent = msg;
    el.classList.add("show");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Muestra un mensaje de error visible para informar del problema actual.
function mostrarError(msg) {
    const el = document.getElementById("msg-error");
    document.getElementById("msg-error-text").textContent = msg;
    el.classList.add("show");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Oculta los mensajes de estado antes de iniciar una nueva accion.
function ocultarMensajes() {
    document.getElementById("msg-success").classList.remove("show");
    document.getElementById("msg-error").classList.remove("show");
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
