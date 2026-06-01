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
        roles: ["SuperAdministrador", "Administrador"]
    },
    {
        href: "gestionusuarios.html",
        label: "Gestion Usuarios",
        roles: ["SuperAdministrador", "Administrador"]
    },
    {
        href: "gestionproyectos.html",
        label: "Gestion Proyectos",
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

const PAGINAS_PERMITIDAS_EMPLEADO = new Set([
    "proyectos.html",
    "detalles.html",
    "subfase.html",
    "paginatareas.html",
    "perfil.html",
    "visualizartareas.html",
    "visualizartareasgitlab.html"
]);

// Realiza peticiones al backend anadiendo el token de sesion,
// controlando errores comunes y redirigiendo si la sesion expira.
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

// Devuelve el rol guardado para el usuario actual en la sesion.
function getRolActual() {
    return localStorage.getItem("usuarioRol") || "";
}

// Comprueba si el usuario actual tiene permisos de administrador.
function esAdmin() {
    const rol = getRolActual();
    return rol === "SuperAdministrador" || rol === "Administrador";
}

// Comprueba si el usuario actual tiene el rol de SuperAdministrador.
function esSuperAdmin() {
    return getRolActual() === "SuperAdministrador";
}

// Comprueba si el usuario actual tiene el rol de Empleado.
function esEmpleado() {
    return getRolActual() === "Empleado";
}

// Devuelve el identificador del usuario autenticado.
function getIdActual() {
    return parseInt(localStorage.getItem("usuarioId") || "0", 10);
}

// Valida que exista sesion y que el rol actual pueda acceder a esta vista.
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

// Devuelve el nombre del archivo HTML actual para poder ocultarlo del menu.
function obtenerNombrePaginaActual() {
    const ruta = window.location.pathname || "";
    const partes = ruta.split(/[\\/]/);
    return (partes[partes.length - 1] || "").toLowerCase();
}

// Bloquea el acceso directo de empleados a pantallas fuera de su flujo permitido.
function redirigirEmpleadoSiPaginaNoPermitida() {
    if (!localStorage.getItem("token") || !esEmpleado()) {
        return false;
    }

    const paginaActual = obtenerNombrePaginaActual();
    if (PAGINAS_PERMITIDAS_EMPLEADO.has(paginaActual)) {
        return false;
    }

    window.location.replace("proyectos.html");
    return true;
}

// Comprueba si un elemento del menu debe mostrarse para el rol indicado.
function puedeVerNavItem(item, rol) {
    return item.roles.includes(rol);
}

// Construye la barra de navegacion mostrando solo los enlaces permitidos.
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

// Traduce los alias de rol minimo a los roles reales usados por la aplicacion.
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

// Oculta los elementos del DOM cuyo rol minimo no cumple el usuario actual.
function aplicarRestriccionesPorRol() {
    const rol = getRolActual();

    document.querySelectorAll("[data-rol-minimo]").forEach(el => {
        const permitidos = normalizarRolMinimo(el.getAttribute("data-rol-minimo"));
        if (permitidos.length > 0 && !permitidos.includes(rol)) {
            el.style.display = "none";
        }
    });
}

// Recalcula los permisos visibles en la interfaz segun el rol actual.
function aplicarPermisosDom() {
    renderizarNavbar();
    aplicarRestriccionesPorRol();
}

// Obtiene todos los selects compatibles dentro del ambito recibido.
function obtenerSelectsSelect2(scope = document) {
    if (!scope) {
        return [];
    }

    if (scope.matches && scope.matches("select.form-select:not([data-no-select2])")) {
        return [scope];
    }

    if (scope.querySelectorAll) {
        return Array.from(scope.querySelectorAll("select.form-select:not([data-no-select2])"));
    }

    return [];
}

// Define un placeholder coherente tomando primero el atributo data-placeholder.
function obtenerPlaceholderSelect2(select) {
    const placeholder = select.getAttribute("data-placeholder");
    if (placeholder) {
        return placeholder;
    }

    const primeraOpcion = select.querySelector("option[value=''], option:not([value])");
    if (primeraOpcion && primeraOpcion.textContent.trim()) {
        return primeraOpcion.textContent.trim();
    }

    return "Selecciona una opcion";
}

// Aplica Select2 a los desplegables Bootstrap para permitir busqueda dentro de las opciones.
function inicializarSelect2(scope = document, reinicializar = false) {
    if (!window.jQuery || !window.jQuery.fn || !window.jQuery.fn.select2) {
        return;
    }

    obtenerSelectsSelect2(scope).forEach((select) => {
        const $select = window.jQuery(select);

        if ($select.hasClass("select2-hidden-accessible")) {
            if (!reinicializar) {
                $select.trigger("change.select2");
                return;
            }

            $select.select2("destroy");
        }

        const opciones = {
            theme: "bootstrap-5",
            width: select.classList.contains("w-auto") ? "resolve" : "100%",
            placeholder: obtenerPlaceholderSelect2(select),
            allowClear: !select.required && !select.multiple,
            language: {
                noResults: () => "No se encontraron resultados",
                searching: () => "Buscando..."
            }
        };

        const contenedorModal = select.closest(".modal, .edit-modal-box");
        if (contenedorModal) {
            opciones.dropdownParent = window.jQuery(contenedorModal);
        }

        $select.select2(opciones);
    });
}

// Fuerza la reconstruccion de Select2 cuando las opciones del select se cargan dinamicamente.
function refrescarSelect2(scope = document) {
    inicializarSelect2(scope, true);
}

window.inicializarSelect2 = inicializarSelect2;
window.refrescarSelect2 = refrescarSelect2;

// Inicializa la navegacion, permisos visibles y desplegables con busqueda al cargar la pagina.
document.addEventListener("DOMContentLoaded", () => {
    if (redirigirEmpleadoSiPaginaNoPermitida()) {
        return;
    }

    aplicarPermisosDom();
    inicializarSelect2();
});
