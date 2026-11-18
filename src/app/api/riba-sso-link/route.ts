import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getLatestSchoolData, getSchoolsByAdmin } from '@/lib/db';
import { isAuthorizedSchoolRequest } from '@/lib/session-token';

const SSO_SECRET =
  process.env.SSO_SECRET || 'meram-oeuo-risk-sso-bridge-key-2026';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const role = body.role === 'teacher' ? 'teacher' : 'admin';
    const schoolKey = String(body.schoolKey || '').trim();
    const adminUid = String(body.adminUid || '').trim();
    const sessionToken =
      req.headers.get('x-session-token')?.trim() ||
      String(body.sessionToken || '').trim();
    const googleToken =
      req.headers.get('Authorization')?.split('Bearer ')[1]?.trim() || '';

    const ribaBaseUrl =
      process.env.NEXT_PUBLIC_RIBA_URL?.replace(/\/+$/, '') ||
      'https://riba.onlinepdr.com';

    let uidForSso = '';

    if (role === 'admin') {
      if (!adminUid) {
        return NextResponse.json({ error: 'Yönetici oturumu gereklidir.' }, { status: 401 });
      }
      if (schoolKey) {
        const authCheck = await isAuthorizedSchoolRequest({
          targetSchoolKey: schoolKey,
          adminUid,
          headerToken: googleToken,
        });
        if (!authCheck.authorized) {
          return NextResponse.json({ error: 'Okul erişim yetkisi doğrulanamadı.' }, { status: 403 });
        }
      } else {
        const list = await getSchoolsByAdmin(adminUid);
        if (!list || list.length === 0) {
          return NextResponse.json({ error: 'Kayıtlı okul bulunamadı.' }, { status: 404 });
        }
      }
      uidForSso = adminUid;
    } else {
      const authCheck = await isAuthorizedSchoolRequest({
        targetSchoolKey: schoolKey,
        sessionToken,
      });
      const username = authCheck.teacherPayload?.username;
      if (!authCheck.authorized || !username) {
        return NextResponse.json({ error: 'Öğretmen oturumu doğrulanamadı.' }, { status: 403 });
      }
      const school = await getLatestSchoolData(schoolKey);
      if (!school) {
        return NextResponse.json({ error: 'Okul bulunamadı.' }, { status: 404 });
      }
      uidForSso = `${schoolKey}:${username}`;
    }

    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = crypto
      .createHash('sha256')
      .update(`${uidForSso}:${role}:${ts}:${SSO_SECRET}`)
      .digest('hex');

    const url = new URL('/sso', ribaBaseUrl);
    url.searchParams.set('uid', uidForSso);
    url.searchParams.set('role', role);
    url.searchParams.set('ts', ts);
    url.searchParams.set('sig', sig);
    if (schoolKey) url.searchParams.set('schoolKey', schoolKey);

    return NextResponse.json({ success: true, url: url.toString() });
  } catch (err: any) {
    console.error('RIBA SSO link error:', err);
    return NextResponse.json(
      { error: 'RİBA geçiş bağlantısı oluşturulamadı.' },
      { status: 500 }
    );
  }
}
