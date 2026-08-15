package com.extinction.api.dto;

import com.extinction.api.domain.Usuario;

public record RankingUsuarioResponse(
        Long idPerfil,
        String nome,
        long totalAvistamentosValidados
) {
    public static RankingUsuarioResponse of(Usuario usuario, long total) {
        return new RankingUsuarioResponse(usuario.getId(), usuario.getNome(), total);
    }
}
