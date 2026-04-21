// Verificación de sesión
window.onload = function() {
    // if (!localStorage.getItem("sesionActiva")) {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    cargarDatosSubfase();
};

async function cargarDatosSubfase() {
    // Aquí puedes recuperar el ID del proyecto o fase de localStorage
    // similar a como haces en proyectos.js
    const proyectoId = localStorage.getItem("proyectoId");
    
    console.log("Cargando datos para el proyecto:", proyectoId);
    // Lógica para fetch a /api/estimaciones/proyecto/...
}

function cerrarSesion() {
    // localStorage.removeItem("sesionActiva");
    localStorage.clear();
    window.location.href = "login.html";
}