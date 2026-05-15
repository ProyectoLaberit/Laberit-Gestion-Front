window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    const btnAnadir = document.querySelector('button[onclick="abrirAñadirManual()"]');
    if (btnAnadir && !esAdmin()) {
        btnAnadir.style.display = "none";
    }

    cargarDatosSubfase();
};

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

        if (result && result.success) {
            const tar = result.data;
            const tabla = document.getElementById("tablaTar");

            tabla.innerHTML = tar.map((p) => {
                const tiempoReal = p.tiempoTotalReal;
                let displayTiempo = "-";

                if (tiempoReal !== undefined && tiempoReal !== null) {
                    const numeroHoras = parseFloat(tiempoReal);
                    if (!isNaN(numeroHoras)) {
                        displayTiempo = formatoHoras(numeroHoras) + "h";
                    }
                }

                return `<div class="b-col" id="col-nombre" onclick="detalleTarea('${p.nombreTarea}')">
                    <div class="item">
                        <div class="item-name">${p.nombreTarea}</div>
                    </div>
                </div>

                <div class="b-col" id="col-clockify">
                    <div class="est-item">
                        <div class="est-val">${displayTiempo}</div>
                    </div>
                </div>

                <div class="b-col" id="col-estimaciones">
                    <div class="est-item">
                        <div class="est-val">${p.tiempoTotalMin} - ${p.tiempoTotalMax}</div>
                    </div>
                </div>`;
            }).join("");
        } else {
            console.warn("Aviso del backend:", result ? result.message : "Sin respuesta");
        }
    } catch (error) {
        console.error("Error en la llamada:", error);
    }
}

function detalleTarea(nombreTarea) {
    localStorage.setItem("nombreTarea", nombreTarea);
    window.location.href = "paginatareas.html";
}

function abrirAñadirManual() {
    window.location.href = "creartarea.html";
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
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
