package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.exceptions.SchedulingConstraintException;
import com.shantanu.projectstatustracker.models.DependencyType;
import com.shantanu.projectstatustracker.models.Schedulable;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;

@Component
public class DependencyEngine<T extends Schedulable> {

    private LocalDate toLocalDate(Date date) {
        return date.toInstant()
                .atZone(ZoneId.systemDefault())
                .toLocalDate();
    }

    private Date toDate(LocalDate localDate) {
        return Date.from(localDate
                .atStartOfDay(ZoneId.systemDefault())
                .toInstant());
    }

    // -------------------------------------------------------------------------
    // Cycle detection
    // -------------------------------------------------------------------------

    public boolean createsCycle(
            T predecessor,
            T successor,
            Function<T, List<T>> getSuccessors) {
        return isReachable(successor, predecessor, getSuccessors);
    }

    private boolean isReachable(
            T start,
            T target,
            Function<T, List<T>> getSuccessors) {

        Set<Long> visited = new HashSet<>();
        Stack<T> stack = new Stack<>();
        stack.push(start);

        while (!stack.isEmpty()) {
            T current = stack.pop();
            if (current.getId().equals(target.getId())) {
                return true;
            }
            if (!visited.contains(current.getId())) {
                visited.add(current.getId());
                stack.addAll(getSuccessors.apply(current));
            }
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Constraint check – throws SchedulingConstraintException on violation.
    // Call this when the user MANUALLY sets dates (update phase/task).
    // -------------------------------------------------------------------------

    /**
     * Validates that the successor's dates respect the dependency constraint
     * imposed by the predecessor. Throws {@link SchedulingConstraintException}
     * if the constraint is violated.
     */
    public void checkConstraint(T predecessor, T successor, DependencyType dependencyType) {
        LocalDate predStart = toLocalDate(predecessor.getStartDate());
        LocalDate predEnd   = toLocalDate(predecessor.getEndDate());
        LocalDate succStart = toLocalDate(successor.getStartDate());
        LocalDate succEnd   = toLocalDate(successor.getEndDate());

        switch (dependencyType) {
            case FS:
                // successor start must be >= predecessor end
                if (succStart.isBefore(predEnd)) {
                    throw new SchedulingConstraintException(
                            "Scheduling constraint violated (Finish-to-Start): " +
                            "Successor start date (" + succStart + ") cannot be before " +
                            "predecessor end date (" + predEnd + ").");
                }
                break;

            case SS:
                // successor start must be >= predecessor start
                if (succStart.isBefore(predStart)) {
                    throw new SchedulingConstraintException(
                            "Scheduling constraint violated (Start-to-Start): " +
                            "Successor start date (" + succStart + ") cannot be before " +
                            "predecessor start date (" + predStart + ").");
                }
                break;

            case FF:
                // successor end must be >= predecessor end
                if (succEnd.isBefore(predEnd)) {
                    throw new SchedulingConstraintException(
                            "Scheduling constraint violated (Finish-to-Finish): " +
                            "Successor end date (" + succEnd + ") cannot be before " +
                            "predecessor end date (" + predEnd + ").");
                }
                break;

            case SF:
                // successor end must be >= predecessor start
                if (succEnd.isBefore(predStart)) {
                    throw new SchedulingConstraintException(
                            "Scheduling constraint violated (Start-to-Finish): " +
                            "Successor end date (" + succEnd + ") cannot be before " +
                            "predecessor start date (" + predStart + ").");
                }
                break;
        }
    }

    // -------------------------------------------------------------------------
    // Conditional adjustment – shifts successor only if the constraint is now
    // violated due to a change in the predecessor's dates. Duration is preserved.
    // Used when the predecessor is updated (propagation).
    // -------------------------------------------------------------------------

    /**
     * If the predecessor's new dates now violate the constraint for this successor,
     * shift the successor so that the constraint is just satisfied while keeping
     * its original duration intact.
     *
     * @return true if the successor's dates were actually changed.
     */
    public boolean adjustDatesIfNeeded(T predecessor, T successor, DependencyType dependencyType) {
        LocalDate predStart = toLocalDate(predecessor.getStartDate());
        LocalDate predEnd   = toLocalDate(predecessor.getEndDate());
        LocalDate succStart = toLocalDate(successor.getStartDate());
        LocalDate succEnd   = toLocalDate(successor.getEndDate());
        long duration = ChronoUnit.DAYS.between(succStart, succEnd);

        switch (dependencyType) {
            case FS: {
                // Constraint: succStart >= predEnd
                // If predEnd is pushed beyond succStart, shift successor forward
                if (predEnd.isAfter(succStart)) {
                    LocalDate newStart = predEnd.plusDays(1);
                    LocalDate newEnd   = newStart.plusDays(duration);
                    successor.setStartDate(toDate(newStart));
                    successor.setEndDate(toDate(newEnd));
                    return true;
                }
                break;
            }
            case SS: {
                // Constraint: succStart >= predStart
                // If predStart is pushed beyond succStart, shift successor forward
                if (predStart.isAfter(succStart)) {
                    LocalDate newStart = predStart;
                    LocalDate newEnd   = newStart.plusDays(duration);
                    successor.setStartDate(toDate(newStart));
                    successor.setEndDate(toDate(newEnd));
                    return true;
                }
                break;
            }
            case FF: {
                // Constraint: succEnd >= predEnd
                // If predEnd is pushed beyond succEnd, shift successor forward
                if (predEnd.isAfter(succEnd)) {
                    LocalDate newEnd   = predEnd;
                    LocalDate newStart = newEnd.minusDays(duration);
                    successor.setStartDate(toDate(newStart));
                    successor.setEndDate(toDate(newEnd));
                    return true;
                }
                break;
            }
            case SF: {
                // Constraint: succEnd >= predStart
                // If predStart is pushed beyond succEnd, shift successor forward
                if (predStart.isAfter(succEnd)) {
                    LocalDate newEnd   = predStart.minusDays(1);
                    LocalDate newStart = newEnd.minusDays(duration);
                    successor.setStartDate(toDate(newStart));
                    successor.setEndDate(toDate(newEnd));
                    return true;
                }
                break;
            }
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Conditional alignment – only shifts successor when its current dates
    // already violate the new constraint. Duration is preserved.
    // Used when CREATING a new dependency or CHANGING its type.
    // -------------------------------------------------------------------------

    /**
     * Aligns the successor's dates so that they satisfy the constraint, but only
     * if the constraint is currently violated. Duration is preserved.
     * Used when a new dependency is created or its type is changed.
     * <p>
     * Unlike {@link #adjustDatesIfNeeded}, this does not return a boolean; it is
     * called in contexts where we don't need to track whether a change occurred.
     */
    public void adjustDates(T predecessor, T successor, DependencyType dependencyType) {
        LocalDate predStart = toLocalDate(predecessor.getStartDate());
        LocalDate predEnd   = toLocalDate(predecessor.getEndDate());
        LocalDate succStart = toLocalDate(successor.getStartDate());
        LocalDate succEnd   = toLocalDate(successor.getEndDate());
        long duration = ChronoUnit.DAYS.between(succStart, succEnd);

        switch (dependencyType) {
            case FS: {
                // Constraint: succStart >= predEnd
                // Only shift forward if violated (succStart is before predEnd)
                if (succStart.isBefore(predEnd)) {
                    LocalDate newStart = predEnd.plusDays(1);
                    LocalDate newEnd   = newStart.plusDays(duration);
                    successor.setStartDate(toDate(newStart));
                    successor.setEndDate(toDate(newEnd));
                }
                break;
            }
            case SS: {
                // Constraint: succStart >= predStart
                // Only shift forward if violated (succStart is before predStart)
                if (succStart.isBefore(predStart)) {
                    LocalDate newStart = predStart;
                    LocalDate newEnd   = newStart.plusDays(duration);
                    successor.setStartDate(toDate(newStart));
                    successor.setEndDate(toDate(newEnd));
                }
                break;
            }
            case FF: {
                // Constraint: succEnd >= predEnd
                // Only shift forward if violated (succEnd is before predEnd)
                if (succEnd.isBefore(predEnd)) {
                    LocalDate newEnd   = predEnd;
                    LocalDate newStart = newEnd.minusDays(duration);
                    successor.setStartDate(toDate(newStart));
                    successor.setEndDate(toDate(newEnd));
                }
                break;
            }
            case SF: {
                // Constraint: succEnd >= predStart
                // Only shift forward if violated (succEnd is before predStart)
                if (succEnd.isBefore(predStart)) {
                    LocalDate newEnd   = predStart.minusDays(1);
                    LocalDate newStart = newEnd.minusDays(duration);
                    successor.setStartDate(toDate(newStart));
                    successor.setEndDate(toDate(newEnd));
                }
                break;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Propagation – after a predecessor is updated, propagate adjustments
    // transitively through all successors.
    // -------------------------------------------------------------------------

    /**
     * Propagates date adjustments transitively from {@code item} through all its
     * successors. Only shifts a successor when the constraint is actually violated.
     *
     * @param item              The item whose dates have just changed.
     * @param getDependencies   Returns all outgoing dependency entries for an item,
     *                          where each entry provides both the successor and the
     *                          dependency type.
     * @param saveFunction      Persists a modified successor.
     */
    public <D> void propagateAdjustments(
            T item,
            Function<T, List<D>> getDependencies,
            BiFunction<D, T, T> getSuccessorFromDep,
            BiFunction<D, T, DependencyType> getDependencyType,
            Consumer<T> saveFunction) {

        List<D> deps = getDependencies.apply(item);
        for (D dep : deps) {
            T successor = getSuccessorFromDep.apply(dep, item);
            DependencyType depType = getDependencyType.apply(dep, item);
            boolean changed = adjustDatesIfNeeded(item, successor, depType);
            if (changed) {
                saveFunction.accept(successor);
                // Recurse: successor's dates changed, propagate further
                propagateAdjustments(successor, getDependencies, getSuccessorFromDep, getDependencyType, saveFunction);
            }
        }
    }

    /**
     * @deprecated Use {@link #propagateAdjustments} for proper per-dependency-type propagation.
     */
    @Deprecated
    public void propagateDelay(
            T item,
            Function<T, List<T>> getSuccessors,
            Consumer<T> saveFunction,
            DependencyType dependencyType) {

        List<T> successors = getSuccessors.apply(item);
        for (T successor : successors) {
            adjustDates(item, successor, dependencyType);
            saveFunction.accept(successor);
            propagateDelay(successor, getSuccessors, saveFunction, dependencyType);
        }
    }
}
