package com.extinction.api.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "postagem")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Postagem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    // Lista ordenada de fotos da postagem (RF: múltiplas fotos por avistamento) —
    // era um único `fotoUrl`; virou coleção pra permitir mais de uma imagem.
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "postagem_foto", joinColumns = @JoinColumn(name = "postagem_id"))
    @OrderColumn(name = "ordem")
    @Column(name = "foto_url", nullable = false, length = 1024)
    @Builder.Default
    private List<String> fotoUrls = new java.util.ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String legenda;

    @Column(nullable = false)
    private Instant data;

    @Embedded
    private Localidade localidade;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "postagem_especie",
            joinColumns = @JoinColumn(name = "postagem_id"),
            inverseJoinColumns = @JoinColumn(name = "especie_id"))
    @Builder.Default
    private Set<Especie> especies = new HashSet<>();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "postagem_curtida",
            joinColumns = @JoinColumn(name = "postagem_id"),
            inverseJoinColumns = @JoinColumn(name = "usuario_id"))
    @Builder.Default
    private Set<Usuario> curtidasPor = new HashSet<>();

    @OneToMany(mappedBy = "postagem", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("data ASC")
    @Builder.Default
    private List<Comentario> comentarios = new java.util.ArrayList<>();
}
