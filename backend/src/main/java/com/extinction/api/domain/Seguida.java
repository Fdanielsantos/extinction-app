package com.extinction.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Relação de "seguir" entre dois usuários (RF: seguir outros usuários).
 * Modelada como entidade própria (em vez de um Set<Usuario> auto-relacionado
 * em Usuario) pra evitar carregar a coleção de seguidores/seguindo toda vez
 * que um Usuario é carregado (ex.: a cada request autenticada).
 */
@Entity
@Table(name = "seguida", uniqueConstraints = @UniqueConstraint(columnNames = { "seguidor_id", "seguido_id" }))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Seguida {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seguidor_id", nullable = false)
    private Usuario seguidor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seguido_id", nullable = false)
    private Usuario seguido;

    @Column(nullable = false)
    private Instant data;
}
