const $ = (id) => document.getElementById(id);

function updateView(socket, room, comment) {
    const elems = {
        'create-group': !room,
        'join-group': !room,
        'room-group': !!room,
        'leave-group': !!room
    };
    for (const key in elems) {
        $(key).classList.remove('active');
    }
    $('status').style.backgroundColor = 'rgb(255, 0, 0)';
    $('comment').textContent = comment;

    if (!socket) return;

    if (room) {
        $('room-id').textContent = room;
    }

    $('status').style.backgroundColor = 'rgb(0, 255, 0)';
    
    const active = Object.keys(elems).filter(key => elems[key]);
    for (const key of active) {
        $(key).classList.add('active');
    }
}

async function sendMessage(tab, action, room=null) {
    const message = { action: action };
    if (room) {
        message.room = room;
    }

    const error = await browser.tabs.sendMessage(tab.id, message);
    if (error) {
        $('comment').textContent = error.message;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const tabs = await browser.tabs.query({ 
        currentWindow: true, 
        active: true 
    });
    const tab = tabs[0];

    let { socket, room } = await browser.tabs.sendMessage(tab.id, {
        action: 'getStatus' 
    });

    if (!socket) {
        await sendMessage(tab, 'connect');
    } else {
        updateView(socket, room, '');
    }

    browser.runtime.onMessage.addListener((message) => {
        socket = message.socket;
        room = message.room;
        updateView(socket, room, message.comment);
    });

    $('refresh').addEventListener('click', async () => {
        if (socket) {
            await sendMessage(tab, 'disconnect');
        }
        await sendMessage(tab, 'connect');
    });

    $('create-group').addEventListener('click', async () => {
        await sendMessage(tab, 'createRoom');
    });

    $('join-btn').addEventListener('click', async () => {
        const roomId = $('room-input').value;
        if (!roomId) {
            $('comment').textContent = 'Please enter room id.';
            return;
        }

        await sendMessage(tab, 'joinRoom', roomId);
    });

    $('leave-group').addEventListener('click', async () => {
        await sendMessage(tab, 'leaveRoom');
    });
});
  