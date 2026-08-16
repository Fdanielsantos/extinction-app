package com.extinction.api.repository;

import com.extinction.api.domain.Conversa;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConversaRepository extends JpaRepository<Conversa, Long> {

    List<Conversa> findByParticipantes_Id(Long usuarioId);

    @Query("""
            SELECT c FROM Conversa c
            JOIN c.participantes p1
            JOIN c.participantes p2
            WHERE c.tipo = com.extinction.api.domain.TipoConversa.DIRETA
              AND p1.id = :usuarioId1 AND p2.id = :usuarioId2
            """)
    Optional<Conversa> buscarConversaDireta(@Param("usuarioId1") Long usuarioId1, @Param("usuarioId2") Long usuarioId2);
}
