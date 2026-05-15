const URL_BASE = "http://localhost:8080/api";

const NAV_ITEMS = [
    {
        href: "proyectos.html",
        label: "Proyectos",
        roles: ["SuperAdministrador", "Administrador", "Empleado"]
    },
    {
        href: "subirproyecto.html",
        label: "Subir Proyecto",
        roles: ["SuperAdministrador", "Administrador", "Empleado"]
    },
    {
        href: "gestionusuarios.html",
        label: "Gestion Usuarios",
        roles: ["SuperAdministrador", "Administrador"]
    },
    {
        href: "altausuarios.html",
        label: "Alta Usuarios",
        roles: ["SuperAdministrador", "Administrador"]
    },
    {
        href: "auditoria.html",
        label: "Auditoria",
        roles: ["SuperAdministrador"]
    },
    {
        href: "perfil.html",
        label: "Perfil",
        roles: ["SuperAdministrador", "Administrador", "Empleado"]
    }
];

async function peticionSegura(endpoint, opciones = {}) {
    const token = localStorage.getItem("token");

    const headersBase = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };

    opciones.headers = {
        ...headersBase,
        ...opciones.headers
    };

    try {
        const response = await fetch(`${URL_BASE}${endpoint}`, opciones);

        if (response.status === 401) {
            console.error("No autenticado");
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        const contentType = response.headers.get("content-type") || "";
        let payload = null;

        if (contentType.includes("application/json")) {
            payload = await response.json();
        } else {
            const texto = await response.text();
            payload = texto ? { mensaje: texto } : null;
        }

        if (response.status === 403) {
            console.error("Sin permisos para esta accion");
            return {
                success: false,
                mensaje: (payload && payload.mensaje) || "No tienes permisos para realizar esta accion."
            };
        }

        if (!response.ok) {
            return {
                success: false,
                mensaje: (payload && (payload.mensaje || payload.message))
                    || `Error ${response.status} al procesar la peticion.`,
                status: response.status
            };
        }

        return payload;
    } catch (error) {
        console.error("Error en la peticion:", error);
        throw error;
    }
}

function getRolActual() {
    return localStorage.getItem("usuarioRol") || "";
}

function esAdmin() {
    const rol = getRolActual();
    return rol === "SuperAdministrador" || rol === "Administrador";
}

function esSuperAdmin() {
    return getRolActual() === "SuperAdministrador";
}

function esEmpleado() {
    return getRolActual() === "Empleado";
}

function getIdActual() {
    return parseInt(localStorage.getItem("usuarioId") || "0", 10);
}

function verificarAcceso(rolesPermitidos) {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return false;
    }

    const rol = getRolActual();
    const permitido = rolesPermitidos.some(r => r.toUpperCase() === rol.toUpperCase());

    if (!permitido) {
        alert("No tienes permisos para acceder a esta seccion.");
        window.location.href = "proyectos.html";
        return false;
    }

    return true;
}

function obtenerNombrePaginaActual() {
    const ruta = window.location.pathname || "";
    const partes = ruta.split(/[\\/]/);
    return (partes[partes.length - 1] || "").toLowerCase();
}

function puedeVerNavItem(item, rol) {
    return item.roles.includes(rol);
}

function renderizarNavbar() {
    const navLista = document.querySelector(".navbar-nav");
    if (!navLista) {
        return;
    }

    const rol = getRolActual();
    const paginaActual = obtenerNombrePaginaActual();

    const enlacesVisibles = NAV_ITEMS
        .filter(item => puedeVerNavItem(item, rol))
        .filter(item => item.href.toLowerCase() !== paginaActual);

    const htmlEnlaces = enlacesVisibles.map(item => {
        return `<li class="nav-item"><a class="nav-link" href="${item.href}">${item.label}</a></li>`;
    }).join("");

    navLista.innerHTML = `
        ${htmlEnlaces}
        <li class="nav-item border-start border-secondary ps-3 ms-1 d-none d-lg-block"></li>
        <li class="nav-item">
            <button onclick="cerrarSesion()" class="btn-outline-nav">Salir</button>
        </li>
    `;
}

function normalizarRolMinimo(valor) {
    switch ((valor || "").toUpperCase()) {
        case "ADMIN":
            return ["Administrador", "SuperAdministrador"];
        case "SUPERADMIN":
            return ["SuperAdministrador"];
        case "MANAGER":
            return ["Administrador", "SuperAdministrador"];
        case "EMPLEADO":
            return ["Empleado", "Administrador", "SuperAdministrador"];
        default:
            return [];
    }
}

function aplicarRestriccionesPorRol() {
    const rol = getRolActual();

    document.querySelectorAll("[data-rol-minimo]").forEach(el => {
        const permitidos = normalizarRolMinimo(el.getAttribute("data-rol-minimo"));
        if (permitidos.length > 0 && !permitidos.includes(rol)) {
            el.style.display = "none";
        }
    });
}

function aplicarPermisosDom() {
    renderizarNavbar();
    aplicarRestriccionesPorRol();
}

document.addEventListener("DOMContentLoaded", aplicarPermisosDom);
