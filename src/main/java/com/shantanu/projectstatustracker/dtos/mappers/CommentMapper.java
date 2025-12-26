package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.CommentResponseDTO;
import com.shantanu.projectstatustracker.models.Comment;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface CommentMapper {

    @Mapping(source = "user.userId",target = "userId")
    @Mapping(source = "user.name",target = "authorName")
    CommentResponseDTO mapCommentToResponse(Comment comment);

    @Mapping(source = "user.userId",target = "userId")
    @Mapping(source = "user.name",target = "authorName")
    List<CommentResponseDTO> mapCommentsToResponse(List<Comment> comments);

}
