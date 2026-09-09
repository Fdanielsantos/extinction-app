package com.extinction.api.dto;

import com.extinction.api.domain.Mensagem;
import java.time.Instant;

public record MensagemResponse(
        Long id,
        Long conversaId,
        Long autorId,
        String autorNome,
        String texto,
        Instant data,
        RespostaResponse respostaA
) {
    /** Resumo da mensagem respondida -- só o suficiente pra desenhar a citação, sem precisar buscar a mensagem completa à parte. */
    public record RespostaResponse(Long id, String autorNome, String texto) {
        public static RespostaResponse from(Mensagem mensagem) {
            if (mensagem == null) return null;
            return new RespostaResponse(mensagem.getId(), mensagem.getAutor().getNome(), mensagem.getTexto());
        }
    }

    public static MensagemResponse from(Mensagem mensagem) {
        return new MensagemResponse(
                mensagem.getId(),
                mensagem.getConversa().getId(),
                mensagem.getAutor().getId(),
                mensagem.getAutor().getNome(),
                mensagem.getTexto(),
                mensagem.getData(),
                RespostaResponse.from(mensagem.getRespostaA())
        );
    }
}
