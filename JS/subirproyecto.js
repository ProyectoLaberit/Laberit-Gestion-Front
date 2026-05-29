// const URL_BASE = "http://localhost:8080/api";

// Inicializa la pantalla, valida la sesion activa y carga el contexto
// principal necesario antes de que el usuario empiece a interactuar.
window.onload = function () {
    // if (!localStorage.getItem("sesionActiva")) {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
    } else {
        cargarClockify();
        cargarGitlab();
    }
};

// Refleja en la interfaz el nombre del archivo que acaba de seleccionar el usuario.
function mostrarNombre(input) {
    const label = document.getElementById('labelArchivo');
    if (input.files.length > 0) {
        label.innerText = "Archivo: " + input.files[0].name;
        label.style.color = "#000";
    }
}

// Guarda el proyecto actual en el backend y, si corresponde, sube tambien su Excel.
async function guardarProyecto() {
    const formulario = document.getElementById('form-subir-proyecto');
    const feedback = document.getElementById('msg-feedback');

    if (!formulario.checkValidity()) {
        formulario.reportValidity();
        return;
    }

    // Comprobar si hay un archivo seleccionado en el input
    const fileInput = document.getElementById('archivoInput');
    const tieneExcel = fileInput.files.length > 0;

    // Recopilar campos incluyendo la bandera 'excels'
    const formData = {
        nombre: document.getElementById('nombre').value,
        descripcion: document.getElementById('descripcion').value,
        fechaInicio: document.getElementById('fechaInicio').value,
        activo: true,
        gitlabId: document.getElementById('gitlabId').value,
        clockifyId: document.getElementById('clockifyId').value,
        excels: tieneExcel // Añadimos esta línea
    };

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
                excelData.append('usuarioId', localStorage.getItem("usuarioId"));

                const token = localStorage.getItem("token");

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

                // const excelResult = await peticionSegura("/estimaciones/importar", {
                //     method: 'POST',
                //     body: excelData,
                //     headers: {} // Vacío para el Multipart
                // });

                if (excelResult && excelResult.success) {
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
        console.error("Detalle del error exacto:", error);
        feedback.className = "mt-3 text-center text-danger";
        feedback.innerText = "Error de conexión con el servidor.";
    }
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}

// Carga las opciones de Clockify disponibles y las inserta en el selector correspondiente.
async function cargarClockify() {
    const feedback = document.getElementById('msg-feedback');


    try {
        // const response = await fetch(`${URL_BASE}/clockify/externos`);

        // const result = await response.json();

        const result = await peticionSegura("/clockify/externos");

        if (result && result.success) {
            const select = document.getElementById("clockifyId");

            select.innerHTML = '<option value="" disabled selected>Selecciona un proyecto</option>';

            result.data.forEach(item => {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = item.nombre;
                select.appendChild(option);
            });

            if (typeof refrescarSelect2 === "function") {
                refrescarSelect2(select);
            }

        }
    } catch (error) {
        feedback.innerText = "Error de conexión con el servidor.";
        console.error("Error:", error);
    }

}

// Carga las opciones de GitLab disponibles y las inserta en el selector correspondiente.
async function cargarGitlab() {
    const feedback = document.getElementById('msg-feedback');


    try {
        // const response = await fetch(`${URL_BASE}/gitlab/externos`);

        // const result = await response.json();

        const result = await peticionSegura("/gitlab/externos");

        if (result && result.success) {

            const select = document.getElementById("gitlabId");

            select.innerHTML = '<option value="" disabled selected>Selecciona un proyecto</option>';

            result.data.forEach(item => {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = item.nombre;
                select.appendChild(option);
            });

            if (typeof refrescarSelect2 === "function") {
                refrescarSelect2(select);
            }

        }
    } catch (error) {
        feedback.innerText = "Error de conexión con el servidor.";
        console.error("Error:", error);
    }

}
