const URL_BASE = "http://localhost:8080/api";

async function peticionSegura(endpoint, opciones = {}) {
    const token = localStorage.getItem("token");

    const headersBase = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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

        if (response.status === 403) {
            console.error("Sin permisos para esta acción");
            return { success: false, mensaje: "No tienes permisos para realizar esta acción." };
        }

        return await response.json();
    } catch (error) {
        console.error("Error en la petición:", error);
        throw error;
    }
}

// ── Helpers de rol ────────────────────────────────────────────────────────────

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

/**
 * Redirige a proyectos.html si el usuario no tiene uno de los roles requeridos.
 * Uso: verificarAcceso(["ADMIN", "MANAGER"])
 */
function verificarAcceso(rolesPermitidos) {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return false;
    }
    const rol = getRolActual();
    const permitido = rolesPermitidos.some(r => r.toUpperCase() === rol);
    if (!permitido) {
        alert("No tienes permisos para acceder a esta sección.");
        window.location.href = "proyectos.html";
        return false;
    }
    return true;
}

/**
 * Oculta o muestra elementos del DOM según el rol del usuario.
 * Llama a esta función en el DOMContentLoaded de cada página.
 */
function aplicarPermisosDom() {
    const rol = getRolActual();

    // Elementos visibles solo para ADMIN
    document.querySelectorAll("[data-rol-minimo='ADMIN']").forEach(el => {
        if (rol !== "ADMIN") el.style.display = "none";
    });

    // Elementos visibles para ADMIN y MANAGER
    document.querySelectorAll("[data-rol-minimo='MANAGER']").forEach(el => {
        if (rol !== "ADMIN" && rol !== "MANAGER") el.style.display = "none";
    });

    // Ocultar opciones del nav para empleados
    if (rol === "Empleado") {
        document.querySelectorAll('a[href="altausuarios.html"], a[href="gestionusuarios.html"], a[href="auditoria.html"], a[href="subirproyecto.html"]').forEach(enlace => {
            const itemNav = enlace.closest(".nav-item");
            if (itemNav) {
                itemNav.style.display = "none";
            }
        });
    }

    // Ocultar opciones del nav para admins
    if (rol === "Administrador") {
        document.querySelectorAll('a[href="auditoria.html"]').forEach(enlace => {
            const itemNav = enlace.closest(".nav-item");
            if (itemNav) {
                itemNav.style.display = "none";
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", aplicarPermisosDom);
