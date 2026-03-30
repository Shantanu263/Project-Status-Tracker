package com.shantanu.projectstatustracker.models;

import java.util.Date;

public interface Schedulable {

    Long getId();

    Date getStartDate();
    Date getEndDate();

    void setStartDate(Date startDate);
    void setEndDate(Date endDate);

}
