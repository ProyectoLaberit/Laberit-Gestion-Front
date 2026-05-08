
// ─── Guard de sesión ───────────────────────────────────────────────────────
// if (!localStorage.getItem("sesionActiva")) {
if (!localStorage.getItem("token")) {
    window.location.href = "login.html";
}

// ─── Cerrar sesión ─────────────────────────────────────────────────────────
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}

// ─── Pintar proyectos ──────────────────────────────────────────────────────
async function pintarProyectos() {

    // ESTE ES EL CHIVATO
    console.log("¡EJECUTANDO PINTAR PROYECTOS! Leyendo filtros...");
    // 1. Obtener los filtros seleccionados
    const filtros = {
        activo: document.getElementById('filtro-estado')?.value || "",
        desde: document.getElementById('filtro-desde')?.value || "",
        hasta: document.getElementById('filtro-hasta')?.value || ""
    };

    // 2. Limpiar el objeto (quitar los que estén vacíos)
    const filtrosLimpios = Object.fromEntries(
        Object.entries(filtros).filter(([key, value]) => value !== "" && value !== null)
    );

    // 3. Convertir a parámetros de URL
    const parametrosURL = new URLSearchParams(filtrosLimpios).toString();
    
    // 4. Montar el endpoint final (si hay parámetros ponemos '?', si no, no)
    const endpoint = parametrosURL ? `/proyectos/cargar?${parametrosURL}` : "/proyectos/cargar";

    // AÑADE ESTO: Ver qué URL se ha montado
    console.log("1. URL enviada al Backend:", endpoint);

    const contenedorExcel = document.getElementById('lista-proyectos-excel');
    const contenedorSinExcel = document.getElementById('lista-proyectos-sin-excel');

    // 5. Enviar la petición al Backend CON los filtros aplicados
    const result = await peticionSegura(endpoint);

    console.log("2. Proyectos devueltos por el Backend:", result.data);

    // Si la petición falla o no hay éxito, mostramos error y paramos
    if (!result || !result.success) {
        contenedorExcel.innerHTML = '<div class="col-12 text-center text-danger">Error al cargar proyectos.</div>';
        contenedorSinExcel.innerHTML = '';
        return; 
    }

    const proyectos = result.data;

    // Guardar correctamente en localStorage
    localStorage.setItem("proyectos", JSON.stringify(proyectos));

    // Validación correcta de lista vacía
    if (!proyectos || proyectos.length === 0) {
        contenedorExcel.innerHTML = `
            <div class="col-12 text-center text-muted py-5">
                No tienes proyectos asociados.
            </div>`;
        contenedorSinExcel.innerHTML = '';
        return;
    }

    let resumenesProyectos = {};
    try {
        const ids = proyectos.map(p => p.id);
        const resTiempos = await peticionSegura('/estimaciones/proyectos/resumen', {
            method: 'POST',
            body: JSON.stringify(ids)
        });
        if (resTiempos && resTiempos.success) {
            resumenesProyectos = resTiempos.data;
        }
    } catch (e) {
        console.error("Error al cargar tiempos de proyectos", e);
    }

    // Separar los proyectos usando el campo "excels" que viene del backend
    const proyectosConExcel = proyectos.filter(p => p.excels === true || p.excels === "true");
    const proyectosSinExcel = proyectos.filter(p => p.excels === false || p.excels === "false" || !p.excels);

    // Función auxiliar para generar el HTML de las tarjetas
    const generarTarjetas = (lista) => {
        if (lista.length === 0) {
            return `<div class="col-12 text-center text-muted py-4">No hay proyectos en esta categoría.</div>`;
        }

        return lista.map(p => {
            // Buscamos los tiempos de este proyecto en nuestro diccionario
            const t = resumenesProyectos[p.id] || { tiempoRealTotal: 0, tiempoEstimadoMedia: 0 };

            return `
            <div class="col-12 col-md-6 col-lg-4">
                <div class="card project-card p-3">
                    <div class="card-body">
                        <div class="card-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31zM2.19 4a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4H2.19zm4.69-1.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z"/>
                            </svg>
                        </div>
                        <h5 class="card-title fw-bold">${p.nombre}</h5>
                        
                        <div class="text-primary fw-bold mb-2" style="font-size: 1rem;">
                            ${t.tiempoRealTotal}h / ${t.tiempoEstimadoMedia}h
                        </div>

                        <p class="card-text text-muted small mb-4">${p.descripcion || ''}</p>
                        <button onclick="verDetalles('${p.id}')" 
                            class="btn btn-outline-dark btn-sm w-100 fw-medium">
                            Ver Detalles
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join(''); // Cerramos la función del map
    };

    // Inyectar el HTML generado en cada contenedor
    contenedorExcel.innerHTML = generarTarjetas(proyectosConExcel);
    contenedorSinExcel.innerHTML = generarTarjetas(proyectosSinExcel);
}

function verDetalles(proyectoId) {
    // Aquí puedes navegar a una página de detalle o abrir un modal
    console.log("Ver detalles del proyecto:", proyectoId);
    localStorage.setItem("proyectoId", proyectoId);
    window.location.href = "detalles.html";
}

// ─── Cargar proyectos desde localStorage ───────────────────────────────────
const usuarioData = localStorage.getItem("usuarioData");
pintarProyectos();
