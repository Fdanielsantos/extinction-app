package com.extinction.api.ws;

import com.extinction.api.domain.Usuario;
import com.extinction.api.security.JwtService;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/**
 * O cliente RN não consegue mandar o header `Authorization` de forma
 * confiável no handshake de um WebSocket puro — por isso o token vai como
 * query param (`?token=...`) e é validado aqui, antes do upgrade da conexão.
 * `/ws/**` fica liberado no {@link com.extinction.api.config.SecurityConfig}
 * (senão a própria requisição HTTP do handshake seria barrada antes de
 * chegar aqui) e a autenticação de verdade acontece só neste interceptor.
 */
@Component
public class ChatHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public ChatHandshakeInterceptor(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        String token = extrairToken(request);
        if (token == null) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        try {
            String username = jwtService.extractUsername(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            if (!jwtService.isTokenValid(token, userDetails)) {
                response.setStatusCode(HttpStatus.UNAUTHORIZED);
                return false;
            }
            Usuario usuario = (Usuario) userDetails;
            attributes.put("usuarioId", usuario.getId());
            attributes.put("usuarioNome", usuario.getNome());
            return true;
        } catch (Exception e) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
        // nada a fazer
    }

    private String extrairToken(ServerHttpRequest request) {
        String query = request.getURI().getQuery();
        if (query == null) return null;
        for (String par : query.split("&")) {
            String[] partes = par.split("=", 2);
            if (partes.length == 2 && partes[0].equals("token")) {
                return URLDecoder.decode(partes[1], StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}
