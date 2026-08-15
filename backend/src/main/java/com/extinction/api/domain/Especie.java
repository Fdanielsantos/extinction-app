package com.extinction.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "especie")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Especie {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nome_cientifico", nullable = false)
    private String nomeCientifico;

    @Column(name = "nome_popular", nullable = false)
    private String nomePopular;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    private String habitat;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_especie_atual", nullable = false)
    private StatusEspecieAtual statusEspecieAtual;
}
