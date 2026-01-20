package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepo extends JpaRepository<User,Long> {
    Optional<User> findByName(String name);

   //List<User> findByStatus(String status);

    boolean existsByEmail(String email);

    Optional<User> findByEmail(String email);

    boolean existsByRole_Name(String roleName);

    @Query("""
       SELECT u FROM User u\s
       WHERE (
            LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%'))
            OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%'))
            OR LOWER(u.role.name) LIKE LOWER(CONCAT('%', :search, '%'))
       )
       AND u.isUserActive = true\s
      \s""")
    Page<User> searchUsers(
            @Param("search") String search,
            Pageable pageable
    );
}
