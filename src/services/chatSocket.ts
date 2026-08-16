// Cliente WebSocket "cru" (sem STOMP/SockJS) do chat em tempo real — espelha
// o protocolo JSON simples implementado em ChatWebSocketHandler no backend.
// Um único socket compartilhado: telas chamam `conectar()` ao ganhar foco e
// se inscrevem via `onMensagem`/`onErro`.

import { Mensagem } from '../types';
import { API_BASE_URL, getAuthToken } from './api';

type OuvinteMensagem = (mensagem: Mensagem) => void;
type OuvinteErro = (mensagemErro: string) => void;

let socket: WebSocket | null = null;
const ouvintesMensagem = new Set<OuvinteMensagem>();
const ouvintesErro = new Set<OuvinteErro>();

function urlWebSocket(): string {
  const base = API_BASE_URL.replace(/^http/, 'ws');
  return `${base}/ws/chat?token=${encodeURIComponent(getAuthToken() ?? '')}`;
}

export function conectar(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  if (!getAuthToken()) return;

  const novoSocket = new WebSocket(urlWebSocket());
  novoSocket.onmessage = (evento) => {
    try {
      const payload = JSON.parse(evento.data);
      if (payload.tipo === 'mensagem') {
        ouvintesMensagem.forEach((ouvinte) => ouvinte(payload.mensagem as Mensagem));
      } else if (payload.tipo === 'erro') {
        ouvintesErro.forEach((ouvinte) => ouvinte(String(payload.mensagem)));
      }
    } catch {
      // payload malformado — ignora
    }
  };
  novoSocket.onclose = () => {
    if (socket === novoSocket) socket = null;
  };
  socket = novoSocket;
}

export function desconectar(): void {
  socket?.close();
  socket = null;
}

export function enviarMensagemWs(conversaId: number, texto: string): void {
  conectar();
  const payload = JSON.stringify({ tipo: 'enviar', conversaId, texto });
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(payload);
    return;
  }
  const socketAtual = socket;
  const aoAbrir = () => {
    socketAtual?.send(payload);
    socketAtual?.removeEventListener('open', aoAbrir);
  };
  socketAtual?.addEventListener('open', aoAbrir);
}

/** Retorna uma função de cancelamento da inscrição (padrão de cleanup do useEffect). */
export function onMensagem(ouvinte: OuvinteMensagem): () => void {
  ouvintesMensagem.add(ouvinte);
  return () => ouvintesMensagem.delete(ouvinte);
}

export function onErro(ouvinte: OuvinteErro): () => void {
  ouvintesErro.add(ouvinte);
  return () => ouvintesErro.delete(ouvinte);
}
