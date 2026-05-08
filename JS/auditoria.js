let todosLosLogs = [];

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
};

async function cargarLogs() {
    const tbody = document.getElementById("tabla-logs");
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">
        <div class="spinner-border spinner-border-sm me-2"></div>Cargando...</td></tr>`;

    const result = await peticionSegura("/audit");

    if (!result || !result.success) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state text-danger">
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
        filtrados = filtrados.filter(l => l.accion === accion);
    }
    if (texto) {
        filtrados = filtrados.filter(l =>
            (l.usuarioEmail || "").toLowerCase().includes(texto) ||
            (l.usuarioNombre || "").toLowerCase().includes(texto) ||
            String(l.idUsuarioActor ?? l.idUsuario ?? "").includes(texto) ||
            String(l.idUsuarioObjetivo ?? "").includes(texto) ||
            (l.descripcion || "").toLowerCase().includes(texto)
        );
    }

    renderizarTabla(filtrados);
}

function renderizarTabla(logs) {
    const tbody = document.getElementById("tabla-logs");
    const contador = document.getElementById("contador-logs");

    contador.textContent = `${logs.length} registro${logs.length !== 1 ? "s" : ""}`;

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay registros que coincidan.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(l => `
        <tr>
            <td class="text-muted" style="white-space:nowrap;font-size:0.8rem;">
                ${formatearFecha(l.fechaHora)}
            </td>
            <td>${badgeAccion(l.accion)}</td>
            <td>
                <div class="fw-semibold" style="font-size:0.85rem;">${l.usuarioNombre || l.usuarioEmail || "-"}</div>
                <div class="text-muted" style="font-size:0.75rem;">${l.usuarioEmail || ""}</div>
                <div class="text-muted" style="font-size:0.75rem;">ID actor: ${formatearIdUsuario(l.idUsuarioActor ?? l.idUsuario)}</div>
            </td>
            <td>${renderUsuarioObjetivo(l)}</td>
            <td style="max-width:320px;">${l.descripcion || "-"}</td>
            <td class="text-muted">${l.idProyecto ? "#" + l.idProyecto : "-"}</td>
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

    const nombreObjetivo = log.usuarioObjetivoNombre || log.usuarioObjetivoEmail || "Usuario afectado";
    const emailObjetivo = log.usuarioObjetivoEmail || "";

    return `
        <div class="fw-semibold" style="font-size:0.85rem;">${nombreObjetivo}</div>
        <div class="text-muted" style="font-size:0.75rem;">${emailObjetivo}</div>
        <div class="text-muted" style="font-size:0.75rem;">ID objetivo: ${formatearIdUsuario(log.idUsuarioObjetivo)}</div>
    `;
}

function formatearFecha(fechaHora) {
    if (!fechaHora) return "-";
    const d = new Date(fechaHora);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
        + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function badgeAccion(accion) {
    const mapa = {
        "IMPORTACION_EXCEL": ["badge-importacion", "Importacion Excel"],
        "CAMBIO_ESTIMACION": ["badge-estimacion", "Cambio Estimacion"],
        "CREACION_ESTIMACION": ["badge-creacion", "Creacion Estimacion"],
        "BORRADO_ESTIMACION": ["badge-borrado", "Borrado Estimacion"],
        "SINCRONIZACION": ["badge-sync", "Sincronizacion"],
        "CREACION_USUARIO": ["badge-creacion", "Creacion Usuario"],
        "BORRADO_USUARIO": ["badge-borrado", "Borrado Usuario"],
        "CAMBIO_ROL": ["badge-rol", "Cambio Rol"],
    };
    const [cls, label] = mapa[accion] || ["badge-otro", accion || "-"];
    return `<span class="badge-accion ${cls}">${label}</span>`;
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}
