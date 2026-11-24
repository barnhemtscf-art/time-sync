import type {
  FileDropAllowedTypes,
  FileDropHubConfig,
  FileDropModeId,
  LangCode,
} from '../types/system';

export interface FileDropModeMeta {
  id: FileDropModeId;
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
  placeholderTh: string;
  placeholderEn: string;
}

export const FILE_DROP_MODES: FileDropModeMeta[] = [
  {
    id: 'org_edu',
    titleTh: 'องค์กรและการศึกษา',
    titleEn: 'Organization & Education',
    descTh: 'สำหรับโรงเรียน มหาวิทยาลัย ชมรม มูลนิธิ หรือทีมงานที่รวมเอกสาร/กิจกรรมเป็นระบบ',
    descEn: 'For schools, universities, clubs, foundations, or teams organizing documents systematically',
    placeholderTh: 'เช่น โรงเรียนอนุบาลเดือนฉาย',
    placeholderEn: 'e.g. Duanchai Kindergarten / Rainbow Foundation',
  },
  {
    id: 'biz_event',
    titleTh: 'ธุรกิจและอีเวนท์',
    titleEn: 'Business & Event',
    descTh: 'สำหรับร้านค้า กิจการ บูธ อีเวนท์ หรือทีมงานสื่อ/ครีเอเตอร์ที่รับไฟล์จากหลายจุด',
    descEn: 'For shops, booths, events, or media/creator teams collecting files from multiple points',
    placeholderTh: 'เช่น บูธงานหนังสือ A12 / ร้านกาแฟสายรุ้ง',
    placeholderEn: 'e.g. Event Booth A12 / Studio Drop Point',
  },
  {
    id: 'personal_family',
    titleTh: 'ส่วนตัวและครอบครัว',
    titleEn: 'Personal & Family',
    descTh: 'สำหรับใช้งานส่วนตัว ทริปเที่ยว กลุ่มเพื่อน หรือรวมรูปภาพและบิล/สลิปแบบสบาย ๆ',
    descEn: 'For personal use, family trips, friend groups, or casual photo & receipt collection',
    placeholderTh: 'เช่น ทริปเชียงใหม่ครอบครัว / รวมรูปและสลิป',
    placeholderEn: 'e.g. Family Trip Photos / Shared Bills',
  },
  {
    id: 'custom',
    titleTh: 'กำหนดเองอิสระ',
    titleEn: 'Custom Mode',
    descTh: 'ตั้งชื่อหมวดหมู่และจุดรวมไฟล์ในแบบของคุณเองได้อิสระ',
    descEn: 'Freely customize your own category and file collection hub name',
    placeholderTh: 'เช่น จุดรวมไฟล์โปรเจกต์พิเศษประจำเดือน',
    placeholderEn: 'e.g. Custom Project Drop Hub',
  },
];

export const DEFAULT_FILE_DROP_ALLOWED_TYPES: FileDropAllowedTypes = {
  image: true,
  text: true,
  pdf: true,
  excel: true,
};

export function getFileDropModeMeta(modeId: FileDropModeId): FileDropModeMeta {
  return FILE_DROP_MODES.find((m) => m.id === modeId) ?? FILE_DROP_MODES[0];
}

export function getDefaultFileDropHub(orgNameTh: string, orgNameEn?: string): FileDropHubConfig {
  return {
    modeId: 'org_edu',
    customLocationTitle: orgNameTh || orgNameEn || 'จุดฝากไฟล์รวมส่วนกลาง',
    topic: 'จุดรับส่งเอกสาร รูปภาพ และข้อความรวม',
    sharedPasscode: '',
    allowedTypes: { ...DEFAULT_FILE_DROP_ALLOWED_TYPES },
    submissions: [],
  };
}

/**
 * Resolves location title on mode confirmation without overwriting previously saved values
 * if the user leaves the input untouched or empty.
 */
export function resolveLocationTitleUpdate(
  previousTitle: string | undefined,
  nextInput: string,
  fallbackTitle: string
): string {
  const cleaned = nextInput.trim();
  if (cleaned.length > 0) return cleaned;
  const prevCleaned = (previousTitle ?? '').trim();
  if (prevCleaned.length > 0) return prevCleaned;
  return fallbackTitle.trim() || 'จุดฝากไฟล์รวม';
}

export function verifyDropPasscode(expectedPasscode: string, enteredPasscode: string): boolean {
  const expected = expectedPasscode.trim();
  if (!expected) return true;
  return enteredPasscode.trim() === expected;
}

export type DetectedDropCategory = 'image' | 'pdf' | 'excel' | 'other';

export function classifyDropFileType(fileName: string, mimeType: string): DetectedDropCategory {
  const lowerName = fileName.toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  if (
    lowerMime.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(lowerName)
  ) {
    return 'image';
  }
  if (lowerMime === 'application/pdf' || /\.pdf$/i.test(lowerName)) {
    return 'pdf';
  }
  if (
    lowerMime.includes('spreadsheet') ||
    lowerMime.includes('excel') ||
    lowerMime === 'text/csv' ||
    /\.(xlsx?|csv|ods)$/i.test(lowerName)
  ) {
    return 'excel';
  }
  return 'other';
}

export interface RawDropFileInput {
  name: string;
  type: string;
  size: number;
}

export interface DropValidationRejection {
  name: string;
  detectedType: DetectedDropCategory;
  reasonTh: string;
  reasonEn: string;
}

export function getAllowedFileCategoryLabels(
  allowed: FileDropAllowedTypes,
  lang: LangCode
): string[] {
  const labels: string[] = [];
  if (allowed.image) labels.push(lang === 'th' ? 'รูปภาพ' : 'Images');
  if (allowed.text) labels.push(lang === 'th' ? 'ข้อความ' : 'Text');
  if (allowed.pdf) labels.push('PDF');
  if (allowed.excel) labels.push(lang === 'th' ? 'เอ็กเซล (Excel/CSV)' : 'Excel/CSV');
  return labels;
}

export function validateDropFiles<T extends RawDropFileInput>(
  files: T[],
  allowed: FileDropAllowedTypes
): {
  accepted: Array<{ file: T; category: 'image' | 'pdf' | 'excel' }>;
  rejected: DropValidationRejection[];
} {
  const accepted: Array<{ file: T; category: 'image' | 'pdf' | 'excel' }> = [];
  const rejected: DropValidationRejection[] = [];

  for (const file of files) {
    const category = classifyDropFileType(file.name, file.type);
    if (category === 'image' && allowed.image) {
      accepted.push({ file, category });
    } else if (category === 'pdf' && allowed.pdf) {
      accepted.push({ file, category });
    } else if (category === 'excel' && allowed.excel) {
      accepted.push({ file, category });
    } else {
      rejected.push({
        name: file.name,
        detectedType: category,
        reasonTh:
          category === 'other'
            ? `ไฟล์ "${file.name}" ไม่ใช่ประเภทที่จุดรับไฟล์รองรับ`
            : `จุดรับไฟล์นี้ปิดรับประเภท ${
                category === 'image' ? 'รูปภาพ' : category === 'pdf' ? 'PDF' : 'เอ็กเซล'
              } สำหรับ "${file.name}"`,
        reasonEn:
          category === 'other'
            ? `File "${file.name}" is not a supported drop-point file type`
            : `This drop point does not accept ${category.toUpperCase()} files ("${file.name}")`,
      });
    }
  }

  return { accepted, rejected };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
