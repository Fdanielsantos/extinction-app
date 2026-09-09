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

    private static final int SUGESTAO_ESPECIE_TAMANHO_MAXIMO = 150;

    @Transactional
    public PostagemResponse criar(
            Usuario usuarioLogado,
            List<MultipartFile> fotos,
            String legenda,
            List<Long> especieIds,
            String sugestaoEspecie,
            Double latitude,
            Double longitude,
            String cidade,
            String estado
    ) {
        List<Especie> especies = (especieIds == null || especieIds.isEmpty())
                ? List.of()
                : especieRepository.findAllById(especieIds);

        // RN-004 (revisada): quando o BioCLIP não retorna nenhuma candidata acima do
        // limiar de confiança, o usuário pode digitar sua própria sugestão em vez de
        // ficar bloqueado. Espécie confirmada (vinda da identificação/catálogo) tem
        // prioridade sobre a sugestão em texto -- se ambas vierem preenchidas, a
        // sugestão é descartada (mutuamente exclusivas na Postagem).
        String sugestao = normalizarSugestao(sugestaoEspecie);
        if (!especies.isEmpty()) {
            sugestao = null;
        }

        if (especies.isEmpty() && sugestao == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Selecione uma espécie identificada ou informe sua sugestão de espécie.");
        }
        if (fotos == null || fotos.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Envie ao menos uma foto do avistamento.");
        }

        List<String> fotoUrls = fotos.stream().map(this::salvarESerializarUrl).toList();

        Localidade localidade = (latitude != null && longitude != null)
                ? Localidade.builder().latitude(latitude).longitude(longitude).cidade(cidade).estado(estado).build()
                : null;

        Postagem postagem = Postagem.builder()
                .usuario(usuarioLogado)
                .fotoUrls(fotoUrls)
                .legenda(legenda)
                .data(Instant.now())
                .localidade(localidade)
                .especies(new HashSet<>(especies))
                .sugestaoEspecieUsuario(sugestao)
                .build();

        postagem = postagemRepository.save(postagem);
        return PostagemResponse.from(postagem, usuarioLogado);
    }

    private String normalizarSugestao(String sugestaoEspecie) {
        if (sugestaoEspecie == null || sugestaoEspecie.isBlank()) {
            return null;
        }
        String sugestao = sugestaoEspecie.trim();
        if (sugestao.length() > SUGESTAO_ESPECIE_TAMANHO_MAXIMO) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "A sugestão de espécie deve ter no máximo " + SUGESTAO_ESPECIE_TAMANHO_MAXIMO + " caracteres.");
        }
        return sugestao;
    }

    private String salvarESerializarUrl(MultipartFile foto) {
        String nomeArquivo = fileStorageService.salvar(foto);
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/uploads/")
                .path(nomeArquivo)
                .toUriString();
    }

    @Transactional
    public void excluir(Long postagemId, Usuario usuarioLogado) {
        Postagem postagem = postagemRepository.findById(postagemId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Postagem não encontrada."));

        if (!postagem.getUsuario().getId().equals(usuarioLogado.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Você só pode excluir suas próprias postagens.");
        }

        postagemRepository.delete(postagem);
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

    private Comentario buscarComentario(Long postagemId, Long comentarioId) {
        Comentario comentario = comentarioRepository.findById(comentarioId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Comentário não encontrado."));
        if (!comentario.getPostagem().getId().equals(postagemId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Comentário não encontrado.");
        }
        return comentario;
    }

    @Transactional
    public ComentarioResponse editarComentario(
            Long postagemId, Long comentarioId, Usuario usuarioLogado, String descricao
    ) {
        Comentario comentario = buscarComentario(postagemId, comentarioId);
        // Só o autor edita o próprio comentário -- diferente da exclusão, o dono da
        // postagem não pode alterar o texto de um comentário alheio (moderação é
        // "remover", não "reescrever").
        if (!comentario.getUsuario().getId().equals(usuarioLogado.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Você só pode editar seus próprios comentários.");
        }
        comentario.setDescricao(descricao);
        comentario = comentarioRepository.save(comentario);
        return ComentarioResponse.from(comentario);
    }

    @Transactional
    public void excluirComentario(Long postagemId, Long comentarioId, Usuario usuarioLogado) {
        Comentario comentario = buscarComentario(postagemId, comentarioId);
        boolean ehAutorDoComentario = comentario.getUsuario().getId().equals(usuarioLogado.getId());
        boolean ehAutorDaPostagem = comentario.getPostagem().getUsuario().getId().equals(usuarioLogado.getId());
        // Exclusão é permitida a quem escreveu o comentário OU a quem é dono da
        // postagem (moderação dos próprios comentários recebidos).
        if (!ehAutorDoComentario && !ehAutorDaPostagem) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Você não pode excluir este comentário.");
        }
        comentarioRepository.delete(comentario);
    }
}
