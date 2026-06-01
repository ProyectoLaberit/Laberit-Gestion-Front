let subfasesPorFase = {};
let nombresFase = {};
let subfaseSeleccionadaEst = null;

// Inicializa la pantalla, valida la sesion activa y carga el contexto
// principal necesario antes de que el usuario empiece a interactuar.
window.onload = async function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    if (esEmpleado()) {
        document.body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                        height:100vh;background:#f8f9fa;font-family:sans-serif;">
                <div style="width:80px;height:80px;background:#fee2e2;border-radius:50%;
                            display:flex;align-items:center;justify-content:center;margin-bottom:1.5rem;">
                    <svg width="40" height="40" fill="none" stroke="#dc2626" stroke-width="2.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                </div>
                <h2 style="color:#1f2937;font-weight:800;margin:0 0 0.5rem;">Acceso no permitido</h2>
                <p style="color:#6c757d;margin:0 0 1.5rem;">Solo Administrador y SuperAdministrador pueden crear estructuras.</p>
                <a href="proyectos.html" style="background:#C01717;color:white;padding:10px 24px;
                    border-radius:6px;text-decoration:none;font-weight:600;">Volver a Proyectos</a>
            </div>`;
        return;
    }

    if (!verificarAcceso(["SuperAdministrador", "Administrador"])) {
        return;
    }

    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoId = localStorage.getItem("proyectoId");
    const proyectoActual = proyectos.find(p => String(p.id) === String(proyectoId));
    const bcEl = document.getElementById("bc-proyecto");

    if (bcEl) {
        bcEl.innerText = proyectoActual ? proyectoActual.nombre : "Proyecto";
    }

    await cargarFasesYSubfases();
    await cargarDepartamentos();
};

// Carga las fases del proyecto y prepara el selector dependiente de subfases.
async function cargarFasesYSubfases() {
    const proyectoId = localStorage.getItem("proyectoId");
    const selectFase = document.getElementById("select-fase");
    const selectSub = document.getElementById("select-subfase");

    if (!proyectoId) {
        selectFase.innerHTML = '<option value="" selected>No hay proyecto seleccionado</option>';
        selectSub.innerHTML = '<option value="" selected>Primero selecciona un proyecto</option>';
        selectFase.disabled = true;
        selectSub.disabled = true;
        if (typeof refrescarSelect2 === "function") {
            refrescarSelect2(selectFase);
            refrescarSelect2(selectSub);
        }
        return;
    }

    try {
        const result = await peticionSegura(`/fases/${proyectoId}`);

        if (!result || !result.success || !Array.isArray(result.data) || result.data.length === 0) {
            selectFase.innerHTML = '<option value="" selected>No hay fases disponibles</option>';
            selectSub.innerHTML = '<option value="" selected>No hay subfases disponibles</option>';
            selectFase.disabled = true;
            selectSub.disabled = true;
            if (typeof refrescarSelect2 === "function") {
                refrescarSelect2(selectFase);
                refrescarSelect2(selectSub);
            }
            return;
        }

        subfasesPorFase = {};
        nombresFase = {};

        selectFase.innerHTML = '<option value="" disabled selected>Selecciona una fase...</option>';
        selectFase.disabled = false;

        result.data.forEach(fase => {
            const idFase = String(fase.id);
            nombresFase[idFase] = fase.nombre;
            subfasesPorFase[idFase] = Array.isArray(fase.subfases) ? fase.subfases : [];

            const opt = document.createElement("option");
            opt.value = idFase;
            opt.textContent = fase.nombre;
            selectFase.appendChild(opt);
        });

        resetearSubfases();
        if (typeof refrescarSelect2 === "function") {
            refrescarSelect2(selectFase);
        }
    } catch (error) {
        console.error("Error al cargar fases y subfases:", error);
        selectFase.innerHTML = '<option value="" selected>Error al cargar fases</option>';
        selectSub.innerHTML = '<option value="" selected>Error al cargar subfases</option>';
        selectFase.disabled = true;
        selectSub.disabled = true;
        if (typeof refrescarSelect2 === "function") {
            refrescarSelect2(selectFase);
            refrescarSelect2(selectSub);
        }
        mostrarError("No se pudieron cargar las fases del proyecto.");
    }
}

// Carga los departamentos disponibles y actualiza los selectores o resumenes relacionados.
async function cargarDepartamentos() {
    const select = document.getElementById("select-depto-est");
    const result = await peticionSegura("/departamentos");

    if (!result || !result.success || !result.data || result.data.length === 0) {
        select.innerHTML = '<option value="">Sin departamentos</option>';
        if (typeof refrescarSelect2 === "function") {
            refrescarSelect2(select);
        }
        return;
    }

    select.innerHTML = '<option value="" disabled selected>Selecciona departamento...</option>';
    result.data.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.nombre;
        select.appendChild(opt);
    });

    if (typeof refrescarSelect2 === "function") {
        refrescarSelect2(select);
    }
}

// Recarga las subfases disponibles cuando cambia la fase seleccionada.
function onCambioFase() {
    const idFase = document.getElementById("select-fase").value;
    const selectSub = document.getElementById("select-subfase");

    limpiarSubfaseSeleccionada();

    if (!idFase) {
        resetearSubfases();
        return;
    }

    const subfases = subfasesPorFase[idFase] || [];

    if (subfases.length === 0) {
        selectSub.innerHTML = '<option value="" selected>No hay subfases para esta fase</option>';
        selectSub.disabled = true;
        if (typeof refrescarSelect2 === "function") {
            refrescarSelect2(selectSub);
        }
        return;
    }

    selectSub.disabled = false;
    selectSub.innerHTML = '<option value="" disabled selected>Selecciona una subfase...</option>';

    subfases.forEach(subfase => {
        const opt = document.createElement("option");
        opt.value = subfase.id;
        opt.textContent = subfase.nombre;
        selectSub.appendChild(opt);
    });

    if (typeof refrescarSelect2 === "function") {
        refrescarSelect2(selectSub);
    }
}

// Guarda la subfase elegida para usarla al crear la estimacion.
function onCambioSubfase() {
    const idFase = document.getElementById("select-fase").value;
    const select = document.getElementById("select-subfase");
    const idSub = select.value;
    const nombreSub = select.selectedOptions[0]?.text || "";

    if (!idSub) {
        limpiarSubfaseSeleccionada();
        return;
    }

    subfaseSeleccionadaEst = {
        id: parseInt(idSub, 10),
        nombre: nombreSub,
        idFase: parseInt(idFase, 10)
    };

}

// Restablece el selector de subfases a su estado inicial deshabilitado.
function resetearSubfases() {
    const selectSub = document.getElementById("select-subfase");
    selectSub.innerHTML = '<option value="" disabled selected>Primero selecciona una fase...</option>';
    selectSub.disabled = true;
    limpiarSubfaseSeleccionada();

    if (typeof refrescarSelect2 === "function") {
        refrescarSelect2(selectSub);
    }
}

// Limpia la subfase seleccionada cuando cambia el contexto del selector.
function limpiarSubfaseSeleccionada() {
    subfaseSeleccionadaEst = null;
}

// Valida los datos del formulario y crea una estimacion manual en el proyecto actual.
async function crearEstimacion() {
    ocultarMensajes();

    if (!subfaseSeleccionadaEst) {
        mostrarError("Primero selecciona una fase y una subfase en los pasos anteriores.");
        return;
    }

    const idDepto = parseInt(document.getElementById("select-depto-est").value, 10);
    const tarea = document.getElementById("input-tarea-est").value.trim();
    const tiempoMin = parseFloat(document.getElementById("input-tmin").value);
    const tiempoMax = parseFloat(document.getElementById("input-tmax").value);
    const proyectoId = localStorage.getItem("proyectoId");
    let valido = true;

    if (!idDepto) {
        document.getElementById("select-depto-est").classList.add("is-invalid");
        valido = false;
    } else {
        document.getElementById("select-depto-est").classList.remove("is-invalid");
    }

    if (!tarea) {
        document.getElementById("input-tarea-est").classList.add("is-invalid");
        valido = false;
    } else {
        document.getElementById("input-tarea-est").classList.remove("is-invalid");
    }

    if (isNaN(tiempoMin) || tiempoMin < 0) {
        document.getElementById("input-tmin").classList.add("is-invalid");
        valido = false;
    } else {
        document.getElementById("input-tmin").classList.remove("is-invalid");
    }

    if (isNaN(tiempoMax) || tiempoMax < 0) {
        document.getElementById("input-tmax").classList.add("is-invalid");
        valido = false;
    } else {
        document.getElementById("input-tmax").classList.remove("is-invalid");
    }

    if (!isNaN(tiempoMin) && !isNaN(tiempoMax) && tiempoMin > tiempoMax) {
        document.getElementById("error-tiempos").style.display = "block";
        valido = false;
    } else {
        document.getElementById("error-tiempos").style.display = "none";
    }

    if (!valido) {
        return;
    }

    setBusy("est", true);
    const payload = {
        idFasePadre: subfaseSeleccionadaEst.idFase,
        idSubFase: subfaseSeleccionadaEst.id,
        idDepartamento: idDepto,
        tarea,
        tiempoMin,
        tiempoMax
    };

    const result = await peticionSegura(`/estimaciones/proyecto/${proyectoId}/manual`, {
        method: "POST",
        body: JSON.stringify(payload)
    });
    setBusy("est", false);

    if (result && result.success) {
        abrirEstimacionCreada(tarea);
        return;
    } else {
        mostrarError((result && result.mensaje) || "Error al crear la estimacion.");
    }
}

// Guarda el contexto de la estimacion recien creada y abre su pantalla de detalle.
function abrirEstimacionCreada(nombreTarea) {
    if (!subfaseSeleccionadaEst) {
        return;
    }

    localStorage.setItem("idSubfase", String(subfaseSeleccionadaEst.id));
    localStorage.setItem("subfaseSeleccionada", subfaseSeleccionadaEst.nombre);
    localStorage.setItem("faseSeleccionada", nombresFase[String(subfaseSeleccionadaEst.idFase)] || "Fase");
    localStorage.setItem("nombreTarea", nombreTarea);

    window.location.assign("paginatareas.html");
}

// Anade un elemento visual a la lista de elementos creados recientemente.
function agregarItemListaCreada(listaId, contenedorId, texto) {
    const contenedor = document.getElementById(contenedorId);
    const lista = document.getElementById(listaId);
    contenedor.style.display = "block";

    const li = document.createElement("li");
    li.innerHTML = `
        <span><span class="badge-fase">estimacion</span><span class="ms-2">${texto}</span></span>
        <button onclick="this.parentElement.remove(); if (!document.getElementById('${listaId}').children.length) document.getElementById('${contenedorId}').style.display='none';">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>`;
    lista.appendChild(li);
}

// Activa o desactiva el estado de carga de la accion actual
// para evitar envios duplicados mientras se procesa la peticion.
function setBusy(paso, loading) {
    const btn = document.getElementById(`btn-${paso}-text`);
    const spin = document.getElementById(`btn-${paso}-spin`);
    if (btn) btn.textContent = loading ? "Guardando..." : "Crear Estimacion";
    if (spin) spin.classList.toggle("d-none", !loading);
}

// Muestra un mensaje de exito y lo hace visible en la parte superior de la vista.
function mostrarExito(msg) {
    document.getElementById("msg-success-text").textContent = msg;
    document.getElementById("msg-success").classList.add("show");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => document.getElementById("msg-success").classList.remove("show"), 3500);
}

// Muestra un mensaje de error visible para informar del problema actual.
function mostrarError(msg) {
    document.getElementById("msg-error-text").textContent = msg;
    document.getElementById("msg-error").classList.add("show");
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
