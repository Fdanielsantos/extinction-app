package com.extinction.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * RF: chats diretos e em grupo entre usuários. Uma conversa DIRETA sempre tem
 * exatamente 2 participantes (criada/reaproveitada via
 * {@link com.extinction.api.service.ConversaService#obterOuCriarDireta}); uma
 * GRUPO tem nome próprio e 2+ participantes.
 */
@Entity
@Table(name = "conversa")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Conversa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoConversa tipo;

    /** Só preenchido pra conversas em GRUPO. */
    private String nome;

    @Column(name = "criada_em", nullable = false)
    private Instant criadaEm;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "conversa_participante",
            joinColumns = @JoinColumn(name = "conversa_id"),
            inverseJoinColumns = @JoinColumn(name = "usuario_id"))
    @Builder.Default
    private Set<Usuario> participantes = new HashSet<>();
}
