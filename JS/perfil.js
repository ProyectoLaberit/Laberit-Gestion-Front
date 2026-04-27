// Verificación de sesión al cargar
window.onload = function() {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }
    cargarDatosPerfil();
};

function cargarDatosPerfil() {
    const userData = JSON.parse(localStorage.getItem("usuarioData"));
    
    if (userData) {
        document.getElementById('user-email').innerText = userData.email || "Sin email";
        document.getElementById('user-fullname').innerText = userData.nombre || "Sin nombre";
        
        // Leemos el campo 'foto' directamente
        const avatarFileName = userData.foto || "avatar_masculino.png"; 
        const rutaAvatar = `../img/${avatarFileName}`;
        
        // Actualizamos la imagen grande
        document.getElementById('profile-img').src = `../img/${avatarFileName}`;
        
        // Resaltar el selector pequeño correcto
        document.querySelectorAll('.selector-avatar').forEach(img => img.classList.remove('active'));
        if(avatarFileName === "avatar_masculino.png"){
            document.getElementById('opt-masc').classList.add('active');
        } else {
            document.getElementById('opt-fem').classList.add('active');
        }
        
        // Guardamos en la variable temporal para que esté sincronizado
        avatarSeleccionadoTemporal = avatarFileName;

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

// Función para abrir la mini pantalla
function abrirModal(campo) {
    const userData = JSON.parse(localStorage.getItem("usuarioData"));
    
    document.getElementById('campoAEditar').value = campo;
    document.getElementById('mensajeExito').style.display = 'none'; 
    
    const inputValor = document.getElementById('inputNuevoValor');
    const divPassVieja = document.getElementById('divPasswordVieja');
    const titulo = document.getElementById('tituloModal');

    inputValor.value = '';
    divPassVieja.style.display = 'none';

    if (campo === 'nombre') {
        titulo.innerText = 'Editar Nombre';
        inputValor.type = 'text';
        inputValor.value = userData.nombre || '';
    } else if (campo === 'email') {
        titulo.innerText = 'Editar Correo';
        inputValor.type = 'email';
        inputValor.value = userData.email || '';
    } else if (campo === 'password') {
        titulo.innerText = 'Cambiar Contraseña';
        inputValor.type = 'password';
        inputValor.placeholder = 'Nueva contraseña...';
        divPassVieja.style.display = 'block';
        document.getElementById('inputPasswordVieja').value = '';
    }

    let modalElement = document.getElementById('modalEdicionMini');
    let modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInstance.show();
}

// Función para guardar (SIN pop-ups de éxito)
async function guardarEdicion() {
    const userData = JSON.parse(localStorage.getItem("usuarioData"));
    const campo = document.getElementById('campoAEditar').value;
    const nuevoValor = document.getElementById('inputNuevoValor').value;
    const token = localStorage.getItem("token");

    if (!nuevoValor) return;

    try {
        let response, data;

        if (campo === 'password') {
            const passVieja = document.getElementById('inputPasswordVieja').value;
            if (!passVieja) return;

            response = await fetch(`http://localhost:8080/api/usuarios/${userData.id}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ passwordVieja: passVieja, passwordNueva: nuevoValor })
            });
        } 
        else {
            const body = {};
            body[campo] = nuevoValor;

            response = await fetch(`http://localhost:8080/api/usuarios/${userData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
        }

        data = await response.json();

        // AQUÍ ESTÁ LA CORRECCIÓN: usamos data.success en lugar de data.exito
        if (data.success) {
            
            // Mostramos el texto verde sin pop-ups
            document.getElementById('mensajeExito').style.display = 'block';
            
            if (campo !== 'password') {
                userData[campo] = nuevoValor;
                localStorage.setItem("usuarioData", JSON.stringify(userData));
                cargarDatosPerfil();
            }

            // Cerramos la ventana tras 1.5 segundos
            setTimeout(() => {
                let modalElement = document.getElementById('modalEdicionMini');
                let modalInstance = bootstrap.Modal.getInstance(modalElement);
                modalInstance.hide();
            }, 1500);

        } else {
            // Si hay un error real (ej: contraseña actual incorrecta)
            alert("Error: " + data.mensaje);
        }
    } catch (error) {
        alert("Error de conexión con el servidor.");
    }


}

async function guardarCambioAvatar() {
    const userData = JSON.parse(localStorage.getItem("usuarioData"));
    const token = localStorage.getItem("token");
    
    if (!avatarSeleccionadoTemporal) return;

    try {
        const response = await fetch(`http://localhost:8080/api/usuarios/${userData.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                // Enviamos el campo exactamente como 'foto'
                foto: avatarSeleccionadoTemporal
            })
        });

        const data = await response.json();

        if (data.success) {
            // Actualizar localStorage con la propiedad correcta
            userData.foto = avatarSeleccionadoTemporal;
            localStorage.setItem("usuarioData", JSON.stringify(userData));
            
            // Mostrar mensaje de éxito
            const mensajeHtml = document.getElementById('mensajeExitoAvatar');
            mensajeHtml.style.display = 'block';
            
            setTimeout(() => {
                mensajeHtml.style.display = 'none';
            }, 2000);

        } else {
            alert("Error al guardar: " + data.mensaje);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Error de conexión con el servidor.");
    }
}

let avatarSeleccionadoTemporal = "";

// 1. Abre la ventanita y marca el avatar que ya tienes guardado
function abrirModalFoto() {
    const userData = JSON.parse(localStorage.getItem("usuarioData"));
    const avatarFileName = userData.foto || "avatar_masculino.png";
    avatarSeleccionadoTemporal = avatarFileName;

    // Esconder mensaje verde por si se abre de nuevo
    document.getElementById('mensajeExitoFoto').style.display = 'none';

    // Limpiar selecciones previas
    document.querySelectorAll('#modalEdicionFoto .selector-avatar').forEach(img => img.classList.remove('active'));
    
    // Marcar la foto correcta
    if(avatarFileName === "avatar_femenino.png") {
        document.getElementById('opt-fem').classList.add('active');
    } else {
        document.getElementById('opt-masc').classList.add('active');
    }

    // Mostrar modal
    let modalElement = document.getElementById('modalEdicionFoto');
    let modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInstance.show();
}

// 2. Cambia el borde azul cuando haces clic en una foto dentro de la ventanita
function seleccionarAvatar(nombreArchivo, elementoContenedor) {
    avatarSeleccionadoTemporal = nombreArchivo;
    document.querySelectorAll('#modalEdicionFoto .selector-avatar').forEach(img => img.classList.remove('active'));
    elementoContenedor.querySelector('.selector-avatar').classList.add('active');
}

// 3. Guarda la foto en la Base de Datos
async function guardarFoto() {
    const userData = JSON.parse(localStorage.getItem("usuarioData"));
    const token = localStorage.getItem("token");

    if (!avatarSeleccionadoTemporal) return;

    try {
        const response = await fetch(`http://localhost:8080/api/usuarios/${userData.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ foto: avatarSeleccionadoTemporal })
        });

        const data = await response.json();

        if (data.success) {
            // Actualizar los datos guardados en el navegador
            userData.foto = avatarSeleccionadoTemporal;
            localStorage.setItem("usuarioData", JSON.stringify(userData));

            // Cambiar la imagen principal grande de la pantalla
            const imgPerfil = document.getElementById('profile-img');
            if (imgPerfil) {
                imgPerfil.src = `../img/${avatarSeleccionadoTemporal}`;
            }

            // Mostrar el texto verde
            document.getElementById('mensajeExitoFoto').style.display = 'block';

            // Cerrar la ventana tras 1.5 segundos
            setTimeout(() => {
                let modalElement = document.getElementById('modalEdicionFoto');
                let modalInstance = bootstrap.Modal.getInstance(modalElement);
                modalInstance.hide();
            }, 1500);

        } else {
            alert("Error: " + data.mensaje);
        }
    } catch (error) {
        alert("Error de conexión con el servidor.");
    }
}