package com.extinction.api.dto;

import com.extinction.api.domain.Usuario;

public record UsuarioPublicoResponse(
        Long id,
        String nome,
        String userName,
        String bio,
        String fotoUrl,
        long totalSeguidores,
        long totalSeguindo,
        boolean seguindoPeloUsuario
) {
    public static UsuarioPublicoResponse from(
            Usuario usuario, long totalSeguidores, long totalSeguindo, boolean seguindoPeloUsuario) {
        return new UsuarioPublicoResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getUserName(),
                usuario.getBio(),
                usuario.getFotoUrl(),
                totalSeguidores,
                totalSeguindo,
                seguindoPeloUsuario
        );
    }
}
