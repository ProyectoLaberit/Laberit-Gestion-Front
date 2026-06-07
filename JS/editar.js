let proyectoActual = null;

// Inicializa la pantalla, valida la sesion activa y carga el contexto
// principal necesario antes de que el usuario empiece a interactuar.
window.onload = async function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    await cargarClockify();
    await cargarGitlab();
    await cargarProyectoActual();
};

// Refleja en la interfaz el nombre del archivo que acaba de seleccionar el usuario.
function mostrarNombre(input) {
    const label = document.getElementById("labelArchivo");
    if (!label) {
        return;
    }

    if (input.files && input.files.length > 0) {
        label.innerText = "Archivo: " + input.files[0].name;
        label.style.color = "#000";
        return;
    }

    label.innerText = "Seleccionar archivo de tu ordenador";
    label.style.color = "";
}

// Recupera el proyecto seleccionado desde la sesion y rellena el formulario de edicion.
async function cargarProyectoActual() {
    const proyectoId = localStorage.getItem("proyectoId");
    const feedback = document.getElementById("msg-feedback");

    if (!proyectoId) {
        if (feedback) {
            feedback.className = "mt-3 text-center text-danger";
            feedback.innerText = "No se ha encontrado el proyecto a editar.";
        }
        return;
    }

    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    proyectoActual = proyectos.find((proyecto) => String(proyecto.id) === String(proyectoId)) || null;

    if (!proyectoActual) {
        if (feedback) {
            feedback.className = "mt-3 text-center text-danger";
            feedback.innerText = "No se han podido recuperar los datos del proyecto.";
        }
        return;
    }

    document.getElementById("nombre").value = proyectoActual.nombre || "";
    document.getElementById("descripcion").value = proyectoActual.descripcion || "";
    document.getElementById("fechaInicio").value = normalizarFechaInput(proyectoActual.fechaInicio);
    document.getElementById("proyectoActivo").checked = proyectoActual.activo === true || proyectoActual.activo === "true";

    seleccionarValorEnSelect("clockifyId", proyectoActual.clockifyId);
    seleccionarValorEnSelect("gitlabId", proyectoActual.gitlabId);
    actualizarModoPantalla();
}

// Ajusta titulos y mensajes segun el proyecto ya tenga Excel asociado o no.
function actualizarModoPantalla() {
    const titulo = document.getElementById("titulo-editar-proyecto");
    const botonGuardar = document.getElementById("btn-guardar-proyecto");
    const textoAyudaExcel = document.getElementById("texto-ayuda-excel");

    if (!titulo || !botonGuardar || !textoAyudaExcel || !proyectoActual) {
        return;
    }

    const tieneExcel = proyectoActual.excels === true || proyectoActual.excels === "true";

    if (tieneExcel) {
        titulo.innerText = "Editar Proyecto";
        botonGuardar.innerText = "Guardar cambios";
        textoAyudaExcel.innerText = "Puedes actualizar el proyecto y, si quieres, adjuntar un Excel nuevo.";
        return;
    }

    titulo.innerText = "Añadir Excel al Proyecto";
    botonGuardar.innerText = "Guardar y añadir Excel";
    textoAyudaExcel.innerText = "Este proyecto ya existe. Ahora puedes adjuntarle el Excel y completar la importación.";
}

// Convierte distintas fechas de entrada al formato esperado por un input date.
function normalizarFechaInput(valor) {
    if (!valor) {
        return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return valor;
    }

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
        return "";
    }

    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// Selecciona en un desplegable el valor recibido si existe entre las opciones cargadas.
function seleccionarValorEnSelect(idSelect, valor) {
    const select = document.getElementById(idSelect);
    if (!select || valor === undefined || valor === null || valor === "") {
        return;
    }

    const valorTexto = String(valor);
    const existeOpcion = Array.from(select.options).some((option) => String(option.value) === valorTexto);

    if (existeOpcion) {
        select.value = valorTexto;

        if (typeof inicializarSelect2 === "function") {
            inicializarSelect2(select);
        }
    }
}

// Guarda el proyecto actual en el backend y, si corresponde, sube tambien su Excel.
async function guardarProyecto() {
    const feedback = document.getElementById("msg-feedback");
    const fileInput = document.getElementById("archivoInput");
    const botonGuardar = document.getElementById("btn-guardar-proyecto");
    const botonCancelar = document.getElementById("btn-cancelar-proyecto");

    if (botonGuardar) botonGuardar.disabled = true;
    if (botonCancelar) botonCancelar.disabled = true;

    const tieneExcel = Boolean(fileInput && fileInput.files && fileInput.files.length > 0);

    const nombre = document.getElementById("nombre").value;
    const descripcion = document.getElementById("descripcion").value;
    const fechaInicio = document.getElementById("fechaInicio").value || "";
    const activo = document.getElementById("proyectoActivo").checked;
    const gitlabId = document.getElementById("gitlabId").value;
    const clockifyId = document.getElementById("clockifyId").value;
    const id = localStorage.getItem("proyectoId");

    const proyectoData = {
        id,
        nombre,
        descripcion,
        fechaInicio,
        activo,
        gitlabId,
        clockifyId,
        enBaseDatos: false,
        excels: tieneExcel || Boolean(proyectoActual && (proyectoActual.excels === true || proyectoActual.excels === "true"))
    };

    try {
        feedback.className = "mt-3 text-center text-muted";
        feedback.innerText = "Guardando proyecto...";

        const result = await peticionSegura(`/proyectos/${id}`, {
            method: "PUT",
            body: JSON.stringify(proyectoData)
        });

        if (!result || !result.success) {
            feedback.className = "mt-3 text-center text-danger";
            feedback.innerText = "Error: " + ((result && result.mensaje) || "No se pudo guardar el proyecto.");
            if (botonGuardar) botonGuardar.disabled = false;
            if (botonCancelar) botonCancelar.disabled = false;
            return;
        }

        if (tieneExcel) {
            feedback.innerText = "Proyecto guardado. Importando Excel...";

            const excelResult = await subirExcelProyecto(id, fileInput.files[0]);
            if (!excelResult || !excelResult.success) {
                feedback.className = "mt-3 text-center text-danger";
                feedback.innerText = "Proyecto guardado, pero hubo un error al importar el Excel.";
                if (botonGuardar) botonGuardar.disabled = false;
                if (botonCancelar) botonCancelar.disabled = false;
                return;
            }

            // Al subir un Excel nuevo, borramos la preferencia guardada
            // para que al entrar a detalles se seleccione automáticamente el nuevo (vigente).
            localStorage.removeItem(`idExcelHistorialSeleccionado-${id}`);

            feedback.className = "mt-3 text-center text-success";
            feedback.innerText = "Proyecto actualizado y Excel importado correctamente.";
        } else {
            feedback.className = "mt-3 text-center text-success";
            feedback.innerText = "Proyecto guardado correctamente.";
        }

        setTimeout(() => {
            window.location.href = "proyectos.html";
        }, 1500);
    } catch (error) {
        feedback.className = "mt-3 text-center text-danger";
        feedback.innerText = "Error de conexión con el servidor.";
        console.error("Error:", error);
        if (botonGuardar) botonGuardar.disabled = false;
        if (botonCancelar) botonCancelar.disabled = false;
    }
}

// Sube el Excel del proyecto usando multipart para completar la importacion.
async function subirExcelProyecto(proyectoId, archivo) {
    const formData = new FormData();
    formData.append("archivo", archivo);
    formData.append("proyectoId", proyectoId);
    formData.append("usuarioId", localStorage.getItem("usuarioId"));

    const token = localStorage.getItem("token");
    const response = await fetch(`${URL_BASE}/estimaciones/importar`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: formData
    });

    return response.json();
}

// Carga las opciones de Clockify disponibles y las inserta en el selector correspondiente.
async function cargarClockify() {
    const feedback = document.getElementById("msg-feedback");

    try {
        const result = await peticionSegura("/clockify/externos");

        if (result && result.success) {
            const select = document.getElementById("clockifyId");
            select.innerHTML = '<option value="">Selecciona un proyecto</option>';

            result.data.forEach((item) => {
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
        feedback.className = "mt-3 text-center text-danger";
        feedback.innerText = "Error de conexión con el servidor.";
        console.error("Error:", error);
    }
}

// Carga las opciones de GitLab disponibles y las inserta en el selector correspondiente.
async function cargarGitlab() {
    const feedback = document.getElementById("msg-feedback");

    try {
        const result = await peticionSegura("/gitlab/externos");

        if (result && result.success) {
            const select = document.getElementById("gitlabId");
            select.innerHTML = '<option value="">Selecciona un proyecto</option>';

            result.data.forEach((item) => {
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
        feedback.className = "mt-3 text-center text-danger";
        feedback.innerText = "Error de conexión con el servidor.";
        console.error("Error:", error);
    }
}

// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
