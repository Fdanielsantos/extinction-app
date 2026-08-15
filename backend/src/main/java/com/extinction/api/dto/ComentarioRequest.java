package com.extinction.api.dto;

import jakarta.validation.constraints.NotBlank;

public record ComentarioRequest(
        @NotBlank String descricao
) {
}
