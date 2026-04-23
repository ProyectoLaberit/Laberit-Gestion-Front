// Verificación de sesión
const URL_BASE = "http://localhost:8080/api/estimaciones";

window.onload = function () {
    if (!localStorage.getItem("sesionActiva")) {
        window.location.href = "login.html";
        return;
    }
    cargarDatosSubfase();
};

async function cargarDatosSubfase() {
    const proyectoId = localStorage.getItem("proyectoId");
    const idSub = localStorage.getItem("idSubfase");
    const nomSub = localStorage.getItem("subfaseSeleccionada");

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
        const response = await fetch(`${URL_BASE}/subfase/tareas`, {
            method: 'POST',
            headers: {
                // Le decimos a Spring Boot que le mandamos un formulario, no un JSON
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: parametros // Metemos los parámetros en el vagón de carga
        });

        const result = await response.json();

        const resp = await fetch(`http://localhost:8080/api/clockify/${proyectoId}/${nomSub}`);

        const res = await resp.json();

        if (result.success) {
            console.log("¡Éxito! Tareas recuperadas:", result.data);
            // Aquí tu lógica para pintar la tabla
            const tar = result.data;
            const tabla = document.getElementById("tablaTar");

            tabla.innerHTML = tar.map(p => `<div class="b-col" id="col-nombre" onclick="detalleTarea('${p.nombreTarea}')">
                    <div class="item">
                        <div class="item-name">${p.nombreTarea}</div>
                    </div>
                </div>

                <!-- Col: Tarea Clockify -->
                <div class="b-col" id="col-clockify">
                    <div class="item">
                        <div class="item-name" id="${p.nombreTarea}">Tiempo Clockify</div>
                    </div>
                </div>

                <!-- Col: Estimaciones -->
                <div class="b-col" id="col-estimaciones">
                    <div class="est-item">
                        <div class="est-val">${p.tiempoTotalMin} - ${p.tiempoTotalMax}</div>
                    </div>
                </div>`).join('');

            cargarClockify(res.data);





        } else {
            console.warn("Aviso del backend:", result.message);
        }

    } catch (error) {
        console.error("Error en la llamada:", error);
    }
}

function cargarClockify(tar) {
    const tiemp = tar;
    tiemp.map(p => {

        let a = document.getElementById(p.titulo);

        a.innerText = p.horasTrabajadas;

    });


}

function detalleTarea(nombreTarea) {

    console.log(nombreTarea);

    localStorage.setItem("nombreTarea", nombreTarea);

    window.location.href = "paginatareas.html";

}

function cerrarSesion() {
    localStorage.removeItem("sesionActiva");
    window.location.href = "login.html";
}