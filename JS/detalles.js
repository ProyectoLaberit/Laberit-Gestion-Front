// Estructura de fases y subfases
// const URL_BASE = "http://localhost:8080/api/fases/jerarquia";

window.onload = function() {
    // if (!localStorage.getItem("sesionActiva")) {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    cargarSubfases();
};


async function cargarSubfases() {

    const proyectoId = localStorage.getItem("proyectoId");

    // const response = await fetch(`${URL_BASE}`);
    // const result = await response.json();
    const result = await peticionSegura(`/fases/${proyectoId}`);

    // Si la petición falla o el servidor nos rechaza, paramos
    if (!result || !result.success) {
        console.error("No se pudieron cargar las fases.");
        return;
    }

    const fases = result.data;
    const ESTRUCTURA_PROYECTO = {};
    const ids = {};

    fases.forEach(p => {
        ESTRUCTURA_PROYECTO[p.nombre] = p.subfases.map(a => a.nombre);
        p.subfases.map(s =>
            ids[s.nombre] = s.id
        );
    });

    // --- SEGUNDA LLAMADA: Fallos Clockify ---
    let listaFallos = [];
    
    try {
        const resultFallos = await peticionSegura(`/fallos/${proyectoId}`);
        
        if (resultFallos && resultFallos.success && resultFallos.data) {
            // Nos aseguramos de sacar el texto, venga como string puro o como objeto
            listaFallos = resultFallos.data.map(f => typeof f === 'string' ? f : (f.nombre || f.tarea || "Desconocida"));
        }
    } catch (error) {
        console.warn("No se pudieron cargar los fallos o no hay fallos:", error);
        // Capturamos el error de forma silenciosa para que no salte nada si simplemente no hay fallos.
    }

    cargarVistaDetalles(ESTRUCTURA_PROYECTO, ids, listaFallos);


}

function cargarVistaDetalles(estructura, ids, fallos) {
    // Lógica para mostrar el nombre del proyecto
    const proyectoId = localStorage.getItem("proyectoId");
    const proyectos = JSON.parse(localStorage.getItem("proyectos") || "[]");
    const proyectoActual = proyectos.find(p => String(p.id) === String(proyectoId));

    document.getElementById('proyecto-nombre-display').innerText = proyectoActual ? proyectoActual.nombre : "Proyecto " + proyectoId;

    // CONFIGURACIÓN DEL BUSCADOR
    const inputBusqueda = document.getElementById('input-busqueda');
    if (inputBusqueda) {
        // El evento 'input' se dispara cada vez que el usuario escribe una letra
        inputBusqueda.addEventListener('input', (e) => {
            const textoBusqueda = e.target.value;
            renderizarTodo(textoBusqueda, estructura, ids, fallos);
        });
    }

    console.log(estructura);

    renderizarTodo("", estructura, ids, fallos); // Carga inicial sin filtro
}

function renderizarTodo(filtro = "", estr, ids, fallos = []) {

    let ESTRUCTURA_PROYECTO = estr;
    const contenedor = document.getElementById('contenedor-fases');
    contenedor.innerHTML = "";

    // Convertimos a minúsculas para que la búsqueda no distinga entre "A" y "a"
    const filtroNormalizado = filtro.toLowerCase().trim();

    //Pintar fases
    for (const fase in ESTRUCTURA_PROYECTO) {
        const subfases = ESTRUCTURA_PROYECTO[fase];

        // Filtramos las subfases que contienen el texto buscado
        const subfasesFiltradas = subfases.filter(sub =>
            sub.toLowerCase().includes(filtroNormalizado)
        );

        // Si después de filtrar no queda ninguna subfase en esta fase, no dibujamos la fase
        if (subfasesFiltradas.length === 0) continue;

        const seccion = document.createElement('section');
        seccion.className = "phase-section";

        let htmlContent = `<h3 class="phase-header h5">${fase}</h3>`;
        htmlContent += `<div class="row g-3">`;

        subfasesFiltradas.forEach(sub => {
            htmlContent += `
                <div class="col-12 col-md-6 col-lg-3">
                    <div class="card subfase-card p-3 shadow-sm h-100" onclick="irASubfase('${sub}, ${ids[sub]}')">
                        <div class="fw-bold text-dark">${sub}</div>
                        <div class="text-muted small mt-2">Haga clic para ver tareas</div>
                    </div>
                </div>
            `;
        });

        htmlContent += `</div>`;
        seccion.innerHTML = htmlContent;
        contenedor.appendChild(seccion);
    }

        // --- PINTAR LA SECCIÓN "SIN VINCULAR" ---
    if (fallos && fallos.length > 0) {
        // También aplicamos el buscador a las tareas con fallo
        const fallosFiltrados = fallos.filter(f => f.toLowerCase().includes(filtroNormalizado));

        if (fallosFiltrados.length > 0) {
            const seccionFallos = document.createElement('section');
            seccionFallos.className = "phase-section mt-5"; // mt-5 para separar un poco más del resto

            // Cabecera en rojo para destacar
            let htmlFallos = `<h3 class="phase-header h5 text-danger" style="border-bottom-color: #dc3545;">SIN VINCULAR (FALLOS CLOCKIFY)</h3><div class="row g-3">`;

            fallosFiltrados.forEach(fallo => {
                // Estas tarjetas no tienen onclick porque no hay tareas dentro, son solo aviso
                htmlFallos += `
                    <div class="col-12 col-md-6 col-lg-3">
                        <div class="card subfase-card p-3 shadow-sm h-100" style="border-left-color: #dc3545; cursor: default;">
                            <div class="fw-bold text-dark">${fallo}</div>
                            <div class="text-danger small mt-2">Revisar nomenclatura</div>
                        </div>
                    </div>
                `;
            });

            htmlFallos += `</div>`;
            seccionFallos.innerHTML = htmlFallos;
            contenedor.appendChild(seccionFallos);
        }
    }
}

function irASubfase(nombreSubfase) {

    const partes = nombreSubfase.split(',');

    localStorage.setItem("idSubfase", partes[1]);
    localStorage.setItem("subfaseSeleccionada", partes[0]);
    window.location.href = "subfase.html";
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}