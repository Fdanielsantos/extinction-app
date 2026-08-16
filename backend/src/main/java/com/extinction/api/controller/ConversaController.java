package com.extinction.api.controller;

import com.extinction.api.domain.Usuario;
import com.extinction.api.dto.ConversaResponse;
import com.extinction.api.dto.CriarGrupoRequest;
import com.extinction.api.dto.MensagemResponse;
import com.extinction.api.service.ConversaService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST cuida de listar/criar conversas e buscar o histórico. O envio de
 * mensagens em tempo real acontece via WebSocket (ver
 * {@link com.extinction.api.ws.ChatWebSocketHandler}), não por aqui.
 */
@RestController
@RequestMapping("/api/conversas")
public class ConversaController {

    private final ConversaService conversaService;

    public ConversaController(ConversaService conversaService) {
        this.conversaService = conversaService;
    }

    @GetMapping
    public List<ConversaResponse> listar(@AuthenticationPrincipal Usuario usuarioLogado) {
        return conversaService.listarMinhasConversas(usuarioLogado);
    }

    @PostMapping("/direta/{idOutroUsuario}")
    public ResponseEntity<ConversaResponse> obterOuCriarDireta(
            @PathVariable Long idOutroUsuario,
            @AuthenticationPrincipal Usuario usuarioLogado
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(conversaService.obterOuCriarDireta(usuarioLogado, idOutroUsuario));
    }

    @PostMapping("/grupo")
    public ResponseEntity<ConversaResponse> criarGrupo(
            @Valid @RequestBody CriarGrupoRequest request,
            @AuthenticationPrincipal Usuario usuarioLogado
    ) {
        ConversaResponse conversa = conversaService.criarGrupo(usuarioLogado, request.nome(), request.participanteIds());
        return ResponseEntity.status(HttpStatus.CREATED).body(conversa);
    }

    @GetMapping("/{id}/mensagens")
    public List<MensagemResponse> listarMensagens(
            @PathVariable Long id,
            @AuthenticationPrincipal Usuario usuarioLogado
    ) {
        return conversaService.listarMensagens(id, usuarioLogado);
    }
}
