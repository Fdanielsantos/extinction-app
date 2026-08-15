package com.extinction.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Embutida em Postagem — sem tabela própria por enquanto. Coordenadas simples
 * (Double), sem tipo espacial/índice dedicado (fica para quando o domínio de
 * localidade for modelado à parte, ver README do backend).
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Localidade {

    private Double latitude;

    private Double longitude;

    private String estado;

    @Column(name = "cidade")
    private String cidade;
}
