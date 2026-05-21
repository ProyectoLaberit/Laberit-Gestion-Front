let todosLosLogs = [];
let ordenFechaDesc = true;

window.onload = function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    if (!esSuperAdmin()) {
        document.body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                        height:100vh;background:#f8f9fa;font-family:sans-serif;">
                <div style="width:80px;height:80px;background:#fee2e2;border-radius:50%;
                            display:flex;align-items:center;justify-content:center;margin-bottom:1.5rem;">
                    <svg width="40" height="40" fill="none" stroke="#dc2626" stroke-width="2.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                </div>
                <h2 style="color:#1f2937;font-weight:800;margin:0 0 0.5rem;">Acceso no permitido</h2>
                <p style="color:#6c757d;margin:0 0 1.5rem;">Solo el SuperAdministrador puede ver la auditoria.</p>
                <a href="proyectos.html" style="background:#C01717;color:white;padding:10px 24px;
                    border-radius:6px;text-decoration:none;font-weight:600;">Volver a Proyectos</a>
            </div>`;
        return;
    }

    cargarLogs();
    actualizarIndicadorOrdenFecha();
};

async function cargarLogs() {
    const tbody = document.getElementById("tabla-logs");
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">
        <div class="spinner-border spinner-border-sm me-2"></div>Cargando...</td></tr>`;

    const result = await peticionSegura("/audit");

    if (!result || !result.success) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state text-danger">
            Error al cargar los logs.</td></tr>`;
        return;
    }

    todosLosLogs = result.data || [];
    aplicarFiltros();
}

function aplicarFiltros() {
    const accion = document.getElementById("filtro-accion").value;
    const texto = document.getElementById("filtro-texto").value.toLowerCase().trim();

    let filtrados = todosLosLogs;

    if (accion) {
        filtrados = filtrados.filter((log) => log.accion === accion);
    }

    if (texto) {
        filtrados = filtrados.filter((log) =>
            (log.usuarioEmail || "").toLowerCase().includes(texto) ||
            (log.usuarioNombre || "").toLowerCase().includes(texto) ||
            (log.usuarioObjetivoEmail || "").toLowerCase().includes(texto) ||
            (log.usuarioObjetivoNombre || "").toLowerCase().includes(texto) ||
            String(log.idUsuarioActor ?? log.idUsuario ?? "").includes(texto) ||
            String(log.idUsuarioObjetivo ?? "").includes(texto) ||
            (log.descripcion || "").toLowerCase().includes(texto)
        );
    }

    renderizarTabla(ordenarLogsPorFecha(filtrados));
}

function toggleOrdenFecha() {
    ordenFechaDesc = !ordenFechaDesc;
    actualizarIndicadorOrdenFecha();
    aplicarFiltros();
}

function actualizarIndicadorOrdenFecha() {
    const arrow = document.getElementById("sort-fecha-arrow");
    if (!arrow) {
        return;
    }

    arrow.textContent = ordenFechaDesc ? "\u2193" : "\u2191";
    arrow.title = ordenFechaDesc
        ? "Mostrando primero las fechas mas recientes"
        : "Mostrando primero las fechas mas antiguas";
}

function ordenarLogsPorFecha(logs) {
    return [...logs].sort((a, b) => {
        const fechaA = a.fechaHora ? new Date(a.fechaHora).getTime() : 0;
        const fechaB = b.fechaHora ? new Date(b.fechaHora).getTime() : 0;
        return ordenFechaDesc ? fechaB - fechaA : fechaA - fechaB;
    });
}

function renderizarTabla(logs) {
    const tbody = document.getElementById("tabla-logs");
    const contador = document.getElementById("contador-logs");

    contador.textContent = `${logs.length} registro${logs.length !== 1 ? "s" : ""}`;

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No hay registros que coincidan.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map((log) => `
        <tr>
            <td class="text-muted" style="white-space:nowrap;font-size:0.8rem;">
                ${formatearFecha(log.fechaHora)}
            </td>
            <td>${badgeAccion(log.accion)}</td>
            <td>
                <div class="fw-semibold" style="font-size:0.85rem;">${log.usuarioNombre || log.usuarioEmail || "-"}</div>
                <div class="text-muted" style="font-size:0.75rem;">${log.usuarioEmail || ""}</div>
                <div class="text-muted" style="font-size:0.75rem;">ID actor: ${formatearIdUsuario(log.idUsuarioActor ?? log.idUsuario)}</div>
            </td>
            <td>${renderUsuarioObjetivo(log)}</td>
            <td style="max-width:320px;">${log.descripcion || "-"}</td>
        </tr>
    `).join("");
}

function formatearIdUsuario(idUsuario) {
    return idUsuario !== undefined && idUsuario !== null ? `#${idUsuario}` : "-";
}

function renderUsuarioObjetivo(log) {
    if (log.idUsuarioObjetivo === undefined || log.idUsuarioObjetivo === null) {
        return `<span class="text-muted">-</span>`;
    }
    if(log.usuarioObjetivoEmail == null){
        return `<span class="text-muted">${log.idUsuarioObjetivo}</span>`;
    }

    const nombreObjetivo = log.usuarioObjetivoNombre || log.usuarioObjetivoEmail || "Usuario afectado";
    const emailObjetivo = log.usuarioObjetivoEmail || "";

    return `
        <div class="fw-semibold" style="font-size:0.85rem;">${nombreObjetivo}</div>
        <div class="text-muted" style="font-size:0.75rem;">${emailObjetivo}</div>
        <div class="text-muted" style="font-size:0.75rem;">ID objetivo: ${formatearIdUsuario(log.idUsuarioObjetivo)}</div>
    `;
}

function formatearFecha(fechaHora) {
    if (!fechaHora) {
        return "-";
    }

    const fecha = new Date(fechaHora);
    return fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
        + " "
        + fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function badgeAccion(accion) {
    const mapa = {
        IMPORTAR_EXCEL: ["badge-importacion", "Importacion Excel"],
        ACTUALIZAR_ESTIMACION: ["badge-estimacion", "Cambio Estimacion"],
        CREAR_ESTIMACION: ["badge-creacion", "Creacion Estimacion"],
        BORRAR_ESTIMACION: ["badge-borrado", "Borrado Estimacion"],
        SINCRONIZAR_CLOCKIFY: ["badge-sync", "Sincronizacion"],
        CREAR_USUARIO: ["badge-creacion", "Creacion Usuario"],
        BORRAR_USUARIO: ["badge-borrado", "Borrado Usuario"],
        CAMBIAR_ROL: ["badge-rol", "Cambio Rol"],
        ACTUALIZAR_USUARIO: ["badge-rol", "Actualizar Usuario"],
        CAMBIAR_CONTRASENA: ["badge-rol", "Cambiar Contrasena"],
        CAMBIAR_FOTO: ["badge-rol", "Cambiar Foto"]
    };

    const [cls, label] = mapa[accion] || ["badge-otro", accion || "-"];
    return `<span class="badge-accion ${cls}">${label}</span>`;
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
