package com.extinction.api.repository;

import com.extinction.api.domain.Mensagem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MensagemRepository extends JpaRepository<Mensagem, Long> {

    List<Mensagem> findByConversaIdOrderByDataAsc(Long conversaId);

    Optional<Mensagem> findTopByConversaIdOrderByDataDesc(Long conversaId);
}
