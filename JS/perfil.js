// Verificación de sesión al cargar
window.onload = function() {
    if (!localStorage.getItem("sesionActiva")) {
        window.location.href = "login.html";
        return;
    }
    cargarDatosPerfil();
};

function cargarDatosPerfil() {
    // Recuperamos los datos que guardamos en el login
    const userData = JSON.parse(localStorage.getItem("usuarioData"));
    
    if (userData) {
        // Asumiendo que userData tiene estos campos según tu backend
        // Puedes personalizar qué datos mostrar aquí
        document.getElementById('user-email').innerText = "admin"; // Simulado basándonos en tu UsuarioService
        document.getElementById('user-fullname').innerText = "Administrador Laberit";
        document.getElementById('user-role-display').innerText = "Rol: Admin";
    }
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "login.html";
}