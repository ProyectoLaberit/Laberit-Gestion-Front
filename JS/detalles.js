        const URL_BASE = "http://localhost:8080/api/estimaciones/proyecto/";

        window.onload = function() {
            if (!localStorage.getItem("sesionActiva")) {
                window.location.href = "login.html";
                return;
            }
            cargarGestionProyectos();
        };

        async function cargarGestionProyectos() {
            try {
                const id = localStorage.getItem("proyectoId");
                const respuesta = await fetch(`${URL_BASE}${id}`);
                const resultado = await respuesta.json();

                if (resultado.success) {
                    renderizarTabla(resultado.data, id);
                    document.getElementById('count-proyectos').innerText = resultado.data.length;
                }
            } catch (error) {
                console.error("Error al cargar la gestión:", error);
            }
        }

        function renderizarTabla(lista, id) {
            const body = document.getElementById('tabla-estimaciones-body');
            body.innerHTML = "";
            const id1 = id

            lista.forEach(item => {
                const tr = document.createElement('tr');
                // Mapeo directo de los campos de tu entidad Java
                tr.innerHTML = `
                    <td class="text-muted small">${item.id}</td>
                    <td>
                        <div class="fw-bold">${item.tarea}</div>
                        <div class="text-muted" style="font-size: 0.75rem;">Proyecto ID: ${item.idProyecto}</div>
                    </td>
                    <td>
                        <span class="tag-info">D: ${item.idDepartamento}</span>
                        <span class="tag-info">F: ${item.idFase}</span>
                    </td>
                    <td><span class="text-secondary">${item.tiempoMin}h</span></td>
                    <td><span class="fw-medium">${item.tiempoMax}h</span></td>
                    <td class="text-end">
                        <button onclick="irAModificar(${item.id})" class="btn btn-sm btn-outline-secondary me-1">Modificar</button>
                        <button onclick="irAEditar(${item.id})" class="btn btn-sm btn-dark">Editar</button>
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

        function editar(){
            window.location.href = "editarproyecto.html";
        }

        function cerrarSesion() {
            localStorage.removeItem("sesionActiva");
            window.location.href = "login.html";
        }