package com.extinction.api.dto;

import com.extinction.api.domain.Usuario;
import java.time.Instant;

public record UsuarioResponse(
        Long id,
        String nome,
        String email,
        String userName,
        Instant dataCadastro
) {
    public static UsuarioResponse from(Usuario usuario) {
        return new UsuarioResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getEmail(),
                usuario.getUserName(),
                usuario.getDataCadastro()
        );
    }
}
