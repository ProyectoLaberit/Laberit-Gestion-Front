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
            // Guardar sesión
            localStorage.setItem("sesionActiva", "true");
            
            // Accedemos a result.data.usuario gracias al Map de Java
            localStorage.setItem("usuarioData", JSON.stringify(result.data.usuario));

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