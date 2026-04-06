const URL_BASE = "http://localhost:8080/api";

async function realizarLogin() {
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
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('app-section').style.display = 'block';
            pintarProyectos(result.data);
        } else {
            document.getElementById('msg-login').innerText = result.mensaje;
        }
    } catch (error) {
        alert("Error de conexión con el servidor.");
    }
}

function pintarProyectos(proyectos) {
    const contenedor = document.getElementById('lista-proyectos');
    contenedor.innerHTML = "";

    proyectos.forEach(p => {
        const div = document.createElement('div');
        div.className = 'proyecto-card';
        div.onclick = () => buscarTareas(p.clockifyProyectoId);
        div.innerHTML = `<strong>${p.nombre}</strong><br><small>${p.descripcion}</small>`;
        contenedor.appendChild(div);
    });
}

async function buscarTareas(proyectoId) {
    const contenedorTareas = document.getElementById('lista-tareas');
    contenedorTareas.innerHTML = "<p>Buscando imputaciones...</p>";

    try {
        const response = await fetch(`${URL_BASE}/clockify/tareas/${proyectoId}`);
        const result = await response.json();

        if (result.success) {
            contenedorTareas.innerHTML = "";

            if (result.data.length === 0) {
                contenedorTareas.innerHTML = "<p>No hay tiempo registrado en este proyecto.</p>";
            } else {
                result.data.forEach(t => {
                    const div = document.createElement('div');
                    div.className = 'task-card';
                    div.innerHTML = `
                            <span class="tag-numero">${t.numero}</span> 
                            <span>${t.nombre}</span>
                            <div style="font-size: 0.8em; color: #777; margin-top:5px">Tiempo real: ${t.ptiempo}</div>
                        `;
                    contenedorTareas.appendChild(div);
                });
            }
        }
    } catch (error) {
        contenedorTareas.innerHTML = "<p style='color:red'>Error al recuperar imputaciones.</p>";
    }
}