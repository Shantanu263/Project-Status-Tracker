package com.shantanu.projectstatustracker.services;

import java.sql.Timestamp;

public interface ActivityLogService {
    void log(Long projectId, String email, String message);

    default String timeAgo(Timestamp ts) {
        long diff = (System.currentTimeMillis() - ts.getTime()) / 1000;

        if (diff < 60) return diff==1?"1 second ago":diff + " seconds ago";
        diff /= 60;

        if (diff < 60) return diff==1?"1 minute ago":diff + " minutes ago";
        diff /= 60;

        if (diff < 24) return diff==1?"1 hour ago":diff + " hours ago";
        diff /= 24;

        return diff + " days ago";
    }

}
