package com.extinction.api.repository;

import com.extinction.api.domain.Seguida;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeguidaRepository extends JpaRepository<Seguida, Long> {

    Optional<Seguida> findBySeguidorIdAndSeguidoId(Long seguidorId, Long seguidoId);

    boolean existsBySeguidorIdAndSeguidoId(Long seguidorId, Long seguidoId);

    long countBySeguidoId(Long seguidoId);

    long countBySeguidorId(Long seguidorId);
}
