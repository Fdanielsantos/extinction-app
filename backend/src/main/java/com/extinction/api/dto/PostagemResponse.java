package com.extinction.api.dto;

import com.extinction.api.domain.Postagem;
import com.extinction.api.domain.Usuario;
import java.time.Instant;
import java.util.List;

public record PostagemResponse(
        Long id,
        Long idPerfil,
        String autorNome,
        String fotoUrl,
        String legenda,
        Instant data,
        LocalidadeResponse localidade,
        List<EspecieResponse> especies,
        int curtidas,
        boolean curtidoPeloUsuario,
        List<ComentarioResponse> comentarios
) {
    public static PostagemResponse from(Postagem postagem, Usuario usuarioLogado) {
        return new PostagemResponse(
                postagem.getId(),
                postagem.getUsuario().getId(),
                postagem.getUsuario().getNome(),
                postagem.getFotoUrl(),
                postagem.getLegenda(),
                postagem.getData(),
                LocalidadeResponse.from(postagem.getId(), postagem.getLocalidade()),
                postagem.getEspecies().stream().map(EspecieResponse::from).toList(),
                postagem.getCurtidasPor().size(),
                postagem.getCurtidasPor().stream().anyMatch(u -> u.getId().equals(usuarioLogado.getId())),
                postagem.getComentarios().stream().map(ComentarioResponse::from).toList()
        );
    }
}
