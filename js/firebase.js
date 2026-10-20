import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";
import { get, getDatabase, ref, remove, set } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// Datos del proyecto Firebase al que se conecta esta biblioteca.
const firebaseConfig = {
    apiKey: "AIzaSyDEMk6FrPD9HvcsrkF5kBhLcx1k1MekHgM",
    authDomain: "bibloteca-mejorada.firebaseapp.com",
    databaseURL: "https://bibloteca-mejorada-default-rtdb.firebaseio.com",
    projectId: "bibloteca-mejorada",
    storageBucket: "bibloteca-mejorada.firebasestorage.app",
    messagingSenderId: "745641366769",
    appId: "1:745641366769:web:2d790265909eb016c18550",
    measurementId: "G-F0SERQP1CC"
};

// Limita las rutas de la base de datos a las colecciones usadas por la aplicación.
const COLECCIONES_PERMITIDAS = new Set(['resources', 'reviews', 'suggestions']);
// Inicializa Firebase y obtiene la instancia de Realtime Database.
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Rechaza cualquier colección que no esté en la lista permitida.
function validarColeccion(nombre) {
    if (!COLECCIONES_PERMITIDAS.has(nombre)) {
        throw new Error(`Colección Firebase no permitida: ${nombre}`);
    }
}

// Convierte el objeto de Firebase en una lista de registros que incluye sus identificadores.
function convertirSnapshot(snapshot) {
    const valores = snapshot.val() || {};
    return Object.entries(valores).map(([id, valor]) => ({ id, ...valor }));
}

// Expone operaciones limitadas de lectura y escritura para que main.js use Firebase.
window.bibliotecaFirebase = {
    async iniciarSesionProfesor(email, password) {
        const credencial = await signInWithEmailAndPassword(auth, email, password);
        return credencial.user;
    },

    async cerrarSesion() {
        await signOut(auth);
    },

    observarSesion(callback) {
        return onAuthStateChanged(auth, callback);
    },

    esperarSesion() {
        return new Promise((resolve, reject) => {
            const cancelarObservacion = onAuthStateChanged(
                auth,
                (usuario) => {
                    cancelarObservacion();
                    resolve(usuario);
                },
                (error) => {
                    cancelarObservacion();
                    reject(error);
                }
            );
        });
    },

    async leerColeccion(nombre) {
        validarColeccion(nombre);
        const snapshot = await get(ref(database, nombre));
        return convertirSnapshot(snapshot);
    },

    async guardarRegistro(nombre, id, valor) {
        validarColeccion(nombre);
        // Protege la ruta de la base de datos contra identificadores con caracteres inválidos.
        if (!/^[A-Za-z0-9_-]+$/.test(id)) {
            throw new Error('El identificador contiene caracteres no permitidos por Realtime Database.');
        }
        // El identificador forma parte de la ruta y no hace falta repetirlo dentro del registro.
        const { id: ignoredId, ...datos } = valor;
        await set(ref(database, `${nombre}/${id}`), datos);
    },

    async eliminarRegistro(nombre, id) {
        validarColeccion(nombre);
        // Se aplica la misma validación antes de construir la ruta que se va a eliminar.
        if (!/^[A-Za-z0-9_-]+$/.test(id)) {
            throw new Error('El identificador contiene caracteres no permitidos por Realtime Database.');
        }
        await remove(ref(database, `${nombre}/${id}`));
    }
};

// Analytics es opcional; solo se inicia si el navegador actual lo permite.
isSupported()
    .then((analyticsDisponible) => {
        if (analyticsDisponible) getAnalytics(app);
    })
    .catch((error) => console.info('Analytics no está disponible en este entorno.', error));

// Avisa al resto de la aplicación que la interfaz de Firebase ya quedó configurada.
window.dispatchEvent(new Event('biblioteca:firebase-listo'));
