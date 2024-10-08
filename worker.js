// index.html
const worker = new Worker('worker.js');

worker.postMessage('Hola desde el hilo principal');

worker.onmessage = (event) => {
  console.log('Mensaje desde el worker:', event.data);
};

// worker.js
self.addEventListener('message', (event) => {
  console.log('Mensaje recibido:', event.data);
  // Realizar alguna tarea aquí
  self.postMessage('¡Hola desde el worker!');
});