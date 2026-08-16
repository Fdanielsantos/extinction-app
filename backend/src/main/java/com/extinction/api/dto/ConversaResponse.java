package com.extinction.api.dto;

import com.extinction.api.domain.Conversa;
import com.extinction.api.domain.TipoConversa;
import com.extinction.api.domain.Usuario;
import java.time.Instant;
import java.util.List;

public record ConversaResponse(
        Long id,
        TipoConversa tipo,
        String nomeExibicao,
        List<ParticipanteResponse> participantes,
        MensagemResponse ultimaMensagem
) {
    public record ParticipanteResponse(Long id, String nome, String fotoUrl) {
        public static ParticipanteResponse from(Usuario usuario) {
            return new ParticipanteResponse(usuario.getId(), usuario.getNome(), usuario.getFotoUrl());
        }
    }

    public static ConversaResponse from(Conversa conversa, Usuario usuarioLogado, MensagemResponse ultimaMensagem) {
        String nomeExibicao = conversa.getTipo() == TipoConversa.GRUPO
                ? conversa.getNome()
                : conversa.getParticipantes().stream()
                        .filter(u -> !u.getId().equals(usuarioLogado.getId()))
                        .findFirst()
                        .map(Usuario::getNome)
                        .orElse(usuarioLogado.getNome());

        return new ConversaResponse(
                conversa.getId(),
                conversa.getTipo(),
                nomeExibicao,
                conversa.getParticipantes().stream().map(ParticipanteResponse::from).toList(),
                ultimaMensagem
        );
    }
}
