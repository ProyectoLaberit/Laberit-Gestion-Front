// Verificación de sesión al cargar
window.onload = function() {
    // if (!localStorage.getItem("sesionActiva")) {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    cargarDatosPerfil();
};

function cargarDatosPerfil() {
    // Recuperamos los datos que guardamos en el login
    const userData = JSON.parse(localStorage.getItem("usuarioData"));
    
    if (userData) {
        // Rellenamos los campos mapeando las propiedades exactas del UsuarioDTO
        document.getElementById('user-email').innerText = userData.email || "Sin email";
        document.getElementById('user-fullname').innerText = userData.nombre || "Sin nombre";
        
        // Si el usuario tiene un rol asignado, lo mostramos (opcional)
        if (userData.rol) {
            document.getElementById('user-role-display').innerText = "Rol: " + userData.rol;
        } else {
            document.getElementById('user-role-display').innerText = "Rol: Usuario";
        }
    }
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}