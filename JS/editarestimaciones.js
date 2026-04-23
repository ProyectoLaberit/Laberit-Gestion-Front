window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
    } else {
        cargarDatosActuales();
    }
};

async function cargarDatosActuales() {
    const proyectoId = localStorage.getItem("proyectoId");
    const idSub = localStorage.getItem("idSubfase");
    const nombreTar = localStorage.getItem("nombreTarea");

    document.getElementById('titulo-tarea').innerText = `Editando: ${nombreTar}`;

    const parametros = new URLSearchParams();
    parametros.append('idSubfase', idSub);
    parametros.append('tarea', nombreTar);

    try {
        const result = await peticionSegura(`/estimaciones/proyecto/${proyectoId}/especifica`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: parametros
        });

        if (result.success) {
            pintarFormulario(result.data);
        } else {
            document.getElementById('contenedor-inputs').innerHTML = "Error al cargar datos.";
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

function pintarFormulario(estimaciones) {
    const contenedor = document.getElementById('contenedor-inputs');
    
    contenedor.innerHTML = estimaciones.map((est, index) => `
        <div class="department-edit-row mb-4 p-3 border rounded bg-light">
            <h5 class="fw-bold text-dark mb-3">${est.nombreDepartamento}</h5>
            <input type="hidden" name="id-${index}" value="${est.id}">
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label small">Tiempo Mínimo</label>
                    <input type="text" class="form-control" id="min-${index}" value="${est.tiempoMin}">
                </div>
                <div class="col-md-6">
                    <label class="form-label small">Tiempo Máximo</label>
                    <input type="text" class="form-control" id="max-${index}" value="${est.tiempoMax}">
                </div>
            </div>
        </div>
    `).join('');
}

async function actualizarEstimaciones() {
    const feedback = document.getElementById('msg-feedback');
    feedback.innerText = "Guardando...";
    
    // Aquí deberás adaptar el payload según lo que espere tu controlador de Spring Boot
    // Por ejemplo, enviar una lista de objetos de estimación actualizados
    const rows = document.querySelectorAll('.department-edit-row');
    const datosActualizados = Array.from(rows).map((row, index) => {
        return {
            id: document.querySelector(`input[name="id-${index}"]`).value,
            tiempoMin: document.getElementById(`min-${index}`).value,
            tiempoMax: document.getElementById(`max-${index}`).value
        };
    });

    try {
        const result = await peticionSegura(`/estimaciones/actualizar`, {
            method: 'PUT',
            body: JSON.stringify(datosActualizados)
        });

        if (result.success) {
            feedback.className = "mt-3 text-center text-success";
            feedback.innerText = "Cambios guardados correctamente.";
            setTimeout(() => window.location.href = "paginatareas.html", 1500);
        } else {
            feedback.className = "mt-3 text-center text-danger";
            feedback.innerText = "Error: " + result.message;
        }
    } catch (error) {
        feedback.className = "mt-3 text-center text-danger";
        feedback.innerText = "Error de conexión.";
    }
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}