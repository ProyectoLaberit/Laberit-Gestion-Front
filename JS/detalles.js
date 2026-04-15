// Estructura de fases y subfases
const ESTRUCTURA_PROYECTO = {
    "Analisis": ["Preventa", "Analisis", "Investigacion", "Infraestructura"],
    "Desarrollo": [
        "Discovery", "Sintesis", "Frontend", "Backend", "Maquetacion", 
        "Ideacion", "Arquitectura", "Wireframes", "HF", "Evaluacion", 
        "Contenidos", "Importaciones", "Ajustes"
    ],
    "Gestiones": ["Despliegue", "Direccion", "Material", "ReuCliente", "ReuInterna", "Terceros"]
};

window.onload = function() {
    if (!localStorage.getItem("sesionActiva")) {
        window.location.href = "login.html";
        return;
    }
    cargarVistaDetalles();
};

function cargarVistaDetalles() {
    // Lógica para mostrar el nombre del proyecto
    const proyectoId = localStorage.getItem("proyectoId");
    const proyectos = JSON.parse(localStorage.getItem("usuarioData") || "[]");
    const proyectoActual = proyectos.find(p => String(p.id) === String(proyectoId));
    
    document.getElementById('proyecto-nombre-display').innerText = proyectoActual ? proyectoActual.nombre : "Proyecto " + proyectoId;

    // CONFIGURACIÓN DEL BUSCADOR
    const inputBusqueda = document.getElementById('input-busqueda');
    if (inputBusqueda) {
        // El evento 'input' se dispara cada vez que el usuario escribe una letra
        inputBusqueda.addEventListener('input', (e) => {
            const textoBusqueda = e.target.value;
            renderizarTodo(textoBusqueda);
        });
    }

    renderizarTodo(); // Carga inicial sin filtro
}

function renderizarTodo(filtro = "") {
    const contenedor = document.getElementById('contenedor-fases');
    contenedor.innerHTML = ""; 
    
    // Convertimos a minúsculas para que la búsqueda no distinga entre "A" y "a"
    const filtroNormalizado = filtro.toLowerCase().trim();

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
                    <div class="card subfase-card p-3 shadow-sm h-100" onclick="irASubfase('${sub}')">
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
}

function irASubfase(nombreSubfase) {
    localStorage.setItem("subfaseSeleccionada", nombreSubfase);
    window.location.href = "subfase.html";
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}