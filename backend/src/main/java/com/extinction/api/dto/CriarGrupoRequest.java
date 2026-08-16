package com.extinction.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record CriarGrupoRequest(
        @NotBlank String nome,
        @NotEmpty List<Long> participanteIds
) {
}
