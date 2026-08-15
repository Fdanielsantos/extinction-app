package com.extinction.api.dto;

import com.extinction.api.domain.Comentario;
import java.time.Instant;

public record ComentarioResponse(
        Long id,
        Long idPerfil,
        String autorNome,
        String descricao,
        Instant data
) {
    public static ComentarioResponse from(Comentario comentario) {
        return new ComentarioResponse(
                comentario.getId(),
                comentario.getUsuario().getId(),
                comentario.getUsuario().getNome(),
                comentario.getDescricao(),
                comentario.getData()
        );
    }
}
