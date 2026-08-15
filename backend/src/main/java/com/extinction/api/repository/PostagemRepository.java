package com.extinction.api.repository;

import com.extinction.api.domain.Postagem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PostagemRepository extends JpaRepository<Postagem, Long> {

    @Query("SELECT p FROM Postagem p ORDER BY p.data DESC")
    List<Postagem> findAllOrderByDataDesc();

    @Query("SELECT p.usuario, COUNT(p) FROM Postagem p GROUP BY p.usuario ORDER BY COUNT(p) DESC")
    List<Object[]> countPostagensPorUsuario();
}
