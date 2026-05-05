window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    cargarDepartamentos();
    mostrarContexto();
};

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

    const el = document.getElementById("contexto-display");
    if (el) {
        el.innerText = fase + " > " + subfase;
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



async function cargarDepartamentos() {
    const select = document.getElementById("select-departamento");
    select.innerHTML = '<option value="">Cargando departamentos...</option>';

    const result = await peticionSegura("/departamentos");

    if (!result || !result.success || !result.data || result.data.length === 0) {
        select.innerHTML = '<option value="">No hay departamentos disponibles</option>';
        return;
    }

    select.innerHTML = '<option value="" disabled selected>Selecciona un departamento...</option>';
    result.data.forEach(dep => {
        const opt = document.createElement("option");
        opt.value = dep.id;
        opt.textContent = dep.nombre;
        select.appendChild(opt);
    });
}

async function guardarTarea() {
    ocultarMensajes();

    const nombre = document.getElementById("input-nombre").value.trim();
    const tiempoMin = parseFloat(document.getElementById("input-tiempo-min").value);
    const tiempoMax = parseFloat(document.getElementById("input-tiempo-max").value);
    const idDepartamento = parseInt(document.getElementById("select-departamento").value);

    // Validación
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

    if (!idDepartamento) {
        document.getElementById("select-departamento").classList.add("is-invalid");
        valido = false;
    } else {
        document.getElementById("select-departamento").classList.remove("is-invalid");
        document.getElementById("select-departamento").classList.add("is-valid");
    }

    if (!valido) return;

    const proyectoId = localStorage.getItem("proyectoId");
    const idFase = parseInt(localStorage.getItem("idSubfase"));

    const payload = {
        idSubfaseFase: idFase,
        idDepartamento: idDepartamento,
        tarea: nombre,
        tiempoMin: tiempoMin,
        tiempoMax: tiempoMax
    };

    setBusy(true);
    try {
        const result = await peticionSegura(`/estimaciones/proyecto/${proyectoId}/manual`, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (result && result.success) {
            mostrarExito("Tarea creada correctamente.");
            setTimeout(() => {
                window.location.href = "subfase.html";
            }, 1500);
        } else {
            mostrarError((result && result.mensaje) || "Error al crear la tarea.");
        }
    } catch (err) {
        mostrarError("No se pudo conectar con el servidor.");
    } finally {
        setBusy(false);
    }
}

function setBusy(loading) {
    const btn = document.getElementById("btn-guardar");
    const text = document.getElementById("btn-text");
    const spin = document.getElementById("btn-spinner");
    btn.disabled = loading;
    text.textContent = loading ? "Guardando..." : "Crear Tarea";
    spin.classList.toggle("d-none", !loading);
}

function mostrarExito(msg) {
    const el = document.getElementById("msg-success");
    document.getElementById("msg-success-text").textContent = msg;
    el.classList.add("show");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function mostrarError(msg) {
    const el = document.getElementById("msg-error");
    document.getElementById("msg-error-text").textContent = msg;
    el.classList.add("show");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function ocultarMensajes() {
    document.getElementById("msg-success").classList.remove("show");
    document.getElementById("msg-error").classList.remove("show");
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
