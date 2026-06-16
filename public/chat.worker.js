// src/assets/workers/chat.worker.js (или /public/chat.worker.js)

let socket = null;
let currentToken = null; // Храним текущий токен, чтобы отслеживать его смену
const ports = [];
let isConnected = false;

function connectWebSocket(token, host, protocol) {
  // Если сокет активен И токен не изменился — ничего не делаем
  if (socket && currentToken === token && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  // Если токен изменился, а сокет существует — принудительно закрываем старый сокет
  if (socket && currentToken !== token) {
    console.log('[Worker] Token changed. Closing old socket...');
    socket.close();
  }

  currentToken = token;

  const wsUrl = token
    ? `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/v1/chat/ws?token=${token}`
    : `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/v1/chat/ws`;

  console.log('[Worker] Connecting to WebSocket...', wsUrl);
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    isConnected = true;
    broadcast({ type: 'WS_STATUS', connected: true });
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      broadcast({ type: 'WS_MESSAGE', payload: data });
    } catch (e) {
      console.error('[Worker] JSON parsing error', e);
    }
  };

  socket.onclose = () => {
    isConnected = false;
    broadcast({ type: 'WS_STATUS', connected: false });

    // Переподключаемся, только если сокет не был обнулен намеренно при DISCONNECT
    if (currentToken) {
      setTimeout(() => connectWebSocket(currentToken, host, protocol), 4000);
    }
  };
}

function broadcast(message) {
  ports.forEach(port => {
    try {
      port.postMessage(message);
    } catch (e) {
      // Удаляем "мертвые" порты вкладок, которые были закрыты
      const idx = ports.indexOf(port);
      if (idx !== -1) ports.splice(idx, 1);
    }
  });
}

self.onconnect = (event) => {
  const port = event.ports[0];
  ports.push(port);

  port.onmessage = (e) => {
    const { action, payload, token, host, protocol } = e.data;

    switch (action) {
      case 'INIT':
        connectWebSocket(token, host, protocol);
        port.postMessage({ type: 'WS_STATUS', connected: isConnected });
        break;

      case 'SEND_WS': // Привели к единому названию с сервисом
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(payload));
        } else {
          console.warn('[Worker] Cannot send message, socket is not open');
        }
        break;

      case 'CALL_ANSWERED_LOCALLY':
        broadcast({ type: 'HIDE_CALL_MODAL', roomId: payload.roomId });
        break;

      case 'DISCONNECT': // Добавили корректную очистку при выходе из учетной записи
        console.log('[Worker] Received DISCONNECT signal. Cleaning up...');
        currentToken = null;
        if (socket) {
          socket.close();
          socket = null;
        }
        isConnected = false;
        broadcast({ type: 'WS_STATUS', connected: false });
        break;
    }
  };

  port.start();
};
