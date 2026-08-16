package com.extinction.api.repository;

import com.extinction.api.domain.Usuario;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByUserName(String userName);

    List<Usuario> findByIdNotOrderByNomeAsc(Long idUsuarioLogado);
}
