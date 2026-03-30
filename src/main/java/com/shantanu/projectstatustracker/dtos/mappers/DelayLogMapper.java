package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.DelayLogRequestDTO;
import com.shantanu.projectstatustracker.dtos.DelayLogResponseDTO;
import com.shantanu.projectstatustracker.models.DelayLog;

import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "spring")
public interface DelayLogMapper {

    @Mapping(source = "delayLog.id", target = "delayLogId")
    DelayLogResponseDTO mapDelayLogToResponseDTO(DelayLog delayLog);

    List<DelayLogResponseDTO> mapDelayLogsToResponseDTOs(List<DelayLog> delayLogs);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateDelayLogFromDTO(DelayLogRequestDTO delayLogRequestDTO, @MappingTarget DelayLog delayLog);

    @Mapping(source = "delayLogRequestDTO.projectId" ,target = "projectId")
    @Mapping(source = "delayLogRequestDTO.phaseId" ,target = "phaseId")
    @Mapping(source = "delayLogRequestDTO.taskId" ,target = "taskId")
    @Mapping(source = "delayLogRequestDTO.entityType" ,target = "entityType")
    @Mapping(source = "delayLogRequestDTO.originalEndDate" ,target = "originalEndDate")
    @Mapping(source = "delayLogRequestDTO.revisedEndDate" ,target = "revisedEndDate")
    @Mapping(source = "delayLogRequestDTO.status" ,target = "status")
    @Mapping(source = "delayLogRequestDTO.reason" ,target = "reason")
    DelayLog mapDelayLogRequestDTOToDelayLog(DelayLogRequestDTO delayLogRequestDTO);

    List<DelayLog> mapDelayLogRequestDTOSToDelayLogs(List<DelayLogRequestDTO> delayLogRequestDTOS);
}
