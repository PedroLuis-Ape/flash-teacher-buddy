// Re-export from canonical location (classroom feature)
export {
  useClassGoals,
  useCreateClassGoal,
  useDeleteClassGoal,
  useSubmitClassGoalAssignment,
  useReviewClassGoalAssignment,
  useMyClassGoalAssignments,
} from '@/features/classroom/hooks/useClassGoals';
export type { ClassGoal, ClassGoalTarget, ClassGoalAssignment } from '@/features/classroom/hooks/useClassGoals';
