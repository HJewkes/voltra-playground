/**
 * Analytics Components
 *
 * Data visualization and history components.
 */

// Charts
export { ForceCurveChart, VelocityTrendChart, BarChart, HorizontalBarChart, TrainingLoadGauge, RepCurveChart, SetCurveChart, SIGNAL_OPTIONS } from './charts';
export type { ChartSignal } from './charts';

// Dashboard
export { VolumeTrendCard, MuscleDistributionCard, TrainingLoadCard, PRTimelineCard, ExerciseFrequencyCard } from './dashboard';

// History
export { WorkoutListItem, WorkoutDetailModal, AggregateStats } from './history';

// Calendar
export { CalendarGrid, DayDetail, WeeklyVolumeCard } from './calendar';

// Direct exports
export { RepHistoryTable } from './RepHistoryTable';
export { SetSummaryModal } from './SetSummaryModal';
