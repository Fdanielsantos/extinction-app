package com.extinction.api.dto;

public record AuthResponse(
        String token,
        UsuarioResponse usuario
) {
}
