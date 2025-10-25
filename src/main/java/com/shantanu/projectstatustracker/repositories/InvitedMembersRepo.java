package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.InvitedMembers;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InvitedMembersRepo extends JpaRepository<InvitedMembers,Long> {
    boolean existsByEmail(String email);

    List<InvitedMembers> findAllByEmail(String email);
}
