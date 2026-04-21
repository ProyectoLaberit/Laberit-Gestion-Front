// const URL_BASE = "http://localhost:8080/api";

window.onload = function () {
    // if (!localStorage.getItem("sesionActiva")) {
    if (!localStorage.getItem("token")) {
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
        // const response = await fetch(`${URL_BASE}/proyectos`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(formData) // FormData gestiona automáticamente el Content-Type
        // });

        // const result = await response.json();

        const result = await peticionSegura("/proyectos", {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        if (result && result.success) {
            feedback.className = "mt-3 text-center text-success";
            feedback.innerText = "Proyecto subido correctamente. Importando Excel...";

            // 1. Recogemos el ID (Esto lo estabais haciendo perfecto)
            const idPro = result.data.id; 

            const fileInput = document.getElementById('archivoInput');

            // 2. Comprobamos que haya un archivo seleccionado antes de enviarlo
            if (fileInput.files.length > 0) {
                const excelData = new FormData();

                // 3. CAMBIO CLAVE: Usamos 'excelData.append', no 'formData'
                excelData.append('archivo', fileInput.files[0]);
                excelData.append('proyectoId', idPro);
                excelData.append('usuarioId', 1);

                // 4. CAMBIO CLAVE: Quitamos los headers para que el navegador gestione el Multipart
                const excelResponse = await fetch(`${URL_BASE}/estimaciones/importar`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}` 
                        // IMPORTANTE: No poner 'Content-Type' aquí, el navegador lo pone solo al ver FormData
                    },
                    body: excelData 
                });

                const excelResult = await excelResponse.json();

                if (excelResult.success) {
                    feedback.innerText = "Proyecto y Excel subidos correctamente.";
                    setTimeout(() => window.location.href = "proyectos.html", 1500);
                } else {
                    feedback.className = "mt-3 text-center text-danger";
                    feedback.innerText = "Proyecto creado, pero error en Excel: " + excelResult.mensaje;
                }
            } else {
                feedback.innerText = "Proyecto creado sin Excel adjunto.";
                setTimeout(() => window.location.href = "proyectos.html", 1500);
            }

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