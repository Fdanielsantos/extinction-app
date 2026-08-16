package com.extinction.api.service;

import com.extinction.api.domain.Comentario;
import com.extinction.api.domain.Especie;
import com.extinction.api.domain.Localidade;
import com.extinction.api.domain.Postagem;
import com.extinction.api.domain.Usuario;
import com.extinction.api.dto.ComentarioResponse;
import com.extinction.api.dto.PostagemResponse;
import com.extinction.api.exception.ApiException;
import com.extinction.api.repository.ComentarioRepository;
import com.extinction.api.repository.EspecieRepository;
import com.extinction.api.repository.PostagemRepository;
import com.extinction.api.storage.FileStorageService;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@Service
public class PostagemService {

    private final PostagemRepository postagemRepository;
    private final EspecieRepository especieRepository;
    private final ComentarioRepository comentarioRepository;
    private final FileStorageService fileStorageService;

    public PostagemService(
            PostagemRepository postagemRepository,
            EspecieRepository especieRepository,
            ComentarioRepository comentarioRepository,
            FileStorageService fileStorageService
    ) {
        this.postagemRepository = postagemRepository;
        this.especieRepository = especieRepository;
        this.comentarioRepository = comentarioRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional(readOnly = true)
    public List<PostagemResponse> listarFeed(Usuario usuarioLogado) {
        return postagemRepository.findAllOrderByDataDesc().stream()
                .map(postagem -> PostagemResponse.from(postagem, usuarioLogado))
                .toList();
    }

    @Transactional
    public PostagemResponse criar(
            Usuario usuarioLogado,
            List<MultipartFile> fotos,
            String legenda,
            List<Long> especieIds,
            Double latitude,
            Double longitude
    ) {
        List<Especie> especies = especieRepository.findAllById(especieIds);
        if (especies.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Selecione ao menos uma espécie válida.");
        }
        if (fotos == null || fotos.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Envie ao menos uma foto do avistamento.");
        }

        List<String> fotoUrls = fotos.stream().map(this::salvarESerializarUrl).toList();

        Localidade localidade = (latitude != null && longitude != null)
                ? Localidade.builder().latitude(latitude).longitude(longitude).build()
                : null;

        Postagem postagem = Postagem.builder()
                .usuario(usuarioLogado)
                .fotoUrls(fotoUrls)
                .legenda(legenda)
                .data(Instant.now())
                .localidade(localidade)
                .especies(new HashSet<>(especies))
                .build();

        postagem = postagemRepository.save(postagem);
        return PostagemResponse.from(postagem, usuarioLogado);
    }

    private String salvarESerializarUrl(MultipartFile foto) {
        String nomeArquivo = fileStorageService.salvar(foto);
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/uploads/")
                .path(nomeArquivo)
                .toUriString();
    }

    @Transactional
    public PostagemResponse curtir(Long postagemId, Usuario usuarioLogado) {
        Postagem postagem = postagemRepository.findById(postagemId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postagem não encontrada."));

        boolean jaCurtiu = postagem.getCurtidasPor().stream()
                .anyMatch(u -> u.getId().equals(usuarioLogado.getId()));
        if (jaCurtiu) {
            postagem.getCurtidasPor().removeIf(u -> u.getId().equals(usuarioLogado.getId()));
        } else {
            postagem.getCurtidasPor().add(usuarioLogado);
        }

        postagem = postagemRepository.save(postagem);
        return PostagemResponse.from(postagem, usuarioLogado);
    }

    @Transactional
    public ComentarioResponse comentar(Long postagemId, Usuario usuarioLogado, String descricao) {
        Postagem postagem = postagemRepository.findById(postagemId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postagem não encontrada."));

        Comentario comentario = Comentario.builder()
                .postagem(postagem)
                .usuario(usuarioLogado)
                .descricao(descricao)
                .data(Instant.now())
                .build();
        // Salva pelo próprio repositório (persist, não merge) — garante que o id
        // gerado (IDENTITY) volte para este objeto imediatamente.
        comentario = comentarioRepository.save(comentario);

        return ComentarioResponse.from(comentario);
    }
}
