package com.extinction.api.dto;

import com.extinction.api.domain.Mensagem;
import java.time.Instant;

public record MensagemResponse(
        Long id,
        Long conversaId,
        Long autorId,
        String autorNome,
        String texto,
        Instant data
) {
    public static MensagemResponse from(Mensagem mensagem) {
        return new MensagemResponse(
                mensagem.getId(),
                mensagem.getConversa().getId(),
                mensagem.getAutor().getId(),
                mensagem.getAutor().getNome(),
                mensagem.getTexto(),
                mensagem.getData()
        );
    }
}
