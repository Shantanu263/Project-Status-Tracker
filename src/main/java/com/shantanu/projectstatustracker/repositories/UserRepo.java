package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepo extends JpaRepository<User,Long> {
    Optional<User> findByName(String name);

   List<User> findByStatus(String status);

    boolean existsByEmail(String email);

    Optional<User> findByEmail(String email);

    boolean existsByRole_Name(String roleName);
}
