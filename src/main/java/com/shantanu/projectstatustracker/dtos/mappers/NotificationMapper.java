package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.NotificationResponseDTO;
import com.shantanu.projectstatustracker.models.Notification;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface NotificationMapper {

    @Mapping(source = "notification.user.userId",target = "userId")
    @Mapping(source = "notification.projectId",target = "projectId")
    NotificationResponseDTO mapNotificationToResponse(Notification notification);

    List<NotificationResponseDTO> mapNotificationsToResponse(List<Notification> notifications);
}
