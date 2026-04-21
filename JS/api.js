const URL_BASE = "http://localhost:8080/api";

async function peticionSegura(endpoint, opciones = {}) {
    const token = localStorage.getItem("token");

    // Preparamos las cabeceras básicas
    const headersBase = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    // Combinamos las cabeceras base con las que nos pasen (si hay)
    opciones.headers = {
        ...headersBase,
        ...opciones.headers
    };

    try {
        const response = await fetch(`${URL_BASE}${endpoint}`, opciones);
        
        // Si el servidor nos dice que el token ya no vale (403), mandamos al login
        if (response.status === 403) {
            console.error("Sesión expirada o sin permisos");
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        return await response.json();
    } catch (error) {
        console.error("Error en la petición:", error);
        throw error;
    }
}