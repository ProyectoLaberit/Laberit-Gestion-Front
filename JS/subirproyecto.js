const URL_BASE = "http://localhost:8080/api";

window.onload = function () {
    if (!localStorage.getItem("sesionActiva")) {
        window.location.href = "login.html";
    }
};

function mostrarNombre(input) {
    const label = document.getElementById('labelArchivo');
    if (input.files.length > 0) {
        label.innerText = "Archivo: " + input.files[0].name;
        label.style.color = "#000";
    }
}

async function guardarProyecto() {
    const feedback = document.getElementById('msg-feedback');
    // Recopilar archivo
    /*const fileInput = document.getElementById('archivoInput');
    if (fileInput.files[0]) {
        formData.append('archivo', fileInput.files[0]);
    }*/

    console.log(document.getElementById('gitlabId').value);

    // Recopilar campos
    const formData = {
        nombre: document.getElementById('nombre').value,
        descripcion: document.getElementById('descripcion').value,
        fechaInicio: document.getElementById('fechaInicio').value, // Se envía como string "YYYY-MM-DD"
        activo: true,
        gitlabId: document.getElementById('gitlabId').value,
        clockifyId: document.getElementById('clockifyId').value
    };
    /*formData.append('nombre', document.getElementById('nombre').value);
    formData.append('fechaInicio', document.getElementById('fechaInicio').value);
    formData.append('clockifyId', document.getElementById('clockifyId').value);
    formData.append('gitlabId', document.getElementById('gitlabId').value);
    formData.append('activo', true);
    formData.append('descripcion', document.getElementById('descripcion').value);
    formData.append('fechaFin', null);*/

    try {
        feedback.innerText = "Subiendo proyecto...";
        const response = await fetch(`${URL_BASE}/proyectos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData) // FormData gestiona automáticamente el Content-Type
        });

        const result = await response.json();

        if (result.success) {
            feedback.className = "mt-3 text-center text-success";
            feedback.innerText = "Proyecto subido correctamente.";
            const idPro = result.data.id;

            const fileInput = document.getElementById('archivoInput');

            const excelData = new FormData();
            formData.append('archivo', fileInput.files[0]);
            formData.append('proyectoId', idPro);
            formData.append('usuarioId', 1);
            const response = await fetch(`${URL_BASE}/estimaciones/importar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: excelData
            });
            const result = await response.json();

            //setTimeout(() => window.location.href = "proyectos.html", 1500);
        } else {
            feedback.className = "mt-3 text-center text-danger";
            feedback.innerText = "Error: " + result.mensaje;
        }
    } catch (error) {
        feedback.className = "mt-3 text-center text-danger";
        feedback.innerText = "Error de conexión con el servidor.";
    }
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}