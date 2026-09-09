package com.extinction.api.service;

import com.extinction.api.domain.Conversa;
import com.extinction.api.domain.Mensagem;
import com.extinction.api.domain.TipoConversa;
import com.extinction.api.domain.Usuario;
import com.extinction.api.dto.ConversaResponse;
import com.extinction.api.dto.MensagemResponse;
import com.extinction.api.exception.ApiException;
import com.extinction.api.repository.ConversaRepository;
import com.extinction.api.repository.MensagemRepository;
import com.extinction.api.repository.UsuarioRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * RF: chats diretos e em grupo entre usuários. O envio em tempo real roda por
 * WebSocket ({@link com.extinction.api.ws.ChatWebSocketHandler}), que delega
 * a persistência da mensagem pra {@link #enviarMensagem} aqui — REST cuida só
 * de listar conversas/histórico e criar conversas/grupos.
 */
@Service
public class ConversaService {

    private final ConversaRepository conversaRepository;
    private final MensagemRepository mensagemRepository;
    private final UsuarioRepository usuarioRepository;

    public ConversaService(
            ConversaRepository conversaRepository,
            MensagemRepository mensagemRepository,
            UsuarioRepository usuarioRepository
    ) {
        this.conversaRepository = conversaRepository;
        this.mensagemRepository = mensagemRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public List<ConversaResponse> listarMinhasConversas(Usuario usuarioLogado) {
        return conversaRepository.findByParticipantes_Id(usuarioLogado.getId()).stream()
                .map(conversa -> paraResponse(conversa, usuarioLogado))
                .sorted(Comparator.comparing(
                        (ConversaResponse c) -> c.ultimaMensagem() != null ? c.ultimaMensagem().data() : Instant.EPOCH)
                        .reversed())
                .toList();
    }

    @Transactional
    public ConversaResponse obterOuCriarDireta(Usuario usuarioLogado, Long idOutroUsuario) {
        if (idOutroUsuario.equals(usuarioLogado.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Não é possível iniciar uma conversa consigo mesmo.");
        }
        Usuario outro = usuarioRepository.findById(idOutroUsuario)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuário não encontrado."));

        Conversa conversa = conversaRepository
                .buscarConversaDireta(usuarioLogado.getId(), idOutroUsuario)
                .orElseGet(() -> {
                    Set<Usuario> participantes = new HashSet<>(Set.of(usuarioLogado, outro));
                    return conversaRepository.save(Conversa.builder()
                            .tipo(TipoConversa.DIRETA)
                            .criadaEm(Instant.now())
                            .participantes(participantes)
                            .build());
                });

        return paraResponse(conversa, usuarioLogado);
    }

    @Transactional
    public ConversaResponse criarGrupo(Usuario usuarioLogado, String nome, List<Long> participanteIds) {
        Set<Usuario> participantes = new HashSet<>(usuarioRepository.findAllById(participanteIds));
        participantes.add(usuarioLogado);
        if (participantes.size() < 2) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Selecione ao menos mais um participante pro grupo.");
        }

        Conversa conversa = conversaRepository.save(Conversa.builder()
                .tipo(TipoConversa.GRUPO)
                .nome(nome)
                .criador(usuarioLogado)
                .criadaEm(Instant.now())
                .participantes(participantes)
                .build());

        return paraResponse(conversa, usuarioLogado);
    }

    @Transactional
    public ConversaResponse adicionarParticipante(Long conversaId, Usuario usuarioLogado, Long novoParticipanteId) {
        Conversa conversa = garantirGrupoEhCriador(conversaId, usuarioLogado);

        Usuario novoParticipante = usuarioRepository.findById(novoParticipanteId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuário não encontrado."));
        conversa.getParticipantes().add(novoParticipante);
        conversa = conversaRepository.save(conversa);

        return paraResponse(conversa, usuarioLogado);
    }

    @Transactional
    public ConversaResponse removerParticipante(Long conversaId, Usuario usuarioLogado, Long participanteId) {
        Conversa conversa = garantirParticipante(conversaId, usuarioLogado);
        if (conversa.getTipo() != TipoConversa.GRUPO) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Conversas diretas não têm participantes gerenciáveis.");
        }

        boolean ehORemovidoOProprio = participanteId.equals(usuarioLogado.getId());
        boolean ehCriador = conversa.getCriador() != null && conversa.getCriador().getId().equals(usuarioLogado.getId());
        // O criador remove qualquer um; qualquer outro participante só pode se
        // auto-remover (== sair do grupo).
        if (!ehORemovidoOProprio && !ehCriador) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Só o criador do grupo pode remover outros participantes.");
        }
        if (conversa.getCriador() != null && conversa.getCriador().getId().equals(participanteId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "O criador não pode ser removido do grupo (exclua o grupo em vez disso).");
        }
        if (conversa.getParticipantes().size() <= 2) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Um grupo precisa de ao menos 2 participantes.");
        }

        conversa.getParticipantes().removeIf(u -> u.getId().equals(participanteId));
        conversa = conversaRepository.save(conversa);

        return paraResponse(conversa, usuarioLogado);
    }

    private Conversa garantirGrupoEhCriador(Long conversaId, Usuario usuarioLogado) {
        Conversa conversa = garantirParticipante(conversaId, usuarioLogado);
        if (conversa.getTipo() != TipoConversa.GRUPO) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Conversas diretas não têm participantes gerenciáveis.");
        }
        boolean ehCriador = conversa.getCriador() != null && conversa.getCriador().getId().equals(usuarioLogado.getId());
        if (!ehCriador) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Só o criador do grupo pode adicionar participantes.");
        }
        return conversa;
    }

    @Transactional(readOnly = true)
    public List<MensagemResponse> listarMensagens(Long conversaId, Usuario usuarioLogado) {
        garantirParticipante(conversaId, usuarioLogado);
        return mensagemRepository.findByConversaIdOrderByDataAsc(conversaId).stream()
                .map(MensagemResponse::from)
                .toList();
    }

    @Transactional
    public MensagemResponse enviarMensagem(Long conversaId, Usuario usuarioLogado, String texto, Long respostaAId) {
        Conversa conversa = garantirParticipante(conversaId, usuarioLogado);

        Mensagem respostaA = null;
        if (respostaAId != null) {
            respostaA = mensagemRepository.findById(respostaAId)
                    .filter(m -> m.getConversa().getId().equals(conversaId))
                    .orElse(null);
        }

        Mensagem mensagem = mensagemRepository.save(Mensagem.builder()
                .conversa(conversa)
                .autor(usuarioLogado)
                .texto(texto)
                .data(Instant.now())
                .respostaA(respostaA)
                .build());
        return MensagemResponse.from(mensagem);
    }

    /** IDs de todo mundo que deve receber o broadcast de uma mensagem nova (usado pelo WebSocket handler). */
    @Transactional(readOnly = true)
    public Set<Long> obterParticipanteIds(Long conversaId) {
        Conversa conversa = conversaRepository.findById(conversaId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Conversa não encontrada."));
        return conversa.getParticipantes().stream().map(Usuario::getId).collect(java.util.stream.Collectors.toSet());
    }

    private Conversa garantirParticipante(Long conversaId, Usuario usuarioLogado) {
        Conversa conversa = conversaRepository.findById(conversaId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Conversa não encontrada."));
        boolean participa = conversa.getParticipantes().stream()
                .anyMatch(u -> u.getId().equals(usuarioLogado.getId()));
        if (!participa) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Você não participa dessa conversa.");
        }
        return conversa;
    }

    private ConversaResponse paraResponse(Conversa conversa, Usuario usuarioLogado) {
        MensagemResponse ultimaMensagem = mensagemRepository.findTopByConversaIdOrderByDataDesc(conversa.getId())
                .map(MensagemResponse::from)
                .orElse(null);
        return ConversaResponse.from(conversa, usuarioLogado, ultimaMensagem);
    }
}
