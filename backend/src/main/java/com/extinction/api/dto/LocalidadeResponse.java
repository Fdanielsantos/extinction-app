package com.extinction.api.dto;

import com.extinction.api.domain.Localidade;

public record LocalidadeResponse(
        Long id,
        Double latitude,
        Double longitude,
        String estado,
        String cidade
) {
    /** Localidade não tem tabela própria — usa o id da postagem que a contém. */
    public static LocalidadeResponse from(Long postagemId, Localidade localidade) {
        if (localidade == null || localidade.getLatitude() == null || localidade.getLongitude() == null) {
            return null;
        }
        return new LocalidadeResponse(
                postagemId,
                localidade.getLatitude(),
                localidade.getLongitude(),
                localidade.getEstado(),
                localidade.getCidade()
        );
    }
}
