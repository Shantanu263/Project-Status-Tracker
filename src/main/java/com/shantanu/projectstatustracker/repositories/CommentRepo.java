package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Comment;
import com.shantanu.projectstatustracker.models.ParentType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepo extends JpaRepository<Comment,Long> {

    List<Comment> findByParentIdAndParentTypeOrderByCreatedAtAsc(Long parentId, ParentType parentType);

}
