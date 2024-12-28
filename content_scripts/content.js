const SERVER = browser.runtime.getManifest()
    .content_security_policy.split(';')[0].split(' ')[2];

let socket = null;
let room = null;

let videoChangedByCode = 0;

const video = document.querySelector('video');
const videoEvents = ['play', 'pause', 'seeked'];

const actions = {
    connected: 'Successfully connected.',
    disconnected: 'Successfully disconnected.',
    roomCreated: 'Successfully created room.',
    roomJoined: 'Successfully joined room.',
    roomLeft: 'Successfully left room.'
};

const errors = {
    0: 'Problems with connection.',
    1: 'You are already connected.',
    2: 'You are not connected.',
    3: 'You are already in a room.',
    4: 'You are not in a room.'
};

function ErrorReply(id) {
    this.message = errors[id];
}

function ReplyMessage(comment='') {
    this.socket = Boolean(socket);
    this.room = room;
    this.comment = comment;
}

const onMessage = (event) => {
    const data = JSON.parse(event.data);

    if (['roomCreated', 'roomJoined'].includes(data.action)) {
        room = data.room;
    }

    if (data.action in actions) {
        browser.runtime.sendMessage(new ReplyMessage(
            data.success ? actions[data.action] : data.error
        ));
    }

    if (data.action == 'roomSynced') {
        if (Math.abs(data.currentTime - video.currentTime) > 1) {
            videoChangedByCode += 1;
            video.currentTime = data.currentTime;
        }

        if (data.paused === video.paused) return;

        videoChangedByCode += 1;
        data.paused ? video.pause() : video.play();
    }
};

const onClose = () => {
    socket = null;
    room = null;

    browser.runtime.sendMessage(
        new ReplyMessage(actions.disconnected)
    );
};

const onError = (event) => {
    console.error(event);
};

const isSocketReady = (action) => {
    return (
        ['getStatus', 'connect'].includes(action) ||
        (socket && socket.readyState === WebSocket.OPEN)
    );
};

const getStatus = async () => {
    return {
        socket: Boolean(socket), 
        room
    };
};

const connect = async () => {
    if (socket) return new ErrorReply(1);
    
    socket = new WebSocket(SERVER);

    socket.onmessage = onMessage;
    socket.onclose = onClose;
    socket.onerror = onError;
};

const disconnect = async () => {
    if (!socket) return new ErrorReply(2);

    socket.close();
};

const createRoom = async () => {
    if (room) return new ErrorReply(3);

    socket.send(JSON.stringify({
        action: 'createRoom',
        location: window.location.href
    }));
};

const joinRoom = async (req) => {
    if (room) return new ErrorReply(3);

    socket.send(JSON.stringify({
        action: 'joinRoom',
        room: req.room,
        location: window.location.href
    }));
};

const leaveRoom = async () => {
    if (!room) return new ErrorReply(4);

    socket.send(JSON.stringify({ action: 'leaveRoom' }));
    room = null;
};

const syncRoom = () => {
    if (videoChangedByCode) {
        videoChangedByCode -= 1;
        return;
    }

    if (!socket || !room) return;

    socket.send(JSON.stringify({
        action: 'syncRoom',
        currentTime: video.currentTime,
        paused: video.paused
    }));
};

videoEvents.forEach((event) => {
    video.addEventListener(event, syncRoom);
});

browser.runtime.onMessage.addListener(async (request) => {
    const requests = {
        getStatus,
        connect,
        disconnect,
        createRoom,
        joinRoom,
        leaveRoom
    };

    if (!isSocketReady(request.action)) {
        return new ErrorReply(0);
    }

    return requests[request.action](request);
});
