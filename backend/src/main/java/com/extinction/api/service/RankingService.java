package com.extinction.api.service;

import com.extinction.api.domain.Usuario;
import com.extinction.api.dto.RankingUsuarioResponse;
import com.extinction.api.repository.PostagemRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class RankingService {

    private final PostagemRepository postagemRepository;

    public RankingService(PostagemRepository postagemRepository) {
        this.postagemRepository = postagemRepository;
    }

    public List<RankingUsuarioResponse> listar() {
        return postagemRepository.countPostagensPorUsuario().stream()
                .map(linha -> RankingUsuarioResponse.of((Usuario) linha[0], (Long) linha[1]))
                .toList();
    }
}
