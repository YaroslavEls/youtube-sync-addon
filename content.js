let socket = null;
let room = null;

let videoChangedByCode = false;

function connect() {
    if (socket) {
        return Promise.resolve({ 
            success: false,
            comment: 'You are already connected' 
        });
    } 
    
    socket = new WebSocket('ws://localhost:8080');

    const actions = {
        connected: 'Successfully connected',
        disconnected: 'Successfully disconnected',
        roomCreated: 'Successfully created room',
        roomJoined: 'Successfully joined room',
        roomLeft: 'Successfully left room'
    };

    socket.onopen = () => {
        browser.runtime.sendMessage({
            action: 'connected',
            socket: Boolean(socket),
            room,
            comment: 'Successfully connected'
        });
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (['roomCreated', 'roomJoined'].includes(data.action)) {
            room = data.room
        }

        if (data.action in actions) {
            browser.runtime.sendMessage({
                action: data.action,
                socket: Boolean(socket),
                room,
                comment: data.success 
                    ? actions[data.action]
                    : data.error
            });
        }

        if (data.action == 'roomSynced') {
            videoChangedByCode = true;
            if (Math.abs(data.currentTime - video.currentTime) > 1) {
                video.currentTime = data.currentTime
            }
            if (data.paused) {
                video.pause()
            } else {
                video.play()
            }
        }
    };

    socket.onclose = () => {
        socket = null;
        room = null;

        browser.runtime.sendMessage({
            action: 'disconnected',
            socket: Boolean(socket),
            room,
            comment: 'Successfully disconnected'
        });
    };

    socket.onerror = (ev) => {
        console.log(ev);
    };

    return Promise.resolve({ success: true });
}

function disconnect() {
    if (!socket) {
        return Promise.resolve({
            success: false,
            comment: 'You are not connected'
        });
    };

    socket.close();

    return Promise.resolve({ success: true });
}

function createRoom() {
    if (!socket || room) {
        return Promise.resolve({
            success: false,
            comment: 'Failed to create room' 
        }); 
    };

    socket.send(JSON.stringify({
        action: 'createRoom',
        location: window.location.href
    }));
    
    return Promise.resolve({ success: true });
}

function joinRoom(id) {
    if (!socket || room) {
        return Promise.resolve({
            success: false,
            comment: 'Failed to join room'
        }); 
    };

    socket.send(JSON.stringify({
        action: 'joinRoom',
        room: id,
        location: window.location.href
    }));

    return Promise.resolve({ success: true });
}

function leaveRoom() {
    if (!socket || !room) {
        return Promise.resolve({
            success: false,
            comment: 'Failed to leave room'
        });
    }

    socket.send(JSON.stringify({ action: 'leaveRoom' }));
    room = null;

    return Promise.resolve({ success: true });
}

function syncRoom() {
    if (videoChangedByCode) {
        videoChangedByCode = false;
        return;
    }

    if (!socket || !room) return;

    socket.send(JSON.stringify({
        action: 'syncRoom',
        currentTime: video.currentTime,
        paused: video.paused
    }));
}

browser.runtime.onMessage.addListener((request) => {
    const requests = {
        'getStatus': () => Promise.resolve({
            socket: Boolean(socket), 
            room
        }),
        'connect': connect,
        'disconnect': disconnect,
        'createRoom': createRoom,
        'joinRoom': () => joinRoom(request.room),
        'leaveRoom': leaveRoom
    };

    if (!['getStatus', 'connect'].includes(request.action) &&
        socket.readyState !== WebSocket.OPEN) {
        return Promise.resolve({
            success: false,
            comment: 'Problems with connection'
        }); 
    }

    return requests[request.action]();
});

const video = document.querySelector('video');

if (video) {
    video.addEventListener('play', syncRoom);
    video.addEventListener('pause', syncRoom);
    video.addEventListener('seeked', syncRoom);
}
