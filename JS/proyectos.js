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
function pintarProyectos(proyectos) {
    sessionStorage.setItem("dato", "hola");
    const contenedor = document.getElementById('lista-proyectos');

    if (!proyectos || proyectos.length === 0) {
        contenedor.innerHTML = `<div class="col-12 text-center text-muted py-5">No tienes proyectos asociados.</div>`;
        return;
    }

    contenedor.innerHTML = proyectos.map(p => `
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card project-card p-3">
                        <div class="card-body">
                            <div class="card-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31zM2.19 4a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4H2.19zm4.69-1.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z"/>
                                </svg>
                            </div>
                            <h5 class="card-title fw-bold">${p.nombre}</h5>
                            <p class="card-text text-muted small mb-4">${p.descripcion}</p>
                            <button onclick="verDetalles('${p.id}')" class="btn btn-outline-dark btn-sm w-100 fw-medium">Ver Detalles</button>
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
const proyectos = usuarioData ? JSON.parse(usuarioData) : [];
pintarProyectos(proyectos);