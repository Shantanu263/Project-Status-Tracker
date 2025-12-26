package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.ActivityLogDTO;
import com.shantanu.projectstatustracker.models.ActivityLog;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface ActivityLogMapper {

    @Mapping(source = "activityLog.project.projectId", target = "projectId")
    @Mapping(source = "activityLog.performedBy.userId", target = "userId")
    @Mapping(source = "activityLog.entityId", target = "entityId")
    ActivityLogDTO mapActivityLogToResponse(ActivityLog activityLog);

    List<ActivityLogDTO> mapActivityLogsToResponse(List<ActivityLog> activityLogs);

}
