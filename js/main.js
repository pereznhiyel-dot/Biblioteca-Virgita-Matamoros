// Recursos que se muestran la primera vez o cuando aún no hay datos guardados.
const RECURSOS_INICIALES = [
    { id: 'lectura-quijote', tipo: 'lecturas', titulo: 'Don Quijote de la Mancha', categoria: 'Literatura', descripcion: 'Miguel de Cervantes', url: 'https://www.gutenberg.org/files/2000/2000-h/2000-h.htm', imagen: 'https://picsum.photos/300/400?random=101' },
    { id: 'lectura-panchita', tipo: 'lecturas', titulo: 'Cuentos de mi Tía Panchita', categoria: 'Nacional', descripcion: 'Carmen Lyra', url: 'https://www.imprentanacional.go.cr/editorialdigital/libros/literatura%20infantil/cuentos_de_mi_tia_panchita_edicion_mep.pdf', imagen: 'https://picsum.photos/300/400?random=102' },
    { id: 'lectura-seguridad', tipo: 'lecturas', titulo: 'Manual de Seguridad Industrial', categoria: 'Técnico', descripcion: 'CTP Guácimo', url: 'https://www.google.com', imagen: 'https://picsum.photos/300/400?random=103' },
    { id: 'video-tecnologia', tipo: 'videos', titulo: 'Ciclo de una flor', categoria: 'Ciencias Naturales', descripcion: 'Video demostrativo sobre el desarrollo de las plantas.', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', imagen: 'https://picsum.photos/640/360?random=211' },
    { id: 'video-lectura', tipo: 'videos', titulo: 'Animación y narrativa audiovisual', categoria: 'Audiovisual', descripcion: 'Video de muestra para observar animación y contar historias.', url: 'https://media.w3.org/2010/05/sintel/trailer.mp4', imagen: 'https://picsum.photos/640/360?random=212' },
    { id: 'juego-ajedrez', tipo: 'juegos', titulo: 'Ajedrez Online', categoria: 'Estrategia', descripcion: 'Desarrolla la lógica y la concentración.', url: 'https://lichess.org/embed', imagen: 'https://picsum.photos/300/200?random=201' },
    { id: 'juego-palabras', tipo: 'juegos', titulo: 'Desafío de Palabras', categoria: 'Trivia', descripcion: 'Trivia de ortografía y literatura general.', url: 'https://www.google.com', imagen: 'https://picsum.photos/300/200?random=202' }
];

// Claves locales y rutas de Realtime Database para cada tipo de información.
const CLAVE_RECURSOS = 'bibliotecaRecursos';
const CLAVE_RESENAS = 'bibliotecaResenas';
const CLAVE_SUGERENCIAS = 'bibliotecaSugerencias';
const CLAVE_CATEGORIAS = 'bibliotecaCategorias';
const COLECCIONES_FIREBASE = {
    [CLAVE_RECURSOS]: 'resources',
    [CLAVE_RESENAS]: 'reviews',
    [CLAVE_SUGERENCIAS]: 'suggestions',
    [CLAVE_CATEGORIAS]: 'categories'
};
// Recuerda los IDs remotos para poder detectar registros eliminados al sincronizar.
const IDS_FIREBASE = { resources: new Set(), reviews: new Set(), suggestions: new Set(), categories: new Set() };
let firebaseDisponible = false;
let sincronizandoFirebase = false;

// Configura formularios y eventos cuando el documento ya tiene sus elementos HTML.
document.addEventListener('DOMContentLoaded', () => {
    const formEstudiante = document.getElementById('formLoginEstudiante');
    if (formEstudiante) {
        formEstudiante.addEventListener('submit', (event) => {
            event.preventDefault();
            // En este prototipo, los datos de acceso se guardan localmente y se abre el panel.
            localStorage.setItem('nombreEstudiante', document.getElementById('nombreEstudiante').value.trim());
            localStorage.setItem('seccionEstudiante', document.getElementById('seccionEstudiante').value.trim());
            window.location.href = 'estudiante-dashboard.html';
        });
    }

    inicializarAccesoProfesor();

    const mensajeBienvenida = document.getElementById('mensajeBienvenida');
    if (mensajeBienvenida && document.getElementById('lista-lecturas')) {
        mensajeBienvenida.textContent = `Panel Docente · ${localStorage.getItem('nombreProfesor') || 'Biblioteca CTP'}`;
    } else if (mensajeBienvenida) {
        const nombre = localStorage.getItem('nombreEstudiante') || 'Estudiante';
        const seccion = localStorage.getItem('seccionEstudiante') || '';
        mensajeBienvenida.textContent = `¡Bienvenido/a, ${nombre}!${seccion ? ` (${seccion})` : ''}`;
    }

    // El panel docente solo es accesible mientras Firebase Authentication tenga una sesión activa.
    if (document.getElementById('lista-lecturas')) {
        const cliente = window.bibliotecaFirebase;
        if (!cliente) {
            actualizarEstadoFirebase('No se pudo iniciar Firebase Authentication. Vuelve a intentarlo.', 'error');
            window.location.replace('inicio-secion-profesores.html');
        } else {
            cliente.observarSesion((usuario) => {
                if (!usuario) {
                    localStorage.removeItem('nombreProfesor');
                    window.location.replace('inicio-secion-profesores.html');
                    return;
                }
                const nombre = usuario.displayName || usuario.email?.split('@')[0] || 'Profesor';
                localStorage.setItem('nombreProfesor', nombre);
                if (mensajeBienvenida) mensajeBienvenida.textContent = `Panel Docente · ${nombre}`;
            });
        }
    }

    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            // Limpia los datos de sesión guardados en este navegador antes de volver al inicio.
            ['nombreEstudiante', 'seccionEstudiante', 'nombreProfesor'].forEach((clave) => localStorage.removeItem(clave));
            try {
                if (window.bibliotecaFirebase) await window.bibliotecaFirebase.cerrarSesion();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('No se pudo cerrar la sesión de Firebase.', error);
                window.alert('No se pudo cerrar la sesión. Revisa tu conexión e inténtalo de nuevo.');
            }
        });
    }

    inicializarGestionRecursos();
});

function inicializarAccesoProfesor() {
    const formularioInicio = document.getElementById('formInicioSesionProfesor');
    if (!formularioInicio) return;

    const limpiarMensajes = (ids) => ids.forEach((id) => {
        document.getElementById(id).textContent = '';
    });
    const cliente = window.bibliotecaFirebase;

    formularioInicio.addEventListener('submit', async (event) => {
        event.preventDefault();
        limpiarMensajes([
            'errorUsuarioInicioSesionProfesor',
            'errorPasswordInicioSesionProfesor',
            'mensajeInicioSesionProfesor'
        ]);
        if (!formularioInicio.reportValidity()) return;

        const correo = document.getElementById('correoInicioSesionProfesor').value.trim();
        const password = document.getElementById('passwordInicioSesionProfesor').value;
        const mensajeUsuario = document.getElementById('errorUsuarioInicioSesionProfesor');
        const mensajePassword = document.getElementById('errorPasswordInicioSesionProfesor');
        const mensajeGeneral = document.getElementById('mensajeInicioSesionProfesor');
        if (!cliente) {
            mensajeGeneral.textContent = 'No se pudo conectar con Firebase. Inténtalo de nuevo más tarde.';
            return;
        }

        const botonEnviar = document.getElementById('enviarInicioSesionProfesor');
        botonEnviar.disabled = true;
        try {
            const usuario = await cliente.iniciarSesionProfesor(correo, password);
            localStorage.setItem('nombreProfesor', usuario.displayName || usuario.email?.split('@')[0] || 'Profesor');
            window.location.href = 'profesor-dashboard.html';
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                mensajeUsuario.textContent = 'El usuario no existe.';
            } else if (error.code === 'auth/wrong-password') {
                mensajePassword.textContent = 'Contraseña incorrecta.';
            } else if (error.code === 'auth/invalid-email') {
                mensajeUsuario.textContent = 'Escribe un correo electrónico válido.';
            } else if (error.code === 'auth/invalid-credential') {
                mensajePassword.textContent = 'El correo o la contraseña son incorrectos.';
            } else {
                console.error('No se pudo iniciar sesión como profesor.', error);
                mensajeGeneral.textContent = 'No se pudo iniciar sesión. Comprueba tu conexión e inténtalo de nuevo.';
            }
        } finally {
            botonEnviar.disabled = false;
        }
    });
}

// Recupera el catálogo local, migra algunos datos de muestra antiguos o crea los iniciales.
function obtenerRecursos() {
    const guardados = localStorage.getItem(CLAVE_RECURSOS);
    if (guardados) {
        try {
            const recursos = JSON.parse(guardados);
            if (Array.isArray(recursos)) {
                const videosDeMuestra = {
                    'video-tecnologia': {
                        url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
                        tituloAnterior: 'Introducción a la Tecnología del CTP Guácimo',
                        titulo: 'Ciclo de una flor',
                        categoriaAnterior: 'Biblioteca CTP',
                        categoria: 'Ciencias Naturales',
                        descripcionAnterior: 'Material audiovisual educativo.',
                        descripcion: 'Video demostrativo sobre el desarrollo de las plantas.'
                    },
                    'video-lectura': {
                        url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
                        tituloAnterior: 'Cómo aprovechar la lectura digital',
                        titulo: 'Animación y narrativa audiovisual',
                        categoriaAnterior: 'Orientación Educativa',
                        categoria: 'Audiovisual',
                        descripcionAnterior: 'Consejos para estudiar con recursos digitales.',
                        descripcion: 'Video de muestra para observar animación y contar historias.'
                    }
                };
                let migrado = false;
                // Actualiza únicamente las entradas de ejemplo antiguas, sin sobrescribir ediciones.
                recursos.forEach((recurso) => {
                    const muestra = videosDeMuestra[recurso.id];
                    if (!muestra || (!recurso.url.includes('dQw4w9WgXcQ') && !recurso.url.includes('BigBuckBunny.mp4'))) return;
                    recurso.url = muestra.url;
                    if (recurso.titulo === muestra.tituloAnterior) recurso.titulo = muestra.titulo;
                    if (recurso.categoria === muestra.categoriaAnterior) recurso.categoria = muestra.categoria;
                    if (recurso.descripcion === muestra.descripcionAnterior) recurso.descripcion = muestra.descripcion;
                    migrado = true;
                });
                if (migrado) guardarRecursos(recursos);
                return recursos;
            }
        } catch (error) {
            localStorage.removeItem(CLAVE_RECURSOS);
        }
    }

    const iniciales = RECURSOS_INICIALES.map((recurso) => ({ ...recurso }));
    guardarRecursos(iniciales);
    return iniciales;
}

// Persiste el catálogo en el navegador y solicita sincronizarlo con Firebase.
function guardarRecursos(recursos) {
    localStorage.setItem(CLAVE_RECURSOS, JSON.stringify(recursos));
    void sincronizarColeccionFirebase(CLAVE_RECURSOS, recursos);
}

function obtenerCategorias() {
    const guardadas = localStorage.getItem(CLAVE_CATEGORIAS);
    if (!guardadas) return [];
    try {
        const categorias = JSON.parse(guardadas);
        return Array.isArray(categorias) ? categorias : [];
    } catch (error) {
        console.error('No se pudieron leer las categorías guardadas en este navegador.', error);
        localStorage.removeItem(CLAVE_CATEGORIAS);
        return [];
    }
}

function guardarCategorias(categorias) {
    localStorage.setItem(CLAVE_CATEGORIAS, JSON.stringify(categorias));
    void sincronizarColeccionFirebase(CLAVE_CATEGORIAS, categorias);
}

function obtenerCategoriaRecurso(recurso) {
    const categoria = obtenerCategorias().find((item) => item.id === recurso.categoriaId);
    return categoria
        ? { nombre: categoria.nombre, icono: categoria.icono || '' }
        : { nombre: recurso.categoria || '', icono: '' };
}

function renderizarEtiquetaCategoria(recurso, clase = '') {
    const categoria = obtenerCategoriaRecurso(recurso);
    const texto = escaparHTML(categoria.nombre || 'Sin categoría');
    const icono = /^[a-z0-9-]+$/i.test(categoria.icono)
        ? `<re-icon icon="${escaparHTML(categoria.icono)}" size="15" aria-hidden="true"></re-icon>`
        : '';
    return `<span class="categoria-tag${clase ? ` ${clase}` : ''}">${icono}${texto}</span>`;
}

function valorCategoriaRecurso(recurso) {
    if (recurso.categoriaId && obtenerCategorias().some((item) => item.id === recurso.categoriaId)) {
        return recurso.categoriaId;
    }
    return recurso.categoria ? `legacy:${recurso.categoria}` : '__sin_categoria__';
}

function recursosCoincidenConFiltro(recursos, tipo) {
    const filtro = document.querySelector(`[data-filtro-categoria="${tipo}"]`)?.value || '';
    if (!filtro) return recursos;
    return recursos.filter((recurso) => valorCategoriaRecurso(recurso) === filtro);
}

function actualizarSelectoresCategorias() {
    const categorias = obtenerCategorias().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const recursos = obtenerRecursos();
    document.querySelectorAll('[data-filtro-categoria]').forEach((select) => {
        const seleccion = select.value;
        const tipo = select.dataset.filtroCategoria;
        const valores = new Map();
        const categoriasUsadas = new Set(
            recursos.filter((recurso) => recurso.tipo === tipo).map((recurso) => recurso.categoriaId)
        );
        categorias.filter((categoria) => categoriasUsadas.has(categoria.id))
            .forEach((categoria) => valores.set(categoria.id, categoria.nombre));
        recursos.filter((recurso) => recurso.tipo === tipo && recurso.categoria && !recurso.categoriaId)
            .forEach((recurso) => valores.set(`legacy:${recurso.categoria}`, recurso.categoria));
        const categoriasSinAsignar = recursos.some((recurso) =>
            recurso.tipo === tipo && !recurso.categoria && !recurso.categoriaId
        );
        select.innerHTML = '<option value="">Todas las categorías</option>'
            + [...valores].map(([id, nombre]) =>
                `<option value="${escaparHTML(id)}">${escaparHTML(nombre)}</option>`
            ).join('')
            + (categoriasSinAsignar ? '<option value="__sin_categoria__">Sin categoría</option>' : '');
        if ([...select.options].some((option) => option.value === seleccion)) select.value = seleccion;
    });

    const selectorRecurso = document.getElementById('recursoCategoria');
    if (selectorRecurso) {
        const seleccionado = selectorRecurso.value;
        selectorRecurso.innerHTML = '<option value="">Sin categoría</option>'
            + categorias.map((categoria) =>
                `<option value="${escaparHTML(categoria.id)}">${escaparHTML(categoria.nombre)}</option>`
            ).join('');
        if ([...selectorRecurso.options].some((option) => option.value === seleccionado)) {
            selectorRecurso.value = seleccionado;
        }
    }
}

function crearIdCategoria(nombre) {
    const slug = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'categoria';
    return `cat-${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// Codifica caracteres especiales para insertar texto de usuario de forma segura en HTML.
function escaparHTML(valor = '') {
    return String(valor).replace(/[&<>"']/g, (caracter) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caracter]);
}

// Acepta únicamente direcciones HTTP o HTTPS y devuelve la URL normalizada.
function urlSegura(valor) {
    try {
        const url = new URL(valor);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) {
        return '';
    }
}

// Reconoce enlaces compartidos de Google Drive y Google Docs.
function esEnlaceDrive(valor) {
    try {
        const host = new URL(valor).hostname.toLowerCase();
        return host === 'drive.google.com' || host === 'docs.google.com';
    } catch (error) {
        return false;
    }
}

function obtenerIdArchivoDrive(valor) {
    if (!esEnlaceDrive(valor)) return '';
    try {
        const url = new URL(valor);
        return url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1]
            || url.searchParams.get('id')?.match(/^[A-Za-z0-9_-]+$/)?.[0]
            || '';
    } catch (error) {
        return '';
    }
}

// Lee una lista del almacenamiento local; si el JSON está dañado, elimina ese valor inválido.
function obtenerListaLocal(clave) {
    try {
        const guardados = JSON.parse(localStorage.getItem(clave) || '[]');
        return Array.isArray(guardados) ? guardados : [];
    } catch (error) {
        localStorage.removeItem(clave);
        return [];
    }
}

// Guarda una lista local y propaga el cambio a Firebase cuando está disponible.
function guardarListaLocal(clave, elementos) {
    localStorage.setItem(clave, JSON.stringify(elementos));
    void sincronizarColeccionFirebase(clave, elementos);
}

// Actualiza el mensaje visible que indica el estado de la conexión con Firebase.
function actualizarEstadoFirebase(mensaje, estado) {
    const indicador = document.getElementById('estadoConexionFirebase');
    if (!indicador) return;
    indicador.textContent = mensaje;
    indicador.dataset.estado = estado;
}

// Genera un ID determinista para que cada estudiante tenga una reseña por recurso.
function crearIdResena(resena) {
    const identidad = `${resena.recursoId}-${resena.nombre.trim().toLocaleLowerCase()}`;
    let hash = 2166136261;
    for (let indice = 0; indice < identidad.length; indice += 1) {
        hash ^= identidad.charCodeAt(indice);
        hash = Math.imul(hash, 16777619);
    }
    return `review-${(hash >>> 0).toString(36)}`;
}

// Asegura que el registro enviado a Firebase tenga un identificador válido.
function prepararRegistroFirebase(coleccion, registro) {
    return {
        ...registro,
        id: registro.id || (coleccion === 'reviews' ? crearIdResena(registro) : '')
    };
}

// Escribe los registros actuales y elimina de Firebase los que ya no están en la lista local.
async function sincronizarColeccionFirebase(clave, elementos) {
    const cliente = window.bibliotecaFirebase;
    const nombreColeccion = COLECCIONES_FIREBASE[clave];
    if (!firebaseDisponible || !cliente || !nombreColeccion) return;

    const registros = elementos.map((elemento) => prepararRegistroFirebase(nombreColeccion, elemento));
    const nuevosIds = new Set(registros.map((registro) => registro.id).filter(Boolean));
    try {
        await Promise.all(registros.map((registro) => cliente.guardarRegistro(nombreColeccion, registro.id, registro)));
        const eliminaciones = [...IDS_FIREBASE[nombreColeccion]]
            .filter((id) => !nuevosIds.has(id))
            .map((id) => cliente.eliminarRegistro(nombreColeccion, id));
        await Promise.all(eliminaciones);
        IDS_FIREBASE[nombreColeccion] = nuevosIds;
        actualizarEstadoFirebase('Conectado a Firebase · cambios sincronizados', 'conectado');
    } catch (error) {
        console.error(`No se pudo sincronizar ${nombreColeccion} con Firebase.`, error);
        actualizarEstadoFirebase('Firebase rechazó la escritura; los cambios quedaron solo en este navegador. Revisa las reglas de Realtime Database.', 'error');
    }
}

// Descarga una colección remota; si está vacía, inicializa Firebase con los datos locales.
async function cargarColeccionFirebase(clave) {
    const cliente = window.bibliotecaFirebase;
    const nombreColeccion = COLECCIONES_FIREBASE[clave];
    const remotos = await cliente.leerColeccion(nombreColeccion);
    const locales = clave === CLAVE_RECURSOS ? obtenerRecursos() : obtenerListaLocal(clave);
    const registros = remotos.length ? remotos : locales.map((registro) => prepararRegistroFirebase(nombreColeccion, registro));
    IDS_FIREBASE[nombreColeccion] = new Set(registros.map((registro) => registro.id).filter(Boolean));
    localStorage.setItem(clave, JSON.stringify(registros));

    if (!remotos.length && registros.length) {
        await Promise.all(registros.map((registro) => cliente.guardarRegistro(nombreColeccion, registro.id, registro)));
    }
    return registros;
}

// Carga las colecciones principales y actualiza las vistas cuando termina la sincronización.
async function sincronizarDatosFirebase() {
    const cliente = window.bibliotecaFirebase;
    if (!cliente) {
        actualizarEstadoFirebase('Firebase no cargó; se usa el almacenamiento local de este navegador.', 'error');
        return;
    }
    if (sincronizandoFirebase) return;
    sincronizandoFirebase = true;
    actualizarEstadoFirebase('Conectando con Firebase...', 'conectando');
    try {
        // Espera a que Firebase restaure la sesión para que las reglas reciban el UID docente.
        if (document.getElementById('lista-lecturas')) {
            const usuario = await cliente.esperarSesion();
            if (!usuario) {
                window.location.replace('inicio-secion-profesores.html');
                return;
            }
        }
        const cargas = [
            cargarColeccionFirebase(CLAVE_RECURSOS),
            cargarColeccionFirebase(CLAVE_RESENAS),
            cargarColeccionFirebase(CLAVE_CATEGORIAS)
        ];
        // Las propuestas incluyen datos de estudiantes y solo se necesitan en el panel docente.
        if (document.getElementById('lista-sugerencias')) {
            cargas.push(cargarColeccionFirebase(CLAVE_SUGERENCIAS));
        }
        await Promise.all(cargas);
        firebaseDisponible = true;
        if (document.getElementById('lista-sugerencias')) migrarCategoriasLegadas();
        actualizarEstadoFirebase('Conectado a Firebase · catálogo sincronizado', 'conectado');
        renderizarCatalogoDocente();
        renderizarCatalogoEstudiante();
        renderizarSugerenciasDocente();
    } catch (error) {
        console.error('No se pudo sincronizar con Realtime Database.', error);
        firebaseDisponible = false;
        const detalle = `${error?.code || ''} ${error?.message || ''}`;
        if (/PERMISSION_DENIED|permission-denied/i.test(detalle)) {
            actualizarEstadoFirebase('Firebase denegó el acceso. Publica las reglas actualizadas de resources, reviews, suggestions y categories, y verifica la autorización del UID docente.', 'error');
        } else {
            actualizarEstadoFirebase(`No se pudo sincronizar con Firebase${error?.code ? ` (${error.code})` : ''}; este panel usa el almacenamiento local. Revisa la conexión y las reglas de Realtime Database.`, 'error');
        }
    } finally {
        sincronizandoFirebase = false;
    }
}

function migrarCategoriasLegadas() {
    const categorias = obtenerCategorias();
    const recursos = obtenerRecursos();
    const nombres = new Map(categorias.map((categoria) => [categoria.nombre.toLocaleLowerCase(), categoria]));
    let categoriasActualizadas = false;
    let recursosActualizados = false;

    recursos.filter((recurso) =>
        ['lecturas', 'videos'].includes(recurso.tipo) && recurso.categoria && !recurso.categoriaId
    ).forEach((recurso) => {
        const clave = recurso.categoria.trim().toLocaleLowerCase();
        let categoria = nombres.get(clave);
        if (!categoria) {
            categoria = {
                id: crearIdCategoria(recurso.categoria.trim()),
                nombre: recurso.categoria.trim(),
                icono: ''
            };
            categorias.push(categoria);
            nombres.set(clave, categoria);
            categoriasActualizadas = true;
        }
        recurso.categoriaId = categoria.id;
        recurso.categoria = categoria.nombre;
        recursosActualizados = true;
    });

    if (categoriasActualizadas) guardarCategorias(categorias);
    if (recursosActualizados) guardarRecursos(recursos);
}

// Crea el reproductor apropiado para videos directos o enlaces de YouTube y Vimeo.
function crearReproductorVideo(urlOriginal, titulo) {
    const urlSeguraVideo = urlSegura(urlOriginal);
    if (!urlSeguraVideo) return '<p class="video-error">El enlace de este video no es válido.</p>';

    const url = new URL(urlSeguraVideo);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    let urlIncrustada = '';

    const idArchivoDrive = obtenerIdArchivoDrive(url.href);
    if (idArchivoDrive) {
        urlIncrustada = `https://drive.google.com/file/d/${encodeURIComponent(idArchivoDrive)}/preview`;
    }

    // Convierte los enlaces habituales de YouTube y Vimeo a sus direcciones de inserción.
    if (!urlIncrustada && host === 'youtu.be') {
        urlIncrustada = `https://www.youtube-nocookie.com/embed/${url.pathname.split('/').filter(Boolean)[0] || ''}`;
    } else if (!urlIncrustada && (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com')) {
        const videoId = url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
        if (videoId) urlIncrustada = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
    } else if (!urlIncrustada && (host === 'vimeo.com' || host === 'player.vimeo.com')) {
        const videoId = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
        if (videoId) urlIncrustada = `https://player.vimeo.com/video/${videoId}`;
    }

    const tituloSeguro = escaparHTML(titulo);
    const ruta = url.pathname.toLowerCase();
    // Los archivos de video se reproducen con el elemento nativo; los demás se muestran en un iframe.
    if (!idArchivoDrive && /\.(mp4|webm|ogg)$/.test(ruta)) {
        return `<video controls preload="metadata" playsinline aria-label="${tituloSeguro}"><source src="${escaparHTML(url.href)}">Tu navegador no puede reproducir este video.</video>`;
    }

    if (urlIncrustada && !idArchivoDrive && ['http:', 'https:'].includes(window.location.protocol)) {
        const embed = new URL(urlIncrustada);
        embed.searchParams.set('origin', window.location.origin);
        urlIncrustada = embed.href;
    }

    const fuente = urlIncrustada || url.href;
    return `<iframe src="${escaparHTML(fuente)}" title="${tituloSeguro}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}

// Genera cinco iconos de estrella y marca como llenos los que corresponden a la calificación.
function estrellasHTML(calificacion, tamano = 16) {
    const llenas = Math.round(Number(calificacion) || 0);
    return Array.from({ length: 5 }, (_, indice) => `<re-icon icon="star" size="${tamano}"${indice < llenas ? ' weight="filled"' : ''} aria-hidden="true"></re-icon>`).join('');
}

// Calcula el promedio y prepara el resumen y las dos reseñas más recientes de un recurso.
function crearOpinionesHTML(recursoId, permitirOpinar = false) {
    const resenas = obtenerListaLocal(CLAVE_RESENAS)
        .filter((resena) => resena.recursoId === recursoId)
        .filter((resena) => !pareceContenidoAdulto(`${resena.nombre} ${resena.comentario}`))
        .sort((primera, segunda) => segunda.fecha - primera.fecha);
    const promedio = resenas.length
        ? resenas.reduce((total, resena) => total + Number(resena.calificacion), 0) / resenas.length
        : 0;
    const boton = permitirOpinar
        ? `<button class="review-trigger" type="button" data-calificar-id="${escaparHTML(recursoId)}"><re-icon icon="message-square" size="17" aria-hidden="true"></re-icon>Opinar</button>`
        : '';
    const resumen = promedio
        ? `<span class="rating-number">${promedio.toFixed(1)}</span><span class="rating-count">${resenas.length} ${resenas.length === 1 ? 'opinión' : 'opiniones'}</span>`
        : '<span class="rating-count">Sin opiniones</span>';
    const comentarios = resenas.slice(0, 2).map((resena) => (
        `<blockquote class="review-preview"><div>${estrellasHTML(resena.calificacion, 14)}<strong>${escaparHTML(resena.nombre)}</strong></div><p>${escaparHTML(resena.comentario)}</p></blockquote>`
    )).join('');

    return `<section class="resource-reviews"><div class="review-summary"><span class="rating-stars">${estrellasHTML(promedio)}</span>${resumen}${boton}</div>${comentarios}</section>`;
}

// Prepara el catálogo y conecta los botones, formularios, modales y eventos de la página actual.
function inicializarGestionRecursos() {
    const tipos = ['lecturas', 'videos', 'juegos'];
    if (!tipos.some((tipo) => document.getElementById(`lista-${tipo}`) || document.getElementById(`lista-estudiante-${tipo}`))) return;

    obtenerRecursos();
    obtenerCategorias();
    actualizarSelectoresCategorias();
    renderizarCatalogoDocente();
    renderizarCatalogoEstudiante();

    document.querySelectorAll('.management-list').forEach((lista) => {
        lista.addEventListener('click', (event) => {
            const boton = event.target.closest('[data-accion-recurso]');
            if (!boton) return;
            event.preventDefault();
            event.stopPropagation();
            const accion = boton.dataset.accionRecurso;
            const { id } = boton.dataset;
            if (accion === 'editar') abrirFormularioRecurso(boton.dataset.tipo, id);
            if (accion === 'eliminar') eliminarRecurso(id);
        });
    });

    const formulario = document.getElementById('formularioRecurso');
    if (formulario) {
        formulario.addEventListener('submit', guardarRecursoDesdeFormulario);
        document.getElementById('origenLectura').addEventListener('change', actualizarAyudaOrigenLectura);
    }

    document.querySelectorAll('[data-filtro-categoria]').forEach((selector) => {
        selector.addEventListener('change', () => {
            renderizarCatalogoDocente();
            renderizarCatalogoEstudiante();
        });
    });

    const formularioCategoria = document.getElementById('formularioCategoria');
    if (formularioCategoria) {
        formularioCategoria.addEventListener('submit', guardarCategoriaDesdeFormulario);
        const listaCategorias = document.getElementById('listaCategorias');
        listaCategorias.addEventListener('click', (event) => {
            const boton = event.target.closest('[data-accion-categoria]');
            if (!boton) return;
            if (boton.dataset.accionCategoria === 'editar') editarCategoria(boton.dataset.id);
            if (boton.dataset.accionCategoria === 'eliminar') eliminarCategoria(boton.dataset.id);
        });
    }

    const formularioSugerencia = document.getElementById('formularioSugerencia');
    if (formularioSugerencia) {
        const campoNombre = document.getElementById('nombreSugerencia');
        campoNombre.value = localStorage.getItem('nombreEstudiante') || '';
        formularioSugerencia.addEventListener('submit', guardarSugerencia);
    }

    const formularioResena = document.getElementById('formularioResena');
    if (formularioResena) formularioResena.addEventListener('submit', guardarResena);

    document.querySelectorAll('[id^="lista-estudiante-"]').forEach((lista) => {
        lista.addEventListener('click', (event) => {
            const boton = event.target.closest('[data-calificar-id]');
            if (!boton) return;
            event.preventDefault();
            abrirModalResena(boton.dataset.calificarId);
        });
    });

    const listaSugerencias = document.getElementById('lista-sugerencias');
    if (listaSugerencias) {
        listaSugerencias.addEventListener('click', (event) => {
            const boton = event.target.closest('[data-accion-sugerencia]');
            if (!boton) return;
            if (boton.dataset.accionSugerencia === 'revisar') marcarSugerenciaRevisada(boton.dataset.id);
            if (boton.dataset.accionSugerencia === 'publicar') publicarSugerencia(boton.dataset.id);
            if (boton.dataset.accionSugerencia === 'eliminar') eliminarSugerencia(boton.dataset.id);
        });
        renderizarSugerenciasDocente();
    }

    const modal = document.getElementById('modalRecurso');
    if (modal && document.getElementById('formularioRecurso')) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) cerrarFormularioRecurso();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') cerrarFormularioRecurso();
        });
    }

    const modalCategorias = document.getElementById('modalCategorias');
    if (modalCategorias) {
        modalCategorias.addEventListener('click', (event) => {
            if (event.target === modalCategorias) cerrarGestionCategorias();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') cerrarGestionCategorias();
        });
    }

    if (modal && document.getElementById('modalTitulo')) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) cerrarModal();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') cerrarModal();
        });
    }

    const modalResena = document.getElementById('modalResena');
    if (modalResena) {
        modalResena.addEventListener('click', (event) => {
            if (event.target === modalResena) cerrarModalResena();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') cerrarModalResena();
        });
    }

    void sincronizarDatosFirebase();
}

// Dibuja en el panel docente las tarjetas de recursos con sus controles de edición y eliminación.
function renderizarCatalogoDocente() {
    const recursos = obtenerRecursos();
    const etiquetas = { lecturas: 'Lectura', videos: 'Video', juegos: 'Juego' };
    actualizarSelectoresCategorias();

    ['lecturas', 'videos', 'juegos'].forEach((tipo) => {
        const lista = document.getElementById(`lista-${tipo}`);
        if (!lista) return;
        const delTipo = recursosCoincidenConFiltro(recursos.filter((recurso) => recurso.tipo === tipo), tipo);
        lista.innerHTML = delTipo.length ? delTipo.map((recurso) => {
            const id = escaparHTML(recurso.id);
            const titulo = escaparHTML(recurso.titulo);
            const etiqueta = renderizarEtiquetaCategoria(recurso, tipo === 'juegos' ? 'juego' : '');
            const descripcion = escaparHTML(recurso.descripcion);
            const imagen = urlSegura(recurso.imagen) || 'https://picsum.photos/640/420?grayscale';
            const controles = `<div class="resource-actions"><button class="secondary-button" type="button" data-accion-recurso="editar" data-tipo="${tipo}" data-id="${id}">Editar</button><button class="delete-button" type="button" data-accion-recurso="eliminar" data-id="${id}">Eliminar</button></div>`;
            const opiniones = crearOpinionesHTML(recurso.id);

            if (tipo === 'videos') {
                return `<article class="yt-card management-card"><div class="video-player">${crearReproductorVideo(recurso.url, recurso.titulo)}</div><div class="yt-details">${etiqueta}<h3>${titulo}</h3><p class="yt-canal">${descripcion || escaparHTML(etiquetas[tipo])}</p>${opiniones}${controles}</div></article>`;
            }

            return `<article class="card-libro management-card"><img src="${escaparHTML(imagen)}" alt="Imagen de ${titulo}"><div class="card-libro-info">${etiqueta}<h3>${titulo}</h3><p>${descripcion}</p>${opiniones}${controles}</div></article>`;
        }).join('') : '<p class="empty-state">Todavía no hay recursos en esta sección.</p>';
    });

    const conteos = {
        lecturas: recursos.filter((recurso) => recurso.tipo === 'lecturas').length,
        videos: recursos.filter((recurso) => recurso.tipo === 'videos').length,
        juegos: recursos.filter((recurso) => recurso.tipo === 'juegos').length
    };
    [['totalLecturas', conteos.lecturas], ['totalVideos', conteos.videos], ['totalJuegos', conteos.juegos]].forEach(([id, total]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = total;
    });
}

// Dibuja para estudiantes los recursos publicados, con sus enlaces y reseñas.
function renderizarCatalogoEstudiante() {
    const recursos = obtenerRecursos();
    actualizarSelectoresCategorias();
    ['lecturas', 'videos', 'juegos'].forEach((tipo) => {
        const lista = document.getElementById(`lista-estudiante-${tipo}`);
        if (!lista) return;
        const delTipo = recursosCoincidenConFiltro(recursos.filter((recurso) => recurso.tipo === tipo), tipo);
        lista.innerHTML = delTipo.length ? delTipo.map((recurso) => {
            const titulo = escaparHTML(recurso.titulo);
            const etiqueta = renderizarEtiquetaCategoria(recurso, tipo === 'juegos' ? 'juego' : '');
            const categoria = escaparHTML(obtenerCategoriaRecurso(recurso).nombre || 'Recurso educativo');
            const descripcion = escaparHTML(recurso.descripcion);
            const imagen = urlSegura(recurso.imagen) || 'https://picsum.photos/640/420?grayscale';
            const url = escaparHTML(urlSegura(recurso.url));
            const opiniones = crearOpinionesHTML(recurso.id, true);

            if (tipo === 'videos') {
                return `<article class="yt-card"><div class="video-player">${crearReproductorVideo(recurso.url, recurso.titulo)}</div><div class="yt-details">${etiqueta}<h3>${titulo}</h3><p class="yt-canal">${descripcion}</p>${opiniones}</div></article>`;
            }

            const esJuego = tipo === 'juegos';
            const icono = esJuego ? 'gamepad' : 'book-open';
            const textoAccion = esJuego ? 'Jugar ahora' : esEnlaceDrive(recurso.url) ? 'Abrir en Drive' : 'Abrir lectura';
            return `<article class="card-libro"><img src="${imagen}" alt="Imagen de ${titulo}"><div class="card-libro-info">${etiqueta}<h3>${titulo}</h3><p>${descripcion || categoria}</p>${opiniones}<a class="btn-leer" href="${url}" target="_blank" rel="noopener noreferrer"><re-icon icon="${icono}" size="18" aria-hidden="true"></re-icon>${textoAccion}</a></div></article>`;
        }).join('') : '<p class="empty-state">No hay recursos publicados en esta sección todavía.</p>';
    });
}

function abrirGestionCategorias() {
    const modal = document.getElementById('modalCategorias');
    if (!modal) return;
    cancelarEdicionCategoria();
    renderizarListaCategorias();
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('categoriaNombre').focus();
}

function cerrarGestionCategorias() {
    const modal = document.getElementById('modalCategorias');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function renderizarListaCategorias() {
    const lista = document.getElementById('listaCategorias');
    if (!lista) return;
    const categorias = obtenerCategorias().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    lista.innerHTML = categorias.length ? categorias.map((categoria) => {
        const iconoValido = /^[a-z0-9-]+$/i.test(categoria.icono || '');
        const icono = iconoValido
            ? `<re-icon icon="${escaparHTML(categoria.icono)}" size="18" aria-hidden="true"></re-icon>`
            : '<re-icon icon="folder" size="18" aria-hidden="true"></re-icon>';
        return `<article class="category-manager-item"><span class="category-manager-name">${icono}${escaparHTML(categoria.nombre)}</span><div class="resource-actions"><button class="secondary-button" type="button" data-accion-categoria="editar" data-id="${escaparHTML(categoria.id)}">Editar</button><button class="delete-button" type="button" data-accion-categoria="eliminar" data-id="${escaparHTML(categoria.id)}">Eliminar</button></div></article>`;
    }).join('') : '<p class="empty-state">Todavía no hay categorías. Crea la primera con el formulario.</p>';
}

function cancelarEdicionCategoria() {
    const formulario = document.getElementById('formularioCategoria');
    if (!formulario) return;
    formulario.reset();
    document.getElementById('categoriaId').value = '';
    document.getElementById('mensajeCategoria').textContent = '';
    document.getElementById('cancelarEdicionCategoria').hidden = true;
}

function editarCategoria(id) {
    const categoria = obtenerCategorias().find((item) => item.id === id);
    if (!categoria) return;
    document.getElementById('categoriaId').value = categoria.id;
    document.getElementById('categoriaNombre').value = categoria.nombre;
    document.getElementById('categoriaIcono').value = categoria.icono || '';
    document.getElementById('mensajeCategoria').textContent = '';
    document.getElementById('cancelarEdicionCategoria').hidden = false;
    document.getElementById('categoriaNombre').focus();
}

function guardarCategoriaDesdeFormulario(event) {
    event.preventDefault();
    const id = document.getElementById('categoriaId').value;
    const nombre = document.getElementById('categoriaNombre').value.trim();
    const iconoIngresado = document.getElementById('categoriaIcono').value.trim();
    const mensaje = document.getElementById('mensajeCategoria');
    const categorias = obtenerCategorias();
    const existente = categorias.find((categoria) => categoria.id === id);

    if (!nombre) {
        mensaje.textContent = 'Escribe el nombre de la categoría.';
        return;
    }
    if (iconoIngresado && !/^[a-z0-9-]+$/i.test(iconoIngresado)) {
        mensaje.textContent = 'El icono solo puede contener letras, números y guiones.';
        return;
    }
    if (categorias.some((categoria) =>
        categoria.id !== id && categoria.nombre.trim().toLocaleLowerCase() === nombre.toLocaleLowerCase()
    )) {
        mensaje.textContent = 'Ya existe una categoría con ese nombre.';
        return;
    }

    const categoria = {
        id: existente?.id || crearIdCategoria(nombre),
        nombre,
        icono: iconoIngresado || existente?.icono || ''
    };
    if (existente) {
        const recursos = obtenerRecursos();
        recursos.forEach((recurso) => {
            if (recurso.categoriaId === existente.id) recurso.categoria = nombre;
        });
        guardarRecursos(recursos);
        categorias[categorias.indexOf(existente)] = categoria;
    } else {
        categorias.push(categoria);
    }
    guardarCategorias(categorias);
    actualizarSelectoresCategorias();
    renderizarListaCategorias();
    renderizarCatalogoDocente();
    renderizarCatalogoEstudiante();
    cancelarEdicionCategoria();
}

function eliminarCategoria(id) {
    const categoria = obtenerCategorias().find((item) => item.id === id);
    if (!categoria || !window.confirm(`¿Eliminar la categoría "${categoria.nombre}"? Los recursos quedarán sin categoría.`)) return;
    const recursos = obtenerRecursos();
    recursos.forEach((recurso) => {
        if (recurso.categoriaId === id) {
            recurso.categoriaId = '';
            recurso.categoria = '';
        }
    });
    guardarRecursos(recursos);
    guardarCategorias(obtenerCategorias().filter((item) => item.id !== id));
    cancelarEdicionCategoria();
    actualizarSelectoresCategorias();
    renderizarListaCategorias();
    renderizarCatalogoDocente();
    renderizarCatalogoEstudiante();
}

// Rellena el formulario para crear o editar un recurso y muestra su ventana modal.
function abrirFormularioRecurso(tipo, id = '') {
    const formulario = document.getElementById('formularioRecurso');
    const modal = document.getElementById('modalRecurso');
    if (!formulario || !modal) return;

    const recurso = obtenerRecursos().find((item) => item.id === id);
    formulario.reset();
    document.getElementById('recursoTipo').value = tipo;
    document.getElementById('recursoId').value = recurso ? recurso.id : '';
    document.getElementById('recursoTitulo').value = recurso?.titulo || '';
    document.getElementById('recursoDescripcion').value = recurso?.descripcion || '';
    document.getElementById('recursoUrl').value = recurso?.url || '';
    document.getElementById('recursoImagen').value = recurso?.imagen || '';
    const grupoOrigen = document.getElementById('origenLecturaGroup');
    const origenLectura = document.getElementById('origenLectura');
    const usaDrive = tipo === 'lecturas' || tipo === 'videos';
    grupoOrigen.hidden = !usaDrive;
    origenLectura.value = recurso?.[tipo === 'videos' ? 'origenVideo' : 'origenLectura']
        || (recurso && esEnlaceDrive(recurso.url) ? 'drive' : 'web');
    document.getElementById('etiquetaOrigenRecurso').textContent = tipo === 'videos'
        ? 'Añadir video desde'
        : 'Añadir lectura desde';
    actualizarAyudaOrigenLectura();
    document.getElementById('tituloModalRecurso').textContent = recurso ? 'Editar recurso' : 'Agregar recurso';
    document.getElementById('etiquetaCategoria').textContent = tipo === 'videos'
        ? 'Categoría'
        : tipo === 'juegos' ? 'Categoría del juego' : 'Categoría';
    actualizarSelectoresCategorias();
    const selectorCategoria = document.getElementById('recursoCategoria');
    if (recurso?.categoriaId && obtenerCategorias().some((categoria) => categoria.id === recurso.categoriaId)) {
        selectorCategoria.value = recurso.categoriaId;
    } else if (recurso?.categoria) {
        const valorAnterior = `legacy:${recurso.categoria}`;
        const opcionAnterior = document.createElement('option');
        opcionAnterior.value = valorAnterior;
        opcionAnterior.textContent = `${recurso.categoria} (categoría anterior)`;
        selectorCategoria.append(opcionAnterior);
        selectorCategoria.value = valorAnterior;
    } else {
        selectorCategoria.value = '';
    }
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('recursoTitulo').focus();
}

function actualizarAyudaOrigenLectura() {
    const tipo = document.getElementById('recursoTipo').value;
    const usaDrive = ['lecturas', 'videos'].includes(tipo);
    const esDrive = usaDrive && document.getElementById('origenLectura').value === 'drive';
    document.getElementById('etiquetaRecursoUrl').textContent = esDrive
        ? 'Enlace compartido de Google Drive'
        : tipo === 'lecturas' ? 'Enlace de la página web' : 'Enlace del video';
    document.getElementById('recursoUrl').placeholder = esDrive
        ? 'https://drive.google.com/file/d/...'
        : tipo === 'lecturas' ? 'https://' : 'https:// o enlace de YouTube/Vimeo';
    if (!usaDrive) return;
    document.getElementById('ayudaOrigenLectura').textContent = esDrive
        ? tipo === 'videos'
            ? 'Pega el enlace para compartir del archivo de video en Drive y permite que los estudiantes con el enlace puedan verlo.'
            : 'Pega el enlace para compartir de Drive y permite que los estudiantes que tengan el enlace puedan verlo.'
        : tipo === 'videos'
            ? 'Puedes usar un enlace de video directo, YouTube o Vimeo.'
            : 'Pega la dirección web donde se encuentra la lectura.';
}

// Oculta el formulario modal de recursos.
function cerrarFormularioRecurso() {
    const modal = document.getElementById('modalRecurso');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

// Valida los campos del formulario y crea o actualiza un recurso en el catálogo.
function guardarRecursoDesdeFormulario(event) {
    event.preventDefault();
    const tipo = document.getElementById('recursoTipo').value;
    const id = document.getElementById('recursoId').value;
    const url = urlSegura(document.getElementById('recursoUrl').value.trim());
    const origenLectura = document.getElementById('origenLectura').value;
    const imagenIngresada = document.getElementById('recursoImagen').value.trim();
    const imagen = imagenIngresada ? urlSegura(imagenIngresada) : '';
    const titulo = document.getElementById('recursoTitulo').value.trim();
    const categoriaSeleccionada = document.getElementById('recursoCategoria').value;
    const categoriaRegistrada = obtenerCategorias().find((item) => item.id === categoriaSeleccionada);
    const categoriaAnterior = categoriaSeleccionada.startsWith('legacy:')
        ? categoriaSeleccionada.slice('legacy:'.length)
        : '';
    const categoria = categoriaRegistrada?.nombre || categoriaAnterior;
    const descripcion = document.getElementById('recursoDescripcion').value.trim();
    const mensaje = document.getElementById('mensajeRecurso');
    if (mensaje) {
        mensaje.classList.remove('success');
        mensaje.textContent = '';
    }
    if (!url || (imagenIngresada && !imagen)) {
        if (mensaje) mensaje.textContent = 'Revisa que los enlaces comiencen con https:// o http://.';
        return;
    }
    if (['lecturas', 'videos'].includes(tipo) && origenLectura === 'drive' && !esEnlaceDrive(url)) {
        if (mensaje) mensaje.textContent = 'Pega un enlace compartido de drive.google.com o docs.google.com.';
        return;
    }
    if (tipo === 'videos' && origenLectura === 'drive' && !obtenerIdArchivoDrive(url)) {
        if (mensaje) mensaje.textContent = 'El enlace de Drive no contiene un identificador de archivo válido.';
        return;
    }
    if (pareceContenidoAdulto(`${titulo} ${categoria} ${descripcion} ${url}`)) {
        if (mensaje) mensaje.textContent = 'No se permite agregar contenido para adultos ni +18.';
        return;
    }

    const recurso = {
        id: id || `recurso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tipo,
        titulo,
        categoria,
        categoriaId: categoriaRegistrada?.id || '',
        descripcion,
        url,
        imagen
    };
    if (tipo === 'lecturas') recurso.origenLectura = origenLectura;
    if (tipo === 'videos') recurso.origenVideo = origenLectura;
    const recursos = obtenerRecursos();
    const indice = recursos.findIndex((item) => item.id === id);
    if (indice < 0) recursos.push(recurso);
    else recursos[indice] = recurso;
    guardarRecursos(recursos);
    cerrarFormularioRecurso();
    renderizarCatalogoDocente();
}

// Solicita confirmación y elimina el recurso seleccionado del catálogo.
function eliminarRecurso(id) {
    const recurso = obtenerRecursos().find((item) => item.id === id);
    if (!recurso || !window.confirm(`¿Eliminar "${recurso.titulo}" del catálogo?`)) return;
    guardarRecursos(obtenerRecursos().filter((item) => item.id !== id));
    renderizarCatalogoDocente();
}

// Activa la pestaña solicitada y actualiza el estado visual de los botones de navegación.
function cambiarPestana(nombrePestana, botonSeleccionado) {
    document.querySelectorAll('.tab-content').forEach((tab) => tab.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach((boton) => boton.classList.remove('active'));
    document.getElementById(`tab-${nombrePestana}`)?.classList.add('active');
    if (botonSeleccionado) botonSeleccionado.classList.add('active');
}

// Abre el lector modal mostrando el título y la dirección del recurso.
function abrirLector(titulo, url) {
    const modal = document.getElementById('modalLector');
    const iframe = document.getElementById('iframeLector');
    const tituloModal = document.getElementById('tituloLector');
    if (modal && iframe && tituloModal) {
        tituloModal.textContent = titulo;
        iframe.src = url;
        modal.classList.add('active');
    }
}

// Detiene el contenido incrustado y cierra el lector modal.
function cerrarLector() {
    const modal = document.getElementById('modalLector');
    const iframe = document.getElementById('iframeLector');
    if (modal && iframe) {
        iframe.src = '';
        modal.classList.remove('active');
    }
}

// Los juegos reutilizan el mismo visor modal que las lecturas.
function abrirJuego(titulo, url) {
    abrirLector(titulo, url);
}

// Presenta al docente las propuestas estudiantiles ordenadas desde la más reciente.
function renderizarSugerenciasDocente() {
    const lista = document.getElementById('lista-sugerencias');
    if (!lista) return;
    const sugerencias = obtenerListaLocal(CLAVE_SUGERENCIAS)
        .sort((primera, segunda) => segunda.fecha - primera.fecha);
    if (!sugerencias.length) {
        lista.innerHTML = '<p class="empty-state">No hay propuestas pendientes.</p>';
        return;
    }

    const tipos = { lecturas: 'Lectura', videos: 'Video', juegos: 'Juego' };
    lista.innerHTML = sugerencias.map((sugerencia) => {
        const publicada = sugerencia.estado === 'publicada';
        const revisada = sugerencia.estado === 'revisada' || publicada;
        const estado = publicada ? 'Publicada' : revisada ? 'Revisada' : 'Pendiente';
        return `<article class="suggestion-item"><div class="suggestion-item-heading"><span class="categoria-tag">${escaparHTML(tipos[sugerencia.tipo] || 'Recurso')}</span><span class="suggestion-status${revisada ? ' reviewed' : ''}">${estado}</span></div><h3>${escaparHTML(sugerencia.titulo)}</h3><p>Propuesta por <strong>${escaparHTML(sugerencia.nombre)}</strong></p><a href="${escaparHTML(urlSegura(sugerencia.url))}" target="_blank" rel="noopener noreferrer"><re-icon icon="external-link" size="17" aria-hidden="true"></re-icon>Revisar enlace en otra pestaña</a><div class="resource-actions">${!revisada ? `<button class="secondary-button" type="button" data-accion-sugerencia="revisar" data-id="${escaparHTML(sugerencia.id)}">Marcar revisada</button>` : ''}${revisada && !publicada ? `<button class="action-button" type="button" data-accion-sugerencia="publicar" data-id="${escaparHTML(sugerencia.id)}">Agregar al catálogo</button>` : ''}<button class="delete-button" type="button" data-accion-sugerencia="eliminar" data-id="${escaparHTML(sugerencia.id)}">Eliminar propuesta</button></div></article>`;
    }).join('');
}

// Detecta patrones de contenido adulto para filtrar recursos y comentarios no apropiados.
function pareceContenidoAdulto(texto) {
    let textoNormalizado = String(texto || '');
    try {
        textoNormalizado = decodeURIComponent(textoNormalizado);
    } catch (error) {
        return true;
    }
    return /(porn|xxx|onlyfans|nsfw|hentai|erot|\+\s*18|18\s*(?:\+|plus)|adult(?:o|a|s)?|\bsexo?\b|mayores?[-_\s]+de[-_\s]+edad)/i.test(textoNormalizado);
}

// Valida y guarda una propuesta enviada por un estudiante, inicialmente como pendiente.
function guardarSugerencia(event) {
    event.preventDefault();
    const nombre = document.getElementById('nombreSugerencia').value.trim();
    const tipo = document.getElementById('tipoSugerencia').value;
    const titulo = document.getElementById('tituloSugerencia').value.trim();
    const url = urlSegura(document.getElementById('urlSugerencia').value.trim());
    const mensaje = document.getElementById('mensajeSugerencia');
    mensaje.classList.remove('success');

    if (!['lecturas', 'videos', 'juegos'].includes(tipo)) {
        mensaje.textContent = 'Selecciona un tipo de recurso válido.';
        return;
    }
    if (!document.getElementById('confirmarContenidoApropiado').checked) {
        mensaje.textContent = 'Confirma que el recurso es apropiado para estudiantes.';
        return;
    }

    if (!url) {
        mensaje.textContent = 'Ingresa un enlace válido que comience con https:// o http://.';
        return;
    }
    if (pareceContenidoAdulto(`${titulo} ${url}`)) {
        mensaje.textContent = 'No se aceptan recursos para adultos ni contenido +18.';
        return;
    }

    const sugerencias = obtenerListaLocal(CLAVE_SUGERENCIAS);
    sugerencias.push({
        id: `propuesta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nombre,
        tipo,
        titulo,
        url,
        estado: 'pendiente',
        fecha: Date.now()
    });
    guardarListaLocal(CLAVE_SUGERENCIAS, sugerencias);
    event.currentTarget.reset();
    document.getElementById('nombreSugerencia').value = localStorage.getItem('nombreEstudiante') || '';
    mensaje.classList.add('success');
    mensaje.textContent = 'Propuesta enviada. Quedará pendiente de revisión docente.';
}

// Cambia el estado de una propuesta a revisada y actualiza la lista docente.
function marcarSugerenciaRevisada(id) {
    const sugerencias = obtenerListaLocal(CLAVE_SUGERENCIAS);
    const sugerencia = sugerencias.find((elemento) => elemento.id === id);
    if (!sugerencia) return;
    sugerencia.estado = 'revisada';
    guardarListaLocal(CLAVE_SUGERENCIAS, sugerencias);
    renderizarSugerenciasDocente();
}

// Publica en el catálogo una propuesta ya revisada, previa confirmación del docente.
function publicarSugerencia(id) {
    const sugerencias = obtenerListaLocal(CLAVE_SUGERENCIAS);
    const sugerencia = sugerencias.find((elemento) => elemento.id === id);
    if (!sugerencia || sugerencia.estado !== 'revisada') return;
    if (pareceContenidoAdulto(`${sugerencia.titulo} ${sugerencia.url}`)) {
        window.alert('No se permite publicar contenido para adultos ni +18.');
        return;
    }
    if (!window.confirm('Confirma que abriste y revisaste este recurso y que es apropiado para estudiantes, sin contenido adulto ni +18.')) return;

    const recursos = obtenerRecursos();
    const idRecurso = `propuesta-${sugerencia.id}`;
    if (!recursos.some((recurso) => recurso.id === idRecurso)) {
        recursos.push({
            id: idRecurso,
            tipo: sugerencia.tipo,
            titulo: sugerencia.titulo,
            categoria: 'Propuesta estudiantil',
            descripcion: `Propuesto por ${sugerencia.nombre}`,
            url: sugerencia.url,
            imagen: ''
        });
        guardarRecursos(recursos);
    }
    sugerencia.estado = 'publicada';
    guardarListaLocal(CLAVE_SUGERENCIAS, sugerencias);
    renderizarCatalogoDocente();
    renderizarSugerenciasDocente();
}

// Solicita confirmación y elimina una propuesta estudiantil.
function eliminarSugerencia(id) {
    const sugerencia = obtenerListaLocal(CLAVE_SUGERENCIAS).find((elemento) => elemento.id === id);
    if (!sugerencia || !window.confirm(`¿Eliminar la propuesta "${sugerencia.titulo}"?`)) return;
    guardarListaLocal(CLAVE_SUGERENCIAS, obtenerListaLocal(CLAVE_SUGERENCIAS).filter((elemento) => elemento.id !== id));
    renderizarSugerenciasDocente();
}

// Muestra la vista previa de un recurso en la página de inicio.
function abrirModal(titulo, descripcion) {
    const modal = document.getElementById('modalRecurso');
    const tituloModal = document.getElementById('modalTitulo');
    const descripcionModal = document.getElementById('modalDesc');
    if (!modal || !tituloModal || !descripcionModal) return;

    tituloModal.textContent = titulo;
    descripcionModal.textContent = descripcion;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('.close-modal')?.focus();
}

// Cierra la vista previa del recurso de la página de inicio.
function cerrarModal() {
    const modal = document.getElementById('modalRecurso');
    if (!modal || !document.getElementById('modalTitulo')) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

// Prepara el formulario y las opiniones existentes antes de abrir el modal de reseñas.
function abrirModalResena(recursoId) {
    const recurso = obtenerRecursos().find((elemento) => elemento.id === recursoId);
    const modal = document.getElementById('modalResena');
    const formulario = document.getElementById('formularioResena');
    if (!recurso || !modal || !formulario) return;

    formulario.reset();
    document.getElementById('resenaRecursoId').value = recurso.id;
    document.getElementById('tituloModalResena').textContent = `Opiniones: ${recurso.titulo}`;
    const autor = (localStorage.getItem('nombreEstudiante') || 'Estudiante').trim().toLocaleLowerCase();
    const resenaPropia = obtenerListaLocal(CLAVE_RESENAS).find((elemento) => elemento.recursoId === recursoId && elemento.nombre.toLocaleLowerCase() === autor);
    if (resenaPropia) {
        formulario.querySelector(`input[name="calificacion"][value="${resenaPropia.calificacion}"]`).checked = true;
        document.getElementById('comentarioResena').value = resenaPropia.comentario;
    }
    renderizarResenasModal(recursoId);
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

// Muestra las reseñas de un recurso, ordenadas de la más reciente a la más antigua.
function renderizarResenasModal(recursoId) {
    const lista = document.getElementById('resenasExistentes');
    if (!lista) return;
    const resenas = obtenerListaLocal(CLAVE_RESENAS)
        .filter((resena) => resena.recursoId === recursoId)
        .filter((resena) => !pareceContenidoAdulto(`${resena.nombre} ${resena.comentario}`))
        .sort((primera, segunda) => segunda.fecha - primera.fecha);
    lista.innerHTML = resenas.length
        ? resenas.map((resena) => `<article class="review-item"><div class="review-item-heading">${estrellasHTML(resena.calificacion)}<strong>${escaparHTML(resena.nombre)}</strong></div><p>${escaparHTML(resena.comentario)}</p></article>`).join('')
        : '<p class="empty-reviews">Aún no hay opiniones. Puedes ser la primera persona en valorar este recurso.</p>';
}

// Oculta la ventana modal de reseñas.
function cerrarModalResena() {
    const modal = document.getElementById('modalResena');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

// Guarda una reseña nueva o actualiza la del estudiante para ese recurso.
function guardarResena(event) {
    event.preventDefault();
    const recursoId = document.getElementById('resenaRecursoId').value;
    const calificacion = Number(new FormData(event.currentTarget).get('calificacion'));
    const comentario = document.getElementById('comentarioResena').value.trim();
    const nombre = (localStorage.getItem('nombreEstudiante') || 'Estudiante').trim();
    const mensaje = document.getElementById('mensajeResena');
    mensaje.classList.remove('success');
    if (pareceContenidoAdulto(comentario)) {
        mensaje.textContent = 'No se permiten comentarios con contenido para adultos ni +18.';
        return;
    }
    const resenas = obtenerListaLocal(CLAVE_RESENAS);
    const indice = resenas.findIndex((resena) => resena.recursoId === recursoId && resena.nombre.toLocaleLowerCase() === nombre.toLocaleLowerCase());
    const id = indice < 0 ? crearIdResena({ recursoId, nombre }) : (resenas[indice].id || crearIdResena({ recursoId, nombre }));
    const resena = { id, recursoId, nombre, calificacion, comentario, fecha: Date.now() };
    if (indice < 0) resenas.push(resena);
    else resenas[indice] = resena;
    guardarListaLocal(CLAVE_RESENAS, resenas);
    renderizarCatalogoEstudiante();
    renderizarResenasModal(recursoId);
    mensaje.classList.add('success');
    mensaje.textContent = 'Tu opinión quedó guardada.';
    event.currentTarget.reset();
}
