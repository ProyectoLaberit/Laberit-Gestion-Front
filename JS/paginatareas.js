const URL_BASE = "http://localhost:8080/api/estimaciones";

window.onload = function () {
    if (!localStorage.getItem("sesionActiva")) {
        window.location.href = "login.html";
    } else {
        cargarDetallesTar();
    }
};

// ─── Cerrar sesión ─────────────────────────────────────────────────────────
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}


async function cargarDetallesTar(){

    const proyectoId = localStorage.getItem("proyectoId");
    const idSub = localStorage.getItem("idSubfase");
    const nombreTar = localStorage.getItem("nombreTarea");

    // 1. DEBUG VITAL: Asegurarnos de que no estén viajando como "null" o "undefined"

    if (!proyectoId || !idSub) {
        console.error("Error: Falta el ID del proyecto o la subfase en el localStorage");
        return; 
    }

    // 2. Empaquetamos los datos como un formulario (Ideal para @RequestParam)
    const parametros = new URLSearchParams();
    parametros.append('idSubfase', idSub);
    parametros.append('tarea', nombreTar);

    try {
        const response = await fetch(`${URL_BASE}/proyecto/${proyectoId}/especifica`, {
            method: 'POST',
            headers: {
                // Le decimos a Spring Boot que le mandamos un formulario, no un JSON
                'Content-Type': 'application/x-www-form-urlencoded' 
            },
            body: parametros // Metemos los parámetros en el vagón de carga
        });

        const result = await response.json();

        if (result.success) {
            // Aquí tu lógica para pintar la tabla
            const espec = result.data;
            const tabla = document.getElementById("tablaEspec");

            tabla.innerHTML = espec.map(p =>`
                <!-- Col: Departamento -->
                <div class="b-col">
                    <div class="item">
                        <div class="item-name">${p.nombreDepartamento}</div>
                    </div>
                </div>
 
                <!-- Col: Tiempo Mínimo -->
                <div class="b-col">
                    <div class="time-item">
                        <div class="time-val time-min">${p.tiempoMin}</div>
                        <div class="time-lbl">${p.nombreDepartamento}</div>
                    </div>
                </div>
 
                <!-- Col: Tiempo Máximo -->
                <div class="b-col">
                    <div class="time-item">
                        <div class="time-val time-max">${p.tiempoMax}</div>
                        <div class="time-lbl">${p.nombreDepartamento}</div>
                    </div>
                </div>`).join('');

        } else {
            console.warn("Aviso del backend:", result.message);
        }

    } catch (error) {
        console.error("Error en la llamada:", error);
    }

}

