const URL_BASE = "http://localhost:8080/api";

async function realizarLogin() {
    const msgEl = document.getElementById('msg-login');
    msgEl.innerText = "";

    const loginData = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
    };

    
    try {
        const response = await fetch(`${URL_BASE}/usuarios/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();

if (result.success) {
            // Limpiamos rastros antiguos por seguridad
            localStorage.clear();

            // Guardar sesión
            localStorage.setItem("sesionActiva", "true");
            localStorage.setItem("token", result.data.token);
            localStorage.setItem("usuarioId", result.data.id);
            localStorage.setItem("usuarioNombre", result.data.nombre);

            // La caja entera que lee el perfil
            localStorage.setItem("usuarioData", JSON.stringify(result.data));

            if (result.data.rol) {
                localStorage.setItem("usuarioRol", result.data.rol);
            }

            // Redirigir a proyectos
            window.location.href = "proyectos.html";
        } else {
            msgEl.innerText = result.mensaje || "Credenciales incorrectas.";
        }

    } catch (error) {
        msgEl.innerText = "Error de conexión con el servidor.";
        console.error("Error:", error);
    }
}