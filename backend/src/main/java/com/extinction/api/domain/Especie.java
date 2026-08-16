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

    // Bioma/região usado pra agrupar a enciclopédia em estilo Pokédex regional
    // (Amazônia, Mata Atlântica, Cerrado, Caatinga, Pantanal, Pampa) — distinto
    // do texto livre de `habitat`, que pode citar mais de um bioma/estado.
    // Nullable (não "nullable = false"): num banco já existente (ddl-auto:
    // update), o ALTER TABLE que adiciona essa coluna precisa aceitar as
    // linhas antigas sem valor — o frontend cai num rótulo padrão nesse caso.
    private String regiao;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_especie_atual", nullable = false)
    private StatusEspecieAtual statusEspecieAtual;
}
