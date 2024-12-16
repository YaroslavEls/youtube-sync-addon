const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
console.log('WebSocket server is running on port 8080');

const cleaner = {
    set(obj, prop, value) {
        if (value.length > 0) {
            obj[prop] = value;
        } else {
            delete obj[prop];
        }
        return true;
    }
};
const rooms = new Proxy({}, cleaner);
const roomsMap = {};

wss.on('connection', (ws) => {
    console.log('New connection.');

    ws.send(JSON.stringify({ 
        action: 'connected', 
        success: true, 
    }));

    let room = null;

    const messageHandlers = {
        createRoom: (data) => {
            do {
                room = Math.floor((Math.random() * 1000000) + 1);
                room = room.toString().padStart(6, '0');
            } while (rooms.hasOwnProperty(room));
            rooms[room] = [ws];
            roomsMap[room] = data.location;

            ws.send(JSON.stringify({ 
                action: 'roomCreated', 
                success: true, 
                room
            }));
        },
        joinRoom: (data) => {
            if (!rooms[data.room]) {
                ws.send(JSON.stringify({
                    action: 'roomJoined',
                    success: false,
                    error: 'No room with such id.'
                }));
                return;
            }
            if (roomsMap[data.room] !== data.location) {
                ws.send(JSON.stringify({
                    action: 'roomJoined',
                    success: false,
                    error: 'Wrong location.'
                }));
                return;
            }

            room = data.room;
            rooms[data.room].push(ws);

            ws.send(JSON.stringify({ 
                action: 'roomJoined', 
                success: true, 
                room: data.room 
            })); 
        },
        leaveRoom: (data) => {
            rooms[room] = rooms[room].filter(val => val !== ws);
            room = null;

            ws.send(JSON.stringify({
                action: 'roomLeft', 
                success: true 
            }));
        },
        syncRoom: (data) => {
            rooms[room].forEach(client => {
                if (client === ws) return;

                client.send(JSON.stringify({ 
                    action: 'roomSynced', 
                    currentTime: data.currentTime, 
                    paused: data.paused 
                }));
            });
        }
    };

    ws.on('message', (message) => {
        console.log('Message received:');
        const data = JSON.parse(message);
        console.log(data);

        messageHandlers[data.action](data);

        console.log('Message processed.');
    });

    ws.on('close', () => {
        if (room) {
            rooms[room] = rooms[room].filter(val => val !== ws);
            room = null;
        }
        
        console.log('Client disconnected.');
    });
});
