package com.extinction.api.dto;

public record PredicaoEspecieResponse(
        EspecieResponse especie,
        double confiancaPercentual
) {
}
