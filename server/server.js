require('dotenv').config();
const WebSocket = require('ws');

const roomsMap = {};

const wss = new WebSocket.Server({ port: process.env.PORT });
console.log(`WebSocket server is running on port ${process.env.PORT}`);

const writeLog = (message) => {
    console.log(`[${new Date().toLocaleString("en-GB")}] - ${message}`);
};

const generateId = () => {
    let room = null;
    do {
        const id = Math.floor((Math.random() * 1000000) + 1);
        room = id.toString().padStart(6, '0');
    } while (roomsMap.hasOwnProperty(room));

    return room;
};

const getPartners = (ws) => {
    return Array.from(wss.clients)
        .filter(sock => sock.room === ws.room);
};

const createRoomHandler = (ws, data) => {
    ws.room = generateId();
    roomsMap[ws.room] = data.location;

    ws.send(JSON.stringify({ 
        action: 'roomCreated', 
        success: true, 
        room: ws.room
    }));
};

const joinRoomHandler = (ws, data) => {
    const reply = { action: 'roomJoined' };

    if (!roomsMap[data.room]) {
        reply.success = false;
        reply.error = 'No room with such id.'
        ws.send(JSON.stringify(reply));
        return;
    }
    if (roomsMap[data.room] !== data.location) {
        reply.success = false;
        reply.error = 'Wrong location.'
        ws.send(JSON.stringify(reply));
        return;
    }

    ws.room = data.room;

    reply.success = false;
    reply.room = data.room;
    ws.send(JSON.stringify(reply));
};

const leaveRoomHandler = (ws, data) => {
    if (getPartners(ws).length === 1) {
        delete roomsMap[ws.room];
    }
    ws.room = null;

    ws.send(JSON.stringify({
        action: 'roomLeft', 
        success: true 
    }));
};

const syncRoomHandler = (ws, data) => {
    getPartners(ws).forEach(client => {
        if (client === ws) return;

        client.send(JSON.stringify({ 
            action: 'roomSynced', 
            currentTime: data.currentTime, 
            paused: data.paused 
        }));
    });
};

wss.on('connection', (ws) => {
    writeLog('New connection.');

    ws.send(JSON.stringify({ 
        action: 'connected', 
        success: true, 
    }));

    ws.room = null;

    const messageHandlers = {
        createRoom: createRoomHandler,
        joinRoom: joinRoomHandler,
        leaveRoom: leaveRoomHandler,
        syncRoom: syncRoomHandler
    };

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        writeLog(`Processed "${data.action}" action.`);
        
        messageHandlers[data.action](ws, data);
    });

    ws.on('close', () => {
        if (ws.room) {
            if (getPartners(ws).length === 1) {
                delete roomsMap[ws.room];
            }
            ws.room = null;
        }
        
        writeLog('Client disconnected.');
    });
});
