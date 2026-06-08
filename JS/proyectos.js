// Guard de sesion
// if (!localStorage.getItem("sesionActiva")) {
if (!localStorage.getItem("token")) {
    window.location.href = "login.html";
}

// Cerrar sesion
// Elimina la sesion local y redirige al usuario a la pantalla de login.
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}

// Pintar proyectos
// Carga los proyectos visibles, sus resumenes y pinta las tarjetas en ambas categorias.
async function pintarProyectos() {
    console.log("EJECUTANDO PINTAR PROYECTOS. Leyendo filtros...");

    const filtros = {
        activo: document.getElementById("filtro-estado")?.value || "",
        desde: document.getElementById("filtro-desde")?.value || "",
        hasta: document.getElementById("filtro-hasta")?.value || ""
    };

    const filtrosLimpios = Object.fromEntries(
        Object.entries(filtros).filter(([, value]) => value !== "" && value !== null)
    );

    const parametrosURL = new URLSearchParams(filtrosLimpios).toString();
    const endpoint = parametrosURL ? `/proyectos/cargar?${parametrosURL}` : "/proyectos/cargar";

    console.log("URL enviada al backend:", endpoint);

    const contenedorExcel = document.getElementById("lista-proyectos-excel");
    const contenedorSinExcel = document.getElementById("lista-proyectos-sin-excel");

    const result = await peticionSegura(endpoint);

    if (!result || !result.success) {
        contenedorExcel.innerHTML = '<div class="col-12 text-center text-danger">Error al cargar proyectos.</div>';
        contenedorSinExcel.innerHTML = "";
        return;
    }

    const proyectos = result.data;
    localStorage.setItem("proyectos", JSON.stringify(proyectos));

    if (!proyectos || proyectos.length === 0) {
        contenedorExcel.innerHTML = `
            <div class="col-12 text-center text-muted py-5">
                No tienes proyectos asociados.
            </div>`;
        contenedorSinExcel.innerHTML = "";
        return;
    }

    let resumenesProyectos = {};
    try {
        const ids = proyectos.map((p) => p.id);
        const resTiempos = await peticionSegura("/estimaciones/proyectos/resumen", {
            method: "POST",
            body: JSON.stringify(ids)
        });

        if (resTiempos && resTiempos.success) {
            resumenesProyectos = resTiempos.data;
        }
    } catch (error) {
        console.error("Error al cargar tiempos de proyectos", error);
    }

    const proyectosConExcel = proyectos.filter((p) => p.excels === true || p.excels === "true");
    const proyectosSinExcel = proyectos.filter(
        (p) => p.excels === false || p.excels === "false" || !p.excels
    );

// Genera las tarjetas HTML de proyectos separando la accion principal segun tengan Excel o no.
    const generarTarjetas = (lista, tieneExcel) => {
        if (lista.length === 0) {
            return '<div class="col-12 text-center text-muted py-4">No hay proyectos en esta categoria.</div>';
        }

        return lista
            .map((p) => {
                const tiempos = resumenesProyectos[p.id] || {
                    tiempoRealTotal: 0,
                    tiempoEstimadoMin: 0,
                    tiempoEstimadoMax: 0
                };

                const displayReal = formatoHoras(parseFloat(tiempos.tiempoRealTotal));
                const displayMin = formatoHoras(parseFloat(tiempos.tiempoEstimadoMin));
                const displayMax = formatoHoras(parseFloat(tiempos.tiempoEstimadoMax));
                const accionPrincipal = tieneExcel
                    ? `
                        <button onclick="verDetalles('${p.id}')" class="btn btn-outline-dark btn-sm w-100 fw-medium">
                            Ver Detalles
                        </button>
                    `
                    : `
                        <button onclick="anadirExcel('${p.id}')" class="btn btn-outline-dark btn-sm w-100 fw-medium">
                            Añadir Excel
                        </button>
                    `;
                const textoSecundario = tieneExcel
                    ? ""
                    : `<p class="text-muted small mb-3">Este proyecto ya existe, solo falta adjuntarle el Excel.</p>`;

                return `
                    <div class="col-12 col-md-6 col-lg-4">
                        <div class="card project-card p-3">
                            <div class="card-body">
                                <div class="project-card-top">
                                    <div class="card-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31zM2.19 4a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4H2.19zm4.69-1.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z"/>
                                        </svg>
                                    </div>

                                    <div class="project-time-summary">
                                        ${displayReal} / ${displayMin} - ${displayMax}
                                    </div>
                                </div>

                                <h5 class="card-title fw-bold">${p.nombre}</h5>
                                <p class="card-text text-muted small mb-4">${p.descripcion || ""}</p>
                                ${textoSecundario}
                                ${accionPrincipal}
                            </div>
                        </div>
                    </div>
                `;
            })
            .join("");
    };

    contenedorExcel.innerHTML = generarTarjetas(proyectosConExcel, true);
    contenedorSinExcel.innerHTML = generarTarjetas(proyectosSinExcel, false);
}

// Guarda el proyecto seleccionado y navega a su pantalla de detalles.
function verDetalles(proyectoId) {
    console.log("Ver detalles del proyecto:", proyectoId);
    localStorage.setItem("proyectoId", proyectoId);
    window.location.href = "detalles.html";
}

// Guarda el proyecto seleccionado y abre la pantalla para adjuntarle un Excel.
function anadirExcel(proyectoId) {
    localStorage.setItem("proyectoId", proyectoId);
    window.location.href = "editarproyecto.html?volver=proyectos.html";
}

const usuarioData = localStorage.getItem("usuarioData");
void usuarioData;
pintarProyectos();

// Convierte horas decimales a un formato mas legible para mostrarlo en pantalla.
function formatoHoras(decimal) {
    if (!decimal || Number.isNaN(decimal)) {
        return "0h";
    }

    let horas = Math.floor(decimal);
    let minutos = Math.round((decimal - horas) * 60);

    if (minutos === 60) {
        horas += 1;
        minutos = 0;
    }

    if (minutos === 0) {
        return `${horas}h`;
    }

    return `${horas}h ${minutos}min`;
}
