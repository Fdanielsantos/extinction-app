package com.extinction.api.ws;

import com.extinction.api.domain.Usuario;
import com.extinction.api.dto.MensagemResponse;
import com.extinction.api.exception.ApiException;
import com.extinction.api.repository.UsuarioRepository;
import com.extinction.api.service.ConversaService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * Protocolo JSON simples sobre WebSocket puro (sem STOMP/SockJS — mais fácil
 * de consumir de um `WebSocket` nativo do React Native do que carregar um
 * cliente STOMP lá).
 *
 * Cliente → servidor: {@code {"tipo":"enviar","conversaId":1,"texto":"oi"}}
 * Servidor → cliente: {@code {"tipo":"mensagem","mensagem":{...}}} (broadcast
 * pra todos os participantes da conversa, incluindo quem mandou) ou
 * {@code {"tipo":"erro","mensagem":"..."}}.
 */
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);

    private final ConversaService conversaService;
    private final UsuarioRepository usuarioRepository;
    private final ObjectMapper objectMapper;

    // Um usuário pode ter mais de uma conexão aberta (várias abas/dispositivos).
    private final Map<Long, Set<WebSocketSession>> sessoesPorUsuario = new ConcurrentHashMap<>();

    public ChatWebSocketHandler(
            ConversaService conversaService, UsuarioRepository usuarioRepository, ObjectMapper objectMapper) {
        this.conversaService = conversaService;
        this.usuarioRepository = usuarioRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long usuarioId = usuarioIdDaSessao(session);
        sessoesPorUsuario.computeIfAbsent(usuarioId, id -> ConcurrentHashMap.newKeySet()).add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long usuarioId = usuarioIdDaSessao(session);
        Set<WebSocketSession> sessoes = sessoesPorUsuario.get(usuarioId);
        if (sessoes != null) sessoes.remove(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        Long usuarioId = usuarioIdDaSessao(session);
        JsonNode payload;
        try {
            payload = objectMapper.readTree(message.getPayload());
        } catch (Exception e) {
            return;
        }
        if (!"enviar".equals(payload.path("tipo").asText())) {
            return;
        }

        Long conversaId = payload.path("conversaId").asLong();
        String texto = payload.path("texto").asText("").trim();
        if (texto.isEmpty()) return;

        Usuario autor = usuarioRepository.findById(usuarioId).orElse(null);
        if (autor == null) return;

        MensagemResponse mensagem;
        try {
            mensagem = conversaService.enviarMensagem(conversaId, autor, texto);
        } catch (ApiException e) {
            enviarErro(session, e.getMessage());
            return;
        }

        String envelope = objectMapper.writeValueAsString(Map.of("tipo", "mensagem", "mensagem", mensagem));
        for (Long destinatarioId : conversaService.obterParticipanteIds(conversaId)) {
            broadcast(destinatarioId, envelope);
        }
    }

    private void broadcast(Long usuarioId, String payload) {
        Set<WebSocketSession> sessoes = sessoesPorUsuario.get(usuarioId);
        if (sessoes == null) return;
        for (WebSocketSession sessao : sessoes) {
            if (!sessao.isOpen()) continue;
            try {
                sessao.sendMessage(new TextMessage(payload));
            } catch (IOException e) {
                log.warn("Falha ao enviar mensagem de chat pra sessão {}", sessao.getId(), e);
            }
        }
    }

    private void enviarErro(WebSocketSession session, String mensagem) throws IOException {
        session.sendMessage(new TextMessage(
                objectMapper.writeValueAsString(Map.of("tipo", "erro", "mensagem", mensagem))));
    }

    private Long usuarioIdDaSessao(WebSocketSession session) {
        return (Long) session.getAttributes().get("usuarioId");
    }
}
