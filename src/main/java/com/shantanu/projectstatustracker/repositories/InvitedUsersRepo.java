package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.InvitedUsers;
import com.shantanu.projectstatustracker.models.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InvitedUsersRepo extends JpaRepository<InvitedUsers, Long> {

    boolean existsByEmail(String email);

    InvitedUsers findByEmail(String email);
}
