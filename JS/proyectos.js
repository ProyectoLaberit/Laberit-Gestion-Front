const URL_BASE = "http://localhost:8080/api";

// ─── Guard de sesión ───────────────────────────────────────────────────────
if (!localStorage.getItem("sesionActiva")) {
    window.location.href = "login.html";
}

// ─── Cerrar sesión ─────────────────────────────────────────────────────────
function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}

// ─── Pintar proyectos ──────────────────────────────────────────────────────
async function pintarProyectos() {

    const contenedor = document.getElementById('lista-proyectos');

    const response = await fetch(`${URL_BASE}/proyectos/cargar`);
    const result = await response.json();

    const proyectos = result.data;

    // Guardar correctamente en localStorage
    localStorage.setItem("proyectos", JSON.stringify(proyectos));

    // Validación correcta
    if (!proyectos || proyectos.length === 0) {
        contenedor.innerHTML = `
            <div class="col-12 text-center text-muted py-5">
                No tienes proyectos asociados.
            </div>`;
        return;
    }

    // 🔥 Aquí el cambio importante: usar map en vez de forEach
    contenedor.innerHTML = proyectos.map(p => `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="card project-card p-3">
                <div class="card-body">
                    <div class="card-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M.54 3.87..."/>
                        </svg>
                    </div>
                    <h5 class="card-title fw-bold">${p.nombre}</h5>
                    <p class="card-text text-muted small mb-4">${p.descripcion}</p>
                    <button onclick="verDetalles('${p.id}')" 
                        class="btn btn-outline-dark btn-sm w-100 fw-medium">
                        Ver Detalles
                    </button>
                </div>
            </div>
        </div>
    `).join('');
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