// const URL_BASE = "http://localhost:8080/api/estimaciones";

window.onload = function () {
    if (!localStorage.getItem("token")) {
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
    // Recuperamos el nombre de la subfase porque nuestro endpoint de Clockify pide el String
    const nombreSub = localStorage.getItem("subfaseSeleccionada") || idSub;

    const displayNombre = document.getElementById("tarea-nombre-display");
    if (displayNombre) {
        displayNombre.innerText = nombreTar ? nombreTar : "Detalle de Tarea";
    }

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
        // const response = await fetch(`${URL_BASE}/proyecto/${proyectoId}/especifica`, {
        //     method: 'POST',
        //     headers: {
        //         // Le decimos a Spring Boot que le mandamos un formulario, no un JSON
        //         'Content-Type': 'application/x-www-form-urlencoded' 
        //     },
        //     body: parametros // Metemos los parámetros en el vagón de carga
        // });

        // const result = await response.json();

        const result = await peticionSegura(`/estimaciones/proyecto/${proyectoId}/especifica`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded' 
            },
            body: parametros
        });

        if (result.success) {
            const espec = result.data;
            const tabla = document.getElementById("tablaEspec");

            // Columna de Departamentos
            const colDeptos = espec.map(p => `
                <div class="item">
                    <div class="item-name">${p.nombreDepartamento}</div>
                </div>
            `).join('');

            // Columna de Tiempo Real
            const colReal = espec.map(p => {
                let tiempoRealValor = p.tiempoReal;

                const tiempoRealDisplay = (tiempoRealValor !== undefined && tiempoRealValor !== null && tiempoRealValor > 0) 
                                            ? tiempoRealValor + "h" 
                                            : "-";

                // Leemos el id de GitLab del propio DTO
                const displayGit = p.numeroGitlab ? `#${p.numeroGitlab}` : "-";

                return `
                <div class="time-item">
                    <div class="time-val text-primary fw-bold" style="font-size: 1.1rem;">${tiempoRealDisplay}</div>
                    <div class="time-lbl">${displayGit}</div>
                </div>`;
            }).join('');

            // Columna de Tiempo Mínimo
            const colMin = espec.map(p => {
                const displayGit = p.numeroGitlab ? `#${p.numeroGitlab}` : "-";

                return `
                <div class="time-item">
                    <div class="time-val time-min">${p.tiempoMin}h</div>
                    <div class="time-lbl" style="color: #6c757d; font-weight: 600;">${displayGit}</div>
                </div>`;
            }).join('');

            // Columna de Tiempo Máximo
            const colMax = espec.map(p => {
                const displayGit = p.numeroGitlab ? `#${p.numeroGitlab}` : "-";

                return `
                <div class="time-item">
                    <div class="time-val time-max">${p.tiempoMax}h</div>
                    <div class="time-lbl" style="color: #6c757d; font-weight: 600;">${displayGit}</div>
                </div>`;
            }).join('');

            // 5. Inyectamos las 4 columnas maestras en el HTML
            tabla.innerHTML = `
                <div class="b-col">${colDeptos}</div>
                <div class="b-col">${colReal}</div>
                <div class="b-col">${colMin}</div>
                <div class="b-col">${colMax}</div>
            `;

        } else {
            console.warn("Aviso:", result.message);
        }

    } catch (error) {
        console.error("Error en la llamada:", error);
    }
}
