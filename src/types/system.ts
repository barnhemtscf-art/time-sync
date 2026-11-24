export type ThemeMode =
  | 'mono-light'
  | 'pastel-sky'
  | 'pastel-mint'
  | 'pastel-peach'
  | 'pastel-lavender'
  | 'pastel-rose';

export function isPastelTheme(theme: ThemeMode): boolean {
  return theme.startsWith('pastel-');
}

export type ShapeMode = 'rounded' | 'square';
export type LangCode = 'th' | 'en';

export type UserRole = 'executive' | 'co_executive' | 'mentor';

export type AuthMethod = 'tap' | 'pin' | 'qr' | 'daily_qr' | 'photo';

export type AttendanceStatus = 'present' | 'late' | 'leave' | 'absent';

export type UnlockMethod =
  | 'pin'
  | 'tap'
  | 'qr'
  | 'daily_qr'
  | 'photo'
  | 'emergency_8888'
  | 'admin_adjust';

export interface StaffUser {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
  orgId: string;
  title?: string;
}

export interface Member {
  id: string;
  name: string;
  group: string; // e.g. 'ทีมพี่โต', 'ทีมน้องเล็ก', or custom via 'อื่นๆ'
  code: string;
  offensePoints: number;
  customUnitScores: Record<string, number>;
  notes?: string;
  active: boolean;
}

export interface ButtonCutoffConfig {
  present?: string; // HH:MM
  late?: string; // HH:MM
  leave?: string; // HH:MM
  absent?: string; // HH:MM
}

export interface TimeTask {
  id: string;
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  descriptionEn: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  daysOfWeek: number[]; // 0 (Sun) - 6 (Sat)
  authMethod: AuthMethod;
  staticQrSecret?: string;
  buttonCutoffs: ButtonCutoffConfig;
  showNameButtonLabel: string; // Customizable show-name button label
  enabled: boolean;
  approvalStatus: 'approved' | 'pending' | 'rejected';
  proposedBy?: string;
  targetGroup: 'all' | 'ทีมพี่โต' | 'ทีมน้องเล็ก' | string;
}

export interface DailyCheckinRecord {
  taskId: string;
  memberId: string;
  status: AttendanceStatus;
  timestamp: string;
  recordedBy: string;
  unlockMethod: UnlockMethod;
  photoDataUrl?: string;
}

export interface AuditLogEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD
  timestamp: string;
  type:
    | 'attendance'
    | 'emergency_unlock'
    | 'offense_adjust'
    | 'daily_reset'
    | 'task_approval'
    | 'lost_found_close'
    | 'file_drop'
    | 'profile_drop';
  taskId?: string;
  taskTitle?: string;
  memberId?: string;
  memberName?: string;
  status?: AttendanceStatus;
  actorName: string;
  unlockMethod?: UnlockMethod;
  note: string;
}

export interface AnnouncementItem {
  id: string;
  titleTh: string;
  titleEn: string;
  bodyTh: string;
  bodyEn: string;
  date: string;
  author: string;
  imageUrl?: string;
}

export interface SecretPollOption {
  id: string;
  text: string;
  votes: number;
}

export interface SecretPoll {
  id: string;
  questionTh: string;
  questionEn: string;
  options: SecretPollOption[];
  votedSessionKeys: string[];
}

export interface DailyDutyItem {
  id: string;
  zoneTh: string;
  zoneEn: string;
  assignees: string[];
  timeLabel: string;
}

export interface KnowledgeArticle {
  id: string;
  titleTh: string;
  titleEn: string;
  summaryTh: string;
  summaryEn: string;
  category: string;
}

export interface GiftExchangeState {
  eventTitleTh: string;
  eventTitleEn: string;
  budgetCap: number;
  imageUrl?: string;
  participants: string[];
  pairs: Array<{ giver: string; receiver: string }>;
}

export interface LostFoundItem {
  id: string;
  type: 'lost' | 'found';
  itemName: string;
  location: string;
  reporterName: string;
  contactNote: string;
  createdAt: string;
  status: 'open' | 'resolved';
  resolvedBy?: string;
}

export interface CustomUnit {
  id: string;
  nameTh: string;
  nameEn: string;
  unitLabel: string;
  active: boolean;
}

export interface CoAdminInvite {
  code: string;
  invitedName: string;
  invitedAt: string;
  accepted: boolean;
}

export type BuiltInBoardModeId =
  | 'announcements'
  | 'poll'
  | 'duties'
  | 'knowledge'
  | 'lostfound'
  | 'gifts';

export type BoardModeIcon =
  | 'bell'
  | 'check'
  | 'calendar'
  | 'book'
  | 'package'
  | 'gift'
  | 'sparkles'
  | 'megaphone'
  | 'clipboard';

export interface BoardModeConfig {
  id: string;
  builtinType?: BuiltInBoardModeId;
  labelTh: string;
  labelEn: string;
  icon: BoardModeIcon;
  enabled: boolean;
  customContentTh?: string;
  customContentEn?: string;
}

export type StorageMode = 'central_14d' | 'google_sheets_gas';

export type FileDropModeId = 'org_edu' | 'biz_event' | 'personal_family' | 'custom';

export interface FileDropAllowedTypes {
  image: boolean;
  text: boolean;
  pdf: boolean;
  excel: boolean;
}

export interface DroppedFileAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  category: 'image' | 'pdf' | 'excel';
  dataUrl?: string;
  driveUrl?: string;
}

export interface FileDropSubmission {
  id: string;
  senderName: string;
  topic: string;
  locationTitle: string;
  modeId: FileDropModeId;
  message?: string;
  files: DroppedFileAttachment[];
  createdAt: string;
  syncedToCentral: boolean;
}

export interface FileDropHubConfig {
  modeId: FileDropModeId;
  customLocationTitle: string;
  customCategoryLabel?: string;
  topic: string;
  sharedPasscode: string;
  allowedTypes: FileDropAllowedTypes;
  submissions: FileDropSubmission[];
  updatedAt?: string;
}

export type ProfileCardKind = 'job_apply' | 'member_update';

export interface ProfileCardSubmission {
  id: string;
  kind: ProfileCardKind;
  fullName: string;
  phoneOrContact: string;
  email?: string;
  targetRoleOrGroup: string;
  headlineOrSummary: string;
  educationOrAffiliation?: string;
  experienceOrNote?: string;
  skills: string[];
  availability?: string;
  emergencyContact?: string;
  photoDataUrl?: string;
  photoDriveUrl?: string;
  createdAt: string;
  syncedToCentral: boolean;
}

export interface ProfileCardFieldConfig {
  showPhoto: boolean;
  showEducation: boolean;
  showExperience: boolean;
  showSkills: boolean;
  showAvailability: boolean;
  showEmergencyContact: boolean;
}

export interface ProfileDropHubConfig {
  enabled: boolean;
  headerTitleTh: string;
  headerTitleEn: string;
  requirePasscode: boolean;
  passcode: string;
  fields: ProfileCardFieldConfig;
  submissions: ProfileCardSubmission[];
}

export type OrgAccountMode = 'org_2tier' | 'foundation_3tier' | 'file_drop';

export interface TenantData {
  orgId: string;
  orgNameTh: string;
  orgNameEn: string;
  orgAccountMode?: OrgAccountMode;
  orgCategory?: string;
  ownerEmail?: string;
  strictFieldAuth?: boolean;
  retentionDays?: number;
  emergencyCode: string; // '8888'
  storageMode: StorageMode;
  gasWebAppUrl: string;
  lastResetDateKey: string;
  staff: StaffUser[];
  members: Member[];
  tasks: TimeTask[];
  todayCheckins: DailyCheckinRecord[];
  logs: AuditLogEntry[];
  boardModes?: BoardModeConfig[];
  fileDropHub?: FileDropHubConfig;
  profileHub?: ProfileDropHubConfig;
  announcements: AnnouncementItem[];
  poll: SecretPoll;
  duties: DailyDutyItem[];
  knowledge: KnowledgeArticle[];
  giftExchange: GiftExchangeState;
  lostFound: LostFoundItem[];
  customUnits: CustomUnit[];
  coAdminInvites: CoAdminInvite[];
}
