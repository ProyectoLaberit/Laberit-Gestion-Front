        const URL_BASE = "http://localhost:8080/api";

        window.onload = function() {
            if (!localStorage.getItem("sesionActiva")) {
                window.location.href = "login.html";
                return;
            }
            cargarGestionProyectos();
        };

        async function cargarGestionProyectos() {
            try {
                const respuesta = await fetch(`${URL_BASE}/proyectos`);
                const resultado = await respuesta.json();

                if (resultado.success) {
                    renderizarTabla(resultado.data);
                    document.getElementById('count-proyectos').innerText = resultado.data.length;
                }
            } catch (error) {
                console.error("Error al cargar la gestión:", error);
            }
        }

        function renderizarTabla(proyectos) {
            const body = document.getElementById('tabla-proyectos-body');
            body.innerHTML = "";

            proyectos.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="fw-bold text-muted">${p.id || '—'}</td>
                    <td>${p.nombre}</td>
                    <td class="text-end">
                        <button onclick="irAModificar(${p.id})" class="btn btn-sm btn-outline-secondary me-2">Modificar </button>
                        <button onclick="irAEditar(${p.id})" class="btn btn-sm btn-dark">Editar </button>
                    </td>
                `;
                body.appendChild(tr);
            });
        }

        function irAModificar(id) {
            window.location.href = `editar_proyecto.html?id=${id}`;
        }

        function irAEditar(id) {
            // Según tu lógica previa, Editar y Modificar podrían ir a la misma vista
            window.location.href = `editar_proyecto.html?id=${id}`;
        }

        function cerrarSesion() {
            localStorage.removeItem("sesionActiva");
            window.location.href = "login.html"; [cite: 115]
        }