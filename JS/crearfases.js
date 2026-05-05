let subfasesPorFase = {};
let nombresFase = {};
let subfaseSeleccionadaEst = null;

window.onload = async function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
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

async function cargarFasesYSubfases() {
    const proyectoId = localStorage.getItem("proyectoId");
    const selectFase = document.getElementById("select-fase");
    const selectSub = document.getElementById("select-subfase");

    if (!proyectoId) {
        selectFase.innerHTML = '<option value="" selected>No hay proyecto seleccionado</option>';
        selectSub.innerHTML = '<option value="" selected>Primero selecciona un proyecto</option>';
        selectFase.disabled = true;
        selectSub.disabled = true;
        return;
    }

    try {
        const result = await peticionSegura(`/fases/${proyectoId}`);

        if (!result || !result.success || !Array.isArray(result.data) || result.data.length === 0) {
            selectFase.innerHTML = '<option value="" selected>No hay fases disponibles</option>';
            selectSub.innerHTML = '<option value="" selected>No hay subfases disponibles</option>';
            selectFase.disabled = true;
            selectSub.disabled = true;
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
    } catch (error) {
        console.error("Error al cargar fases y subfases:", error);
        selectFase.innerHTML = '<option value="" selected>Error al cargar fases</option>';
        selectSub.innerHTML = '<option value="" selected>Error al cargar subfases</option>';
        selectFase.disabled = true;
        selectSub.disabled = true;
        mostrarError("No se pudieron cargar las fases del proyecto.");
    }
}

async function cargarDepartamentos() {
    const select = document.getElementById("select-depto-est");
    const result = await peticionSegura("/departamentos");

    if (!result || !result.success || !result.data || result.data.length === 0) {
        select.innerHTML = '<option value="">Sin departamentos</option>';
        return;
    }

    select.innerHTML = '<option value="" disabled selected>Selecciona departamento...</option>';
    result.data.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.nombre;
        select.appendChild(opt);
    });
}

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
}

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

    const display = document.getElementById("display-subfase-est");
    display.textContent = `${nombresFase[idFase] || "Fase"} > ${nombreSub}`;
    display.classList.remove("text-muted");
    display.classList.add("text-dark", "fw-semibold");
}

function resetearSubfases() {
    const selectSub = document.getElementById("select-subfase");
    selectSub.innerHTML = '<option value="" disabled selected>Primero selecciona una fase...</option>';
    selectSub.disabled = true;
    limpiarSubfaseSeleccionada();
}

function limpiarSubfaseSeleccionada() {
    subfaseSeleccionadaEst = null;

    const display = document.getElementById("display-subfase-est");
    display.textContent = "- Selecciona una subfase en el paso 2 -";
    display.classList.add("text-muted");
    display.classList.remove("text-dark", "fw-semibold");
}

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
        idSubfaseFase: subfaseSeleccionadaEst.id,
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
        agregarItemListaCreada(
            "lista-estimaciones",
            "contenedor-estimaciones-creadas",
            `${subfaseSeleccionadaEst.nombre} - ${tarea} (${tiempoMin}h-${tiempoMax}h)`
        );
        document.getElementById("input-tarea-est").value = "";
        document.getElementById("input-tmin").value = "";
        document.getElementById("input-tmax").value = "";
        mostrarExito(`Estimacion "${tarea}" creada correctamente.`);
    } else {
        mostrarError((result && result.mensaje) || "Error al crear la estimacion.");
    }
}

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

function setBusy(paso, loading) {
    const btn = document.getElementById(`btn-${paso}-text`);
    const spin = document.getElementById(`btn-${paso}-spin`);
    if (btn) btn.textContent = loading ? "Guardando..." : "Crear Estimacion";
    if (spin) spin.classList.toggle("d-none", !loading);
}

function mostrarExito(msg) {
    document.getElementById("msg-success-text").textContent = msg;
    document.getElementById("msg-success").classList.add("show");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => document.getElementById("msg-success").classList.remove("show"), 3500);
}

function mostrarError(msg) {
    document.getElementById("msg-error-text").textContent = msg;
    document.getElementById("msg-error").classList.add("show");
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
