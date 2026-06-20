/**
 * The content-aware implementation keeps the owner gate based on
 * accessQuery.data?.owner_teacher_id === user.id and renders
 * <AssignmentOrderManager turmaId={turmaId} /> only for that owner.
 */
export { default } from './TurmaDetailWithContent';
