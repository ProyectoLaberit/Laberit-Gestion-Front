const URL_BASE = "http://localhost:8080/api/proyectos/";

// Verificación de sesión al cargar
window.onload = function () {
    if (!localStorage.getItem("sesionActiva")) {
        window.location.href = "login.html";
    }
};

async function guardarProyecto() {
    const feedback = document.getElementById('msg-feedback');
    const nombre = document.getElementById('nombre').value;
    const descripcion = document.getElementById('descripcion').value;
    const fechaInicio = document.getElementById('fechaInicio').value;
    const activo = document.getElementById('proyectoActivo').checked;
    const gitlabId = document.getElementById('gitlabId').value;
    const clockifyId = document.getElementById('clockifyId').value;
    const id = localStorage.getItem("proyectoId");

    const proyectoData = {
            id: id,
            nombre: nombre,
            descripcion: descripcion,
            fechaInicio: fechaInicio,
            activo: activo,
            gitlabId: gitlabId,
            clockifyId: clockifyId,
            enBaseDatos: false
    };

    try {
        console.log("holaaaaaaa");
        console.log(activo);
        // Asumimos un endpoint POST para crear o PUT para editar
        const response = await fetch(`${URL_BASE}${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proyectoData)
        });

        const result = await response.json();

        if (result.success) {
            feedback.className = "mt-3 text-center text-success";
            feedback.innerText = "Proyecto guardado correctamente.";
            setTimeout(() => window.location.href = "proyectos.html", 1500);
        } else {
            feedback.className = "mt-3 text-center text-danger";
            feedback.innerText = "Error: " + result.mensaje;
        }
    } catch (error) {
        feedback.className = "mt-3 text-center text-danger";
        feedback.innerText = "Error de conexión con el servidor.";
        console.error("Error:", error);
    }
}

function cerrarSesion() {
    localStorage.removeItem("sesionActiva");
    window.location.href = "login.html";
}