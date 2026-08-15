package com.extinction.api.repository;

import com.extinction.api.domain.Especie;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EspecieRepository extends JpaRepository<Especie, Long> {

    Optional<Especie> findByNomeCientifico(String nomeCientifico);
}
