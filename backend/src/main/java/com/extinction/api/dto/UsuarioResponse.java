package com.extinction.api.dto;

import com.extinction.api.domain.Usuario;
import java.time.Instant;

public record UsuarioResponse(
        Long id,
        String nome,
        String email,
        String userName,
        Instant dataCadastro,
        String bio,
        String fotoUrl
) {
    public static UsuarioResponse from(Usuario usuario) {
        return new UsuarioResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getEmail(),
                usuario.getUserName(),
                usuario.getDataCadastro(),
                usuario.getBio(),
                usuario.getFotoUrl()
        );
    }
}
