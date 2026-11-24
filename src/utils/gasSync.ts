import type { AuditLogEntry, FileDropSubmission, ProfileCardSubmission } from '../types/system';
import { isValidGasWebAppUrl } from './orgCode';

export interface GasSyncResult {
  synced: boolean;
  driveUrl?: string;
  driveUrls?: Record<string, string>;
  error?: string;
}

interface GasJsonResponse {
  ok?: boolean;
  driveUrls?: Record<string, string>;
  driveUrl?: string;
  message?: string;
}

async function postJsonToGas(gasUrl: string, payload: Record<string, unknown>): Promise<GasSyncResult> {
  if (!isValidGasWebAppUrl(gasUrl)) {
    return { synced: false, error: 'Invalid Google Apps Script URL' };
  }

  try {
    // text/plain avoids CORS preflight OPTIONS failures on Google Apps Script /exec endpoints
    const response = await fetch(gasUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (response.type === 'opaque') {
      return { synced: true };
    }

    if (!response.ok) {
      return { synced: false, error: `HTTP ${response.status}` };
    }

    try {
      const data = (await response.json()) as GasJsonResponse;
      if (data && data.ok === false) {
        return { synced: false, error: data.message || 'GAS returned error' };
      }
      return {
        synced: true,
        driveUrl: data?.driveUrl,
        driveUrls: data?.driveUrls,
      };
    } catch {
      return { synced: true };
    }
  } catch (err) {
    return {
      synced: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function sendDropToGasWebApp(
  gasUrl: string,
  orgId: string,
  submission: FileDropSubmission
): Promise<GasSyncResult> {
  return postJsonToGas(gasUrl, {
    action: 'file_drop',
    orgId,
    submission: {
      id: submission.id,
      senderName: submission.senderName,
      topic: submission.topic,
      locationTitle: submission.locationTitle,
      modeId: submission.modeId,
      message: submission.message ?? '',
      createdAt: submission.createdAt,
      files: submission.files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        category: f.category,
        dataUrl: f.dataUrl,
      })),
    },
  });
}

export async function sendProfileToGasWebApp(
  gasUrl: string,
  orgId: string,
  profile: ProfileCardSubmission
): Promise<GasSyncResult> {
  return postJsonToGas(gasUrl, {
    action: 'profile_drop',
    orgId,
    profile,
  });
}

export async function sendCheckinToGasWebApp(
  gasUrl: string,
  orgId: string,
  logEntry: AuditLogEntry,
  photoDataUrl?: string
): Promise<GasSyncResult> {
  return postJsonToGas(gasUrl, {
    action: photoDataUrl ? 'checkin_photo' : 'audit_log',
    orgId,
    logEntry,
    photoDataUrl,
  });
}

export async function testGasWebAppConnection(gasUrl: string, orgId: string): Promise<GasSyncResult> {
  return postJsonToGas(gasUrl, {
    action: 'ping',
    orgId,
    timestamp: new Date().toISOString(),
  });
}
