// const URL_BASE = "http://localhost:8080/api/estimaciones";

// Verificación de sesión
window.onload = function () {
    // if (!localStorage.getItem("sesionActiva")) {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    cargarDatosSubfase();
};

async function cargarDatosSubfase() {
    const proyectoId = localStorage.getItem("proyectoId");
    const idSub = localStorage.getItem("idSubfase");

    const nombreSub = localStorage.getItem("subfaseSeleccionada");
    const displayNombre = document.getElementById("subfase-nombre-display");
    if (displayNombre) {
        displayNombre.innerText = nombreSub ? nombreSub : "Subfase " + idSub;
    }
    // Breadcrumb
    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoActual = proyectos.find(p => String(p.id) === String(proyectoId));
    const nombreProyecto = proyectoActual ? proyectoActual.nombre : "Proyecto";
    const nombreFase = localStorage.getItem("faseSeleccionada") || "Fase";

    document.getElementById("bc-proyecto").innerText = nombreProyecto;
    document.getElementById("bc-fase").innerText = nombreFase;

    // 1. DEBUG VITAL: Asegurarnos de que no estén viajando como "null" o "undefined"
    console.log("Comprobando variables antes de enviar:");
    console.log("ID Proyecto:", proyectoId);
    console.log("ID Subfase:", idSub);

    if (!proyectoId || !idSub) {
        console.error("Error: Falta el ID del proyecto o la subfase en el localStorage");
        return;
    }

    // 2. Empaquetamos los datos como un formulario (Ideal para @RequestParam)
    const parametros = new URLSearchParams();
    parametros.append('idProyecto', proyectoId);
    parametros.append('idSubfase', idSub);

    try {
        // const response = await fetch(`${URL_BASE}/subfase/tareas`, {
        //     method: 'POST',
        //     headers: {
        //         // Le decimos a Spring Boot que le mandamos un formulario, no un JSON
        //         'Content-Type': 'application/x-www-form-urlencoded' 
        //     },
        //     body: parametros // Metemos los parámetros en el vagón de carga
        // });

        // const result = await response.json();

        const result = await peticionSegura(`/estimaciones/subfase/tareas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: parametros
        });

        if (result && result.success) {
            const tar = result.data;

            const tabla = document.getElementById("tablaTar");

            tabla.innerHTML = tar.map(p => {
                const tiempoReal = p.tiempoTotalReal;

                let displayTiempo = "-"; // Por defecto, el guion

                // 2. Si existe y no es nulo...
                if (tiempoReal !== undefined && tiempoReal !== null) {
                    // Lo forzamos a número (por si acaso llega como texto)
                    let numeroHoras = parseFloat(tiempoReal);

                    // 3. Si es un número válido, lo redondeamos y le ponemos la 'h'
                    if (!isNaN(numeroHoras)) {
                        displayTiempo = (Math.round(numeroHoras * 10) / 10) + "h";
                    }
                }

                return `<div class="b-col" id="col-nombre" onclick="detalleTarea('${p.nombreTarea}')">
                    <div class="item">
                        <div class="item-name">${p.nombreTarea}</div>
                    </div>
                </div>

                <!-- Col: Tarea Clockify -->
                <div class="b-col" id="col-clockify">
                    <div class="est-item">
                        <div class="est-val">${displayTiempo}</div>
                    </div>
                </div>

                <!-- Col: Estimaciones -->
                <div class="b-col" id="col-estimaciones">
                    <div class="est-item">
                        <div class="est-val">${p.tiempoTotalMin} - ${p.tiempoTotalMax}</div>
                    </div>
                </div>`}).join('');

        } else {
            console.warn("Aviso del backend:", result.message);
        }

    } catch (error) {
        console.error("Error en la llamada:", error);
    }
}

function detalleTarea(nombreTarea) {

    console.log(nombreTarea);

    localStorage.setItem("nombreTarea", nombreTarea);

    window.location.href = "paginatareas.html";

}

function abrirAñadirManual() {
    // Simplemente navegamos a la página del formulario
    window.location.href = "creartarea.html";
}

function cerrarSesion() {
    // localStorage.removeItem("sesionActiva");
    localStorage.clear();
    window.location.href = "login.html";
}
