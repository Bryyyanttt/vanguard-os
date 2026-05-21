const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const FILE_PATH = path.join(__dirname, 'salvataggio.json');

// Carica i dati vecchi all'avvio del server (se il file esiste)
let lastSavedState = null;
if (fs.existsSync(FILE_PATH)) {
    try {
        lastSavedState = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
        console.log('✔ Salvataggio precedente caricato con successo dal disco!');
    } catch (e) {
        console.log('Nessun salvataggio valido trovato, parto da zero.');
    }
}

// === MODIFICATO: Ora gestisce index.html, manifest.json e altri file ===
const server = http.createServer((req, res) => {
    // Se non viene chiesto un file specifico, di default inviamo index.html
    let filePath = req.url === '/' ? 'index.html' : req.url.substring(1);
    filePath = path.join(__dirname, filePath.split('?')[0]); // Rimuove eventuali parametri della URL

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File non trovato');
        } else {
            // Riconosce automaticamente il tipo di file corretto per il browser
            let contentType = 'text/html';
            if (filePath.endsWith('.json')) contentType = 'application/json';
            if (filePath.endsWith('.js')) contentType = 'application/javascript';
            if (filePath.endsWith('.png')) contentType = 'image/png';

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    // Appena il telefono si connette, gli inviamo subito l'ultimo stato salvato
    if (lastSavedState) ws.send(JSON.stringify(lastSavedState));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'sync_ping') {
            ws.send(JSON.stringify({ type: 'sync_pong', clientTime: data.clientTime, serverTime: Date.now() }));
        } else if (data.type === 'matrix_broadcast') {
            lastSavedState = data;
            
            // SALVATAGGIO REALE: Scrive il dato sul disco rigido del PC
            fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));

            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === 1) {
                    client.send(message.toString());
                }
            });
        }
    });
});

server.listen(8080, '0.0.0.0', () => {
    console.log('Vanguard Server con supporto PWA attivo su porta 8080!');
});
