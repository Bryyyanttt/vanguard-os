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

const server = http.createServer((req, res) => {
    fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
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
    console.log('Vanguard Server con Salvataggio automatico attivo su porta 8080!');
});