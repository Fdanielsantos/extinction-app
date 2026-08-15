package com.extinction.api.dto;

import com.extinction.api.domain.Especie;
import com.extinction.api.domain.StatusEspecieAtual;

public record EspecieResponse(
        Long id,
        String nomeCientifico,
        String nomePopular,
        String descricao,
        String habitat,
        StatusEspecieAtual statusEspecieAtual
) {
    public static EspecieResponse from(Especie especie) {
        return new EspecieResponse(
                especie.getId(),
                especie.getNomeCientifico(),
                especie.getNomePopular(),
                especie.getDescricao(),
                especie.getHabitat(),
                especie.getStatusEspecieAtual()
        );
    }
}
